-- =====================================================================
--  QUI SONT LES ABONNÉS DE LA LETTRE
--  --------------------------------------------------------------------
--  L'écran « Newsletter — envoi » affiche « 3 inscrits » et, juste
--  au-dessus du bouton d'envoi, « L'envoi général partira à 3
--  inscrits ». Le chiffre est une pastille morte : on s'apprête à
--  écrire à trois personnes sans pouvoir voir lesquelles.
--
--  La liste existe pourtant -- écran Messages, onglet Newsletter --
--  mais personne ne va la chercher là, et elle ne dit d'un abonné que
--  son adresse, son nom et sa date d'inscription.
--
--  Or le club en sait beaucoup plus, et il ne le relie jamais. La même
--  adresse peut figurer dans cinq autres tables :
--
--      orders.customer_email ............ elle a commandé à la boutique
--      academy_registrations.guardian_email ... c'est un parent d'élève
--      reservations.buyer_email ......... elle a pris des billets
--      contact_messages.email ........... elle a écrit au club
--      recruitment_requests.email ....... elle a postulé
--
--  Écrire à « une maman d'élève qui achète au magasin » n'est pas
--  écrire à « une adresse recueillie sur le site ». Cette vue le dit.
--
--  security_invoker : les sous-requêtes s'exécutent sous les droits de
--  celui qui lit. Un compte qui voit la lettre sans voir la boutique
--  lira donc « 0 commande ». C'est voulu -- la vue ne doit ouvrir
--  aucune porte que les permissions ferment -- et l'admin en tient
--  compte : un compteur à zéro n'affiche RIEN. L'absence d'une pastille
--  n'affirme jamais que la personne n'a rien fait, elle dit seulement
--  que rien n'est à montrer ici.
--
--  Lecture seule, aucune donnée écrite.
-- =====================================================================

create or replace view public.newsletter_abonnes with (security_invoker = on) as
  select n.id,
         n.email,
         n.name,
         n.created_at,
         -- Comparaison en minuscules des deux côtés : une adresse
         -- saisie « Awa@Gmail.com » à la boutique et « awa@gmail.com »
         -- sur le formulaire est la même personne.
         (select count(*) from orders o
           where o.customer_email is not null
             and lower(o.customer_email) = lower(n.email)) as commandes,
         (select coalesce(sum(o.total), 0) from orders o
           where o.customer_email is not null
             and lower(o.customer_email) = lower(n.email)
             and o.paid) as depense,
         (select count(*) from academy_registrations a
           where a.guardian_email is not null
             and lower(a.guardian_email) = lower(n.email)) as enfants_ecole,
         (select count(*) from reservations r
           where r.buyer_email is not null
             and lower(r.buyer_email) = lower(n.email)) as billets,
         (select count(*) from contact_messages c
           where c.email is not null
             and lower(c.email) = lower(n.email)) as messages,
         (select count(*) from recruitment_requests q
           where q.email is not null
             and lower(q.email) = lower(n.email)) as candidatures
    from newsletter_subscribers n;

comment on view public.newsletter_abonnes is
  'Les abonnés de la lettre, et ce que le club sait déjà de chaque adresse : '
  'commandes, enfants à l''école, billets, messages, candidature. '
  'security_invoker : un compteur à zéro peut aussi vouloir dire « vous n''avez '
  'pas le droit de voir cette table » -- l''admin n''affiche donc rien à zéro.';


-- ---------------------------------------------------------------------
--  VÉRIFICATIONS
--  ---------------------------------------------------------------------
--    select email, name, commandes, depense, enfants_ecole, billets,
--           messages, candidatures
--      from newsletter_abonnes order by created_at desc;
--
--    -- La vue ne doit RIEN ouvrir a l'anonyme : la lecture de
--    -- newsletter_subscribers exige deja bbc_can('contenu','voir').
--    select policyname, cmd from pg_policies
--     where tablename = 'newsletter_subscribers' and cmd = 'SELECT';
-- ---------------------------------------------------------------------
