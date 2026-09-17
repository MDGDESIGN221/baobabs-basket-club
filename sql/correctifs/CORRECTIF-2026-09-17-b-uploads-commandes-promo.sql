-- =====================================================================
--  LE RESTE DE L'AUDIT : LES ENVOIS, LES COMMANDES, LES CODES PROMO
--  17 septembre 2026. Idempotent. Aucune donnee supprimee.
--
--  A COLLER DANS L'EDITEUR SQL DE SUPABASE, APRES
--  CORRECTIF-2026-09-17-journal-et-roles.sql.
--
--  RIEN ICI N'A DE PRECONDITION. Aucun de ces cinq blocs ne demande
--  qu'une fonction serveur soit deployee d'abord, et aucun ne peut
--  casser le site ou l'administration : on pose, on recalcule, on
--  resserre des grants. Vous pouvez le coller en entier maintenant.
--
--  LE SEUL BLOC QUI AVAIT UNE PRECONDITION A DEMENAGE. Fermer le bucket
--  des photos au navigateur casse l'envoi de photos tant que
--  depot-photo n'est pas en place : il vit donc dans son propre
--  fichier, CORRECTIF-2026-09-17-c-fermer-le-bucket-des-photos.sql, qui
--  le dit en tete. Le laisser au milieu de celui-ci obligeait a
--  « coller jusqu'a telle ligne puis reprendre a telle autre », et
--  c'est une consigne qu'on rate.
--
--  CE QUE LES CINQ BLOCS TRAITENT
--    1. le debit des envois de photos, compte en base
--    2. les commandes : le prix ne vient plus du panier du client
--    3. les codes promo ne se devinent plus un par un
--    4. l'alerte d'inscription ne part plus deux fois
--    5. l'adresse du proprietaire n'est plus lisible sans compte
-- =====================================================================


-- #####################################################################
-- ##  BLOC 1 : LE DEBIT DES ENVOIS DE PHOTOS
-- #####################################################################
--
--  La fonction depot-photo est appelable sans compte : la candidate
--  depose sa photo avant que sa candidature existe, il n'y a rien a
--  verifier. Le controle des octets empeche d'y mettre autre chose
--  qu'une image ; il n'empeche pas d'en mettre mille.
--
--  D'ou ce compteur. Il est en BASE et pas dans la memoire de la
--  fonction : une fonction serveur tourne sur plusieurs instances, et un
--  compteur en memoire compterait separement sur chacune -- donc ne
--  compterait rien.
--
--  UNE LIGNE PAR ENVOI, ET ELLES NE S'ACCUMULENT PAS. La fonction fait
--  le menage a chaque appel : au-dela de vingt-quatre heures, une ligne
--  ne sert plus a rien.
--
--  CE QUE CE COMPTEUR N'EST PAS : une serrure. Une adresse IP se
--  falsifie, et derriere un meme operateur mobile senegalais des
--  centaines de personnes partagent la meme. C'est un frein contre un
--  script, pas une identite. La serrure, c'est la lecture des octets.
-- ---------------------------------------------------------------------
create table if not exists bbc_photo_envois (
  id bigserial primary key,
  ip text        not null,
  le timestamptz not null default now()
);

create index if not exists bbc_photo_envois_ip_le
  on bbc_photo_envois (ip, le desc);

-- Aucune politique : la table ne se lit et ne s'ecrit que par la
-- fonction ci-dessous, et par la cle de service. On allume quand meme
-- la securite des lignes, pour qu'un grant pose par erreur ne suffise
-- pas a l'ouvrir.
alter table bbc_photo_envois enable row level security;

comment on table bbc_photo_envois is
  'Un envoi de photo publique, une ligne. Sert uniquement au frein de '
  'debit de la fonction depot-photo. Purgee au-dela de 24 h.';

create or replace function bbc_photo_debit(p_ip text, p_fenetre_min int default 60)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  -- Le menage d'abord : la table ne doit pas grandir sans fin.
  delete from bbc_photo_envois where le < now() - interval '24 hours';

  insert into bbc_photo_envois (ip) values (coalesce(nullif(btrim(p_ip), ''), 'inconnue'));

  select count(*) into n
    from bbc_photo_envois
   where ip = coalesce(nullif(btrim(p_ip), ''), 'inconnue')
     and le > now() - make_interval(mins => greatest(p_fenetre_min, 1));

  return n;
end;
$$;

-- Personne ne l'appelle depuis un navigateur : seule la fonction
-- serveur le fait, avec la cle de service.
revoke all on function bbc_photo_debit(text, int) from public;
revoke all on function bbc_photo_debit(text, int) from anon;
revoke all on function bbc_photo_debit(text, int) from authenticated;
grant execute on function bbc_photo_debit(text, int) to service_role;


