-- =====================================================================
--  LE MOT DE PASSE DES COMPTES ET DE L'HISTORIQUE SE REMPLACE DEPUIS L'ADMIN
--  --------------------------------------------------------------------
--  Les ecrans Comptes et Historique demandent un second mot de passe,
--  garde hache dans admin_audit_secret. Il ne se relit pas, et jusqu'ici
--  il ne se remplacait que par une ligne dans l'editeur SQL de Supabase.
--  « mon mot de passe ne passe plus dans comptes et roles et historique »
--  (20 septembre 2026).
--
--  Cette fonction le remplace depuis l'admin, pour le proprietaire seul :
--  sa session (mot de passe de connexion, second facteur s'il est pose)
--  est la preuve. Pas besoin de l'ancien, c'est tout l'interet : on
--  l'appelle quand on l'a perdu. Le mot de passe voyage dans le corps
--  de l'appel, comme deja pour bbc_comptes_deverrouiller ; rien ne le
--  journalise.
--
--  A EXECUTER DANS L'EDITEUR SQL DE SUPABASE (ou par le MCP).
-- =====================================================================

create or replace function public.bbc_secret_changer(p_nouveau text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  if not bbc_est_proprietaire() then
    raise exception 'Réservé au compte propriétaire';
  end if;
  if p_nouveau is null or length(p_nouveau) < 8 then
    raise exception 'Huit caractères au moins';
  end if;
  insert into admin_audit_secret (id, pwd_hash)
  values (1, crypt(p_nouveau, gen_salt('bf')))
  on conflict (id) do update set pwd_hash = excluded.pwd_hash;
  return true;
end $$;

-- Postgres accorde EXECUTE a PUBLIC sur toute fonction nouvelle : on le
-- retire, puis on ne rend qu'aux comptes connectes ; la fonction, elle,
-- refuse tout autre compte que le proprietaire.
revoke execute on function public.bbc_secret_changer(text) from public, anon;
grant  execute on function public.bbc_secret_changer(text) to authenticated;

-- VERIFICATIONS
--   select has_function_privilege('anon', 'public.bbc_secret_changer(text)', 'execute');
--   -- attendu : false
--   Puis, dans l'admin, ecran Comptes, espace du proprietaire : remplacer le
--   mot de passe, et le redonner au cadenas « Changer un role ».
