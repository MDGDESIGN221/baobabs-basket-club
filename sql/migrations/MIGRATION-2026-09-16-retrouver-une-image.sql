-- =====================================================================
-- RETROUVER UNE IMAGE REMPLACEE PAR ERREUR
-- Baobabs Basket Club — 16 septembre 2026
-- =====================================================================
--
-- LE PROBLEME, DIT PAR CELUI QUI L'A VECU :
--   « par megarde j'ai remplace la photo de Mouhamed Salif AW sans faire
--     expres et je ne retrouve plus la photo »
--
-- CE QUI EST VRAI, ET CE QUI NE L'EST PAS.
--
--   Le fichier n'est PAS perdu. Chaque televersement ecrit un chemin
--   unique (uploadFile : Date.now() + nom du fichier), donc rien n'est
--   jamais ecrase dans le stockage, et changer la photo d'une fiche ne
--   supprime pas l'ancien fichier. Ce qui est perdu, c'est l'ADRESSE :
--   la fiche ne pointe plus dessus, et personne ne sait plus laquelle
--   c'etait.
--
--   Or cette adresse est ecrite quelque part depuis le premier jour :
--   admin_audit_log garde, pour chaque enregistrement, le champ touche,
--   la valeur d'avant et la valeur d'apres. L'ancienne photo est donc
--   deja en base. Elle n'etait simplement pas lisible : la seule
--   fonction de lecture (verify_audit_password) demande un mot de passe
--   et renvoie le journal ENTIER, ce qui ne peut pas s'ouvrir depuis une
--   fiche.
--
-- CE QUE CE SCRIPT AJOUTE : deux lectures etroites, et rien d'autre.
--   Aucune table creee, aucune donnee ecrite, aucune policy modifiee.
--   Si ces deux fonctions sont supprimees demain, le site est exactement
--   comme avant.
--
--   1. bbc_image_historique(table, id, champ)  -> les adresses passees
--      d'UNE image d'UNE fiche. C'est ce que l'ecran montre sous la
--      photo : « cette photo a deja change 2 fois ».
--   2. bbc_images_remplacees(jours)            -> toutes les images
--      remplacees recemment, pour retrouver celle dont on ne sait plus
--      a quelle fiche elle appartenait.
--
-- DEUX GARDE-FOUS, parce qu'un journal d'administration n'est pas un
-- contenu public :
--   - les deux fonctions refusent qui n'est pas dans admin_users
--     (is_admin()), et le disent au lieu de renvoyer une liste vide ;
--   - elles ne rendent QUE des lignes d'image : le champ doit ressembler
--     a une image ET la valeur doit etre une adresse http. Aucun autre
--     champ du journal ne peut sortir par ce chemin, meme par erreur de
--     frappe dans l'appel.
--
-- A EXECUTER dans l'editeur SQL de Supabase. Sans danger : rejouable.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Le journal doit exister. S'il manque, ces fonctions n'auraient
--    rien a lire et il vaut mieux le dire tout de suite que livrer un
--    ecran qui repond toujours « aucune version precedente ».
-- ---------------------------------------------------------------------
do $$
begin
  if to_regclass('public.admin_audit_log') is null then
    raise exception 'admin_audit_log est absente : lancez d''abord sql/diagnostics/AUDIT-HISTORIQUE.sql';
  end if;
end $$;


-- ---------------------------------------------------------------------
-- 0 bis. UN INDEX, SINON CHAQUE OUVERTURE RELIT TOUT LE JOURNAL
--
--    Le journal n'a qu'un index, sur la date. Chercher « les images de
--    CETTE fiche » le parcourrait donc en entier a chaque clic. Il ne
--    s'agit pas d'optimisation prematuree : c'est exactement la lecture
--    que l'ecran fera, et elle doit rester instantanee quand le journal
--    aura grossi.
-- ---------------------------------------------------------------------
create index if not exists admin_audit_log_cible_idx
  on admin_audit_log (table_name, record_id, created_at desc);