-- #####################################################################
-- ##  BLOC 2 : LE PRIX D'UNE COMMANDE NE VIENT PLUS DU CLIENT
-- #####################################################################
--
--  La politique d'insertion verifie a qui la commande est rattachee :
--
--    create policy orders_public_insert on orders for insert
--      with check (customer_id is null or customer_id = auth.uid())
--
--  Elle ne verifie ni le total, ni les articles, ni les prix. Un
--  visiteur peut donc inserer une commande avec total = 0, ou dix mille
--  commandes fictives.
--
--  CE N'EST PAS UN VOL D'ARGENT : le reglement se fait sur place, en
--  FCFA, et personne ne paie par le site. C'est un ecran de commandes
--  noye, un stock fausse et des recettes fausses.
--
--  ON NE REFUSE PAS, ON RECALCULE. Refuser casserait une commande
--  legitime le jour ou un prix change entre le moment ou la cliente
--  remplit son panier et celui ou elle valide -- ce qui arrive, et ce
--  n'est pas sa faute. Le declencheur recalcule donc le total a partir
--  de products et de promo_codes, garde ce que le navigateur avait
--  annonce dans total_client, et leve un drapeau quand les deux ne
--  concordent pas. La commande passe toujours ; le club voit la verite.
-- ---------------------------------------------------------------------
alter table orders add column if not exists total_client  integer;
alter table orders add column if not exists total_suspect boolean not null default false;

comment on column orders.total_client is
  'Le total tel que le navigateur l''a annonce. Conserve pour pouvoir '
  'regarder apres coup ; ce n''est PAS le prix de la commande.';
comment on column orders.total_suspect is
  'Vrai quand le total annonce ne correspondait pas au recalcul fait en '
  'base. Un prix modifie entre-temps le declenche aussi : ce drapeau '
  'demande un coup d''oeil, il n''accuse personne.';

create or replace function bbc_orders_prix()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  it        jsonb;
  v_brut    bigint := 0;
  v_lignes  int    := 0;
  v_resolus int    := 0;
  v_prix    integer;
  v_remise  integer := 0;
  v_attendu bigint;
  c         promo_codes%rowtype;
begin
  -- Rien a faire sur une commande sans articles : elle vient peut-etre
  -- de l'administration, qui saisit parfois a la main.
  if new.items is null or jsonb_typeof(new.items) <> 'array' then
    return new;
  end if;

  for it in select * from jsonb_array_elements(new.items) loop
    v_lignes := v_lignes + 1;

    -- LE PRIX VIENT DE products, PAS DE L'ARTICLE ENVOYE. C'est tout
    -- l'objet de ce declencheur : items[].unit_price est ecrit par le
    -- navigateur, donc ne prouve rien.
    v_prix := null;
    begin
      select p.price into v_prix from products p
       where p.id::text = (it->>'id');
    exception when others then
      v_prix := null;
    end;

    if v_prix is not null then
      v_resolus := v_resolus + 1;
      v_brut := v_brut + v_prix * greatest(coalesce((it->>'qty')::int, 1), 1);
    else
      -- Article introuvable : produit supprime depuis, ou identifiant
      -- inconnu. On retient ce que la ligne annonce, faute de mieux, et
      -- le drapeau se levera parce que v_resolus < v_lignes.
      v_brut := v_brut + coalesce((it->>'unit_price')::int, 0)
                       * greatest(coalesce((it->>'qty')::int, 1), 1);
    end if;
  end loop;

  -- LA REMISE VIENT DE promo_codes, PAS DU CORPS DE LA REQUETE.
  if coalesce(btrim(new.promo_code), '') <> '' then
    select * into c from promo_codes pc
     where upper(pc.code) = upper(btrim(new.promo_code))
       and pc.is_active
       and (pc.starts_at is null or current_date >= pc.starts_at)
       and (pc.ends_at   is null or current_date <= pc.ends_at)
       and (pc.max_uses  is null or pc.uses < pc.max_uses)
       and v_brut >= pc.min_total;
    if found then
      v_remise := case when c.kind = 'percent'
                       then floor(v_brut * c.value / 100.0)::int
                       else least(c.value, v_brut)::int end;
    else
      -- Code inconnu, expire, epuise, ou minimum d'achat non atteint :
      -- aucune remise, et on retire le code plutot que de laisser
      -- croire qu'il a compte.
      new.promo_code := null;
    end if;
  end if;

  v_attendu := greatest(v_brut - v_remise, 0);

  -- On ne remplace le total que si on a pu resoudre au moins un article.
  -- Sans cela, une commande saisie a la main, sans identifiants de
  -- produits, se verrait ramenee a zero -- le correctif deviendrait le
  -- probleme.
  if v_resolus > 0 then
    new.total_client   := new.total;
    new.total_suspect  := coalesce(new.total, -1) <> v_attendu;
    new.total          := v_attendu::integer;
    new.discount_fcfa  := v_remise;
  end if;

  return new;
