-- =====================================================================
--  NEWSLETTER : une adresse, une seule ligne
--  --------------------------------------------------------------------
--  Le formulaire du site (deux endroits : le bloc « inscrivez-vous » et
--  la fenetre de fin de page) insere sans rien verifier. Un double clic,
--  ou la meme personne revenue une semaine plus tard, faisait deux
--  lignes : 3 lignes pour 2 adresses en base le 13 septembre 2026.
--
--  La fonction d'envoi dedoublonne deja a l'envoi (personne ne recoit
--  deux fois), mais l'ecran Messages > Newsletter comptait faux, et le
--  compteur « 3 inscrits » de l'ecran Newsletter aussi.
--
--  Ici : on garde la plus ancienne ligne de chaque adresse, on supprime
--  les autres, et un index unique sur l'adresse (sans casse ni espaces)
--  empeche que ca revienne. Le site, lui, prend le refus (409) pour ce
--  qu'il est : « deja inscrit », donc un succes.
-- =====================================================================

delete from public.newsletter_subscribers a
using public.newsletter_subscribers b
where lower(trim(a.email)) = lower(trim(b.email))
  and a.id <> b.id
  and (a.created_at > b.created_at
       or (a.created_at = b.created_at and a.id > b.id));

create unique index if not exists newsletter_subscribers_email_unique
  on public.newsletter_subscribers (lower(trim(email)));