-- ---------------------------------------------------------------------
-- 1. L'HISTORIQUE D'UNE IMAGE PRECISE
--
--    p_champ a null = tous les champs image de la fiche (une fiche
--    joueuse n'a qu'une photo, un match en a deux).
-- ---------------------------------------------------------------------
create or replace function bbc_image_historique(
  p_table     text,
  p_record_id text,
  p_champ     text default null
)
returns table (
  quand  timestamptz,
  qui    text,
  champ  text,
  avant  text,
  apres  text
)
language plpgsql
stable
security definer
set search_path = public, extensions
as $fn$
begin
  if not is_admin() then
    raise exception 'Seule une personne de l''administration peut consulter l''historique des images.';
  end if;

  return query
    select l.created_at, l.user_email, l.field_key, l.old_value, l.new_value
      from admin_audit_log l
     where l.table_name = p_table
       and l.record_id  = p_record_id
       and (p_champ is null or l.field_key = p_champ)
       -- le champ doit etre un champ d'image...
       and l.field_key ~* '(photo|image|logo|visuel|cover|banner|affiche|media|url_media)'
       -- ...et la ligne doit porter une vraie adresse, avant ou apres.
       and (coalesce(l.old_value,'') like 'http%' or coalesce(l.new_value,'') like 'http%')
     order by l.created_at desc
     limit 40;
end;
$fn$;

revoke all on function bbc_image_historique(text, text, text) from public;
revoke all on function bbc_image_historique(text, text, text) from anon;
grant execute on function bbc_image_historique(text, text, text) to authenticated;


-- ---------------------------------------------------------------------
-- 2. TOUTES LES IMAGES REMPLACEES RECEMMENT
--
--    Pour le cas reel : on sait qu'une photo a saute, on ne sait plus
--    laquelle ni sur quelle fiche. On ne garde que les lignes ou une
--    adresse a DISPARU (old_value etait une image) : ajouter une photo
--    la ou il n'y en avait pas n'a rien remplace, et n'a pas a figurer
--    dans une liste qui sert a reparer.
-- ---------------------------------------------------------------------
create or replace function bbc_images_remplacees(p_jours int default 120)
returns table (
  quand      timestamptz,
  qui        text,
  section    text,
  table_nom  text,
  record_id  text,
  champ      text,
  avant      text,
  apres      text
)
language plpgsql
stable
security definer
set search_path = public, extensions
as $fn$
begin
  if not is_admin() then
    raise exception 'Seule une personne de l''administration peut consulter l''historique des images.';
  end if;

  return query
    select l.created_at, l.user_email, l.section, l.table_name, l.record_id,
           l.field_key, l.old_value, l.new_value
      from admin_audit_log l
     where l.created_at >= now() - make_interval(days => greatest(1, least(coalesce(p_jours,120), 3650)))
       and l.field_key ~* '(photo|image|logo|visuel|cover|banner|affiche|media|url_media)'
       and coalesce(l.old_value,'') like 'http%'
       and coalesce(l.old_value,'') is distinct from coalesce(l.new_value,'')
     order by l.created_at desc
     limit 300;
end;
$fn$;

revoke all on function bbc_images_remplacees(int) from public;
revoke all on function bbc_images_remplacees(int) from anon;
grant execute on function bbc_images_remplacees(int) to authenticated;


-- ---------------------------------------------------------------------
-- 3. VERIFICATION — a lire dans le resultat, pas a croire sur parole
-- ---------------------------------------------------------------------
-- Borne sur la date : le journal grossit, et une verification ne doit
-- jamais devenir la requete la plus lourde de la base.
select 'images remplacees retrouvables (1 an)' as quoi, count(*) as combien
  from admin_audit_log
 where created_at >= now() - interval '365 days'
   and field_key ~* '(photo|image|logo|visuel|cover|banner|affiche|media|url_media)'
   and coalesce(old_value,'') like 'http%'
   and coalesce(old_value,'') is distinct from coalesce(new_value,'');