end;
$$;

drop trigger if exists bbc_orders_prix_avant on orders;
create trigger bbc_orders_prix_avant
  before insert on orders
  for each row execute function bbc_orders_prix();


-- #####################################################################
-- ##  BLOC 3 : LES CODES PROMO NE SE DEVINENT PLUS
-- #####################################################################
--
--  bbc_valider_promo est accordee a anon, et distinguait ses refus :
--  « Code inconnu » d'un cote, « Ce code n'est plus actif » ou « Ce code
--  a expire » de l'autre. La difference dit si le code EXISTE. Sans
--  frein, on enumere les codes du club en quelques minutes.
--
--  Un seul message desormais pour tous les refus, sauf un : le minimum
--  d'achat. Celui-la, il faut le dire -- la cliente a un code valable et
--  doit savoir qu'il lui manque deux mille francs de panier, sinon elle
--  croit que son code est faux et abandonne. Et il ne revele rien :
--  elle a deja le code.
-- ---------------------------------------------------------------------
create or replace function bbc_valider_promo(p_code text, p_total integer)
returns table (code text, discount integer, message text)
language plpgsql security definer set search_path = public as $$
declare
  c promo_codes%rowtype;
  d integer;
  -- Un seul refus, pour ne rien apprendre a qui essaie au hasard.
  refus text := 'Ce code n''est pas utilisable.';
begin
  select * into c from promo_codes pc where upper(pc.code) = upper(trim(p_code));
  if not found then
    return query select null::text, 0, refus; return;
  end if;
  if not c.is_active then
    return query select null::text, 0, refus; return;
  end if;
  if c.starts_at is not null and current_date < c.starts_at then
    return query select null::text, 0, refus; return;
  end if;
  if c.ends_at is not null and current_date > c.ends_at then
    return query select null::text, 0, refus; return;
  end if;
  if c.max_uses is not null and c.uses >= c.max_uses then
    return query select null::text, 0, refus; return;
  end if;
  -- LA SEULE EXCEPTION, et elle est voulue : le code est bon, c'est le
  -- panier qui ne l'est pas encore. Le taire ferait abandonner une
  -- cliente qui a pourtant tout ce qu'il faut.
  if coalesce(p_total, 0) < c.min_total then
    return query select null::text, 0,
      'Ce code demande un minimum de ' || c.min_total || ' FCFA d''achat.';
    return;
  end if;

  if c.kind = 'percent' then
    d := floor(coalesce(p_total, 0) * c.value / 100.0);
  else
    d := least(c.value, coalesce(p_total, 0));
  end if;

  return query select c.code, d, null::text;
end;
$$;

grant execute on function bbc_valider_promo(text, integer) to anon, authenticated;


-- #####################################################################
-- ##  BLOC 4 : L'ALERTE D'INSCRIPTION NE PART PLUS DEUX FOIS
-- #####################################################################
--
--  alerte-inscription est appelable sans compte et sans secret : elle
--  accepte { registration_id } en appel direct, « pour pouvoir tester
--  depuis le tableau de bord ». Elle relit bien la base -- on ne peut
--  donc pas lui faire dire n'importe quoi -- mais qui connait un
--  identifiant d'inscription peut la declencher en boucle. La boite du
--  club se remplit, et le quota Resend s'epuise : ce quota est partage
--  avec les e-mails de commande et la newsletter, qui s'arreteraient
--  aussi.
--
--  ON NE POSE PAS DE SECRET ICI, ET C'EST DELIBERE. Un secret exige de
--  modifier la definition du webhook dans le tableau de bord EN MEME
--  TEMPS que la fonction ; se tromper d'ordre, et le club cesse d'etre
--  prevenu des nouvelles inscriptions sans que rien ne le signale. La
--  colonne ci-dessous ferme l'abus sans ce risque : une inscription ne
--  declenche qu'une alerte, pour toujours. C'est aussi une amelioration
--  en soi -- une alerte en double a deja fait rappeler deux fois la meme
--  famille.
--
--  Le secret reste la bonne chose a faire ensuite, posement, dans le bon
--  ordre. Voir l'etape 12 du rapport d'audit.
-- ---------------------------------------------------------------------
alter table academy_registrations
  add column if not exists alerte_envoyee_le timestamptz;

comment on column academy_registrations.alerte_envoyee_le is
  'Quand l''alerte e-mail est partie au club. Renseignee par la fonction '
  'alerte-inscription, qui refuse de repartir si elle est deja la.';

-- Les inscriptions deja en base n'ont jamais eu de marque : on considere
-- que leur alerte est partie, sans quoi une reexecution du webhook les
-- enverrait toutes d'un coup.
update academy_registrations
   set alerte_envoyee_le = coalesce(alerte_envoyee_le, created_at)
 where alerte_envoyee_le is null;


-- #####################################################################
-- ##  BLOC 5 : L'ADRESSE DU PROPRIETAIRE N'EST PLUS LISIBLE SANS COMPTE
-- #####################################################################
--
--  bbc_proprietaire_email() est accordee a anon : l'adresse se lit par
--  l'API, sans compte. Elle est de toute facon en clair dans le depot,
--  qui est public, donc ce n'est pas une fuite -- c'est une porte
--  inutile, et une porte inutile se ferme.
--
--  L'ADMINISTRATION L'APPELLE VRAIMENT : admin-matchs.html fait
--  sb.rpc('bbc_proprietaire_email') pour comparer l'adresse de l'ecran a
--  celle de la base. Cet appel a une session, donc `authenticated`
--  suffit.
--
--  bbc_est_proprietaire() GARDE son grant a anon, et il ne faut pas y
--  toucher : elle est appelee par des politiques RLS, et une politique
--  qui appelle une fonction non executable par le role courant ne
--  renvoie pas « faux » -- elle fait echouer toute la requete. Elle est
--  en security definer, donc son appel interne a
--  bbc_proprietaire_email() continue de fonctionner sans le grant.
-- ---------------------------------------------------------------------
-- « from public » EN PREMIER, ET C'EST TOUT L'INTERET DE LA LIGNE.
-- Postgres accorde EXECUTE a PUBLIC sur toute fonction nouvellement
-- creee, et `anon` herite de PUBLIC : revoquer a `anon` seulement
-- retire un droit propre qu'il n'avait peut-etre pas, et laisse celui
-- qu'il tient de PUBLIC. Mesure sur la vraie base le 17 septembre au
-- soir : apres un « revoke ... from anon » seul,
-- has_function_privilege('anon', ...) rendait toujours true.
-- Voir CORRECTIF-2026-09-17-d-portes-de-fonctions.sql, qui a trouve
-- cinq autres portes ouvertes par le meme defaut.
revoke execute on function bbc_proprietaire_email() from public;
revoke execute on function bbc_proprietaire_email() from anon;
grant  execute on function bbc_proprietaire_email() to authenticated;


-- =====================================================================
--  VERIFICATIONS
-- ---------------------------------------------------------------------
--  a) LE PRIX D'UNE COMMANDE EST CELUI DU CLUB. Passez une commande
--     normale depuis la boutique, puis :
--
--       select order_number, total, total_client, total_suspect,
--              promo_code, discount_fcfa
--         from orders order by created_at desc limit 3;
--
--     total_suspect doit valoir false, et total_client egaler total.
--     S'il est vrai sur une commande normale, deux explications : un
--     prix a change entre le panier et la validation -- ce qui arrive et
--     n'est pas grave -- ou le declencheur a un defaut. Dans le doute,
--     dites-le avant d'aller plus loin plutot que de vivre avec un
--     drapeau qui se leve tout seul : un drapeau qui crie toujours ne se
--     regarde plus.
--
--  b) LES CODES PROMO. Essayez un code au hasard, puis un code reel mais
--     expire : les deux doivent donner exactement le meme message. Et un
--     code valable doit toujours s'appliquer, remise comprise.
--
--  c) LES ALERTES D'INSCRIPTION. Ce bloc n'a pose qu'une colonne ; la
--     fonction qui la lit doit etre redeployee pour que ca change
--     quelque chose :
--       npx supabase functions deploy alerte-inscription --project-ref lmwbwasupqkvswukieav
--     Ensuite : deposez une inscription de test, une alerte arrive.
--     Rejouez le webhook a la main depuis le tableau de bord sur la MEME
--     inscription : rien ne doit repartir.
--
--     ET DANS CET ORDRE, PAS L'INVERSE. La colonne d'abord, la fonction
--     ensuite : la nouvelle version lit alerte_envoyee_le, et sans la
--     colonne sa requete echoue -- le club cesserait d'etre prevenu des
--     inscriptions sans que rien ne le signale.
--
--  d) LE COMPTEUR D'ENVOIS existe mais ne sert a rien tant que
--     depot-photo n'est pas deployee. Il n'y a rien a verifier ici :
--     c'est le fichier c qui s'en occupe.
--
--
--  REVENIR EN ARRIERE
--  Aucune donnee n'est supprimee.
--
--  Pour desactiver la garde des prix :
--    alter table orders disable trigger bbc_orders_prix_avant;
--
--  Pour rendre aux codes promo leurs messages detailles, relancez
--  l'ancienne version de bbc_valider_promo depuis
--  sql/migrations/MIGRATION-codes-promo.sql. Vous rouvrez alors la
--  possibilite d'enumerer les codes : c'est le compromis, et il est
--  petit dans les deux sens.
-- =====================================================================
