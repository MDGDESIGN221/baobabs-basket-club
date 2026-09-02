-- =====================================================================
-- CODES PROMO — boutique (à exécuter une fois dans Supabase)
--
-- Ce que ça pose :
--   1. La table promo_codes (pourcentage ou montant, période, minimum
--      d'achat, limite d'utilisation, compteur).
--   2. La fonction bbc_valider_promo : le site l'appelle pour vérifier
--      un code et calculer la remise — la table elle-même n'est jamais
--      lisible publiquement.
--   3. Deux colonnes sur orders (promo_code, discount_fcfa) : la
--      commande garde la trace de la remise appliquée.
--   4. Un déclencheur qui incrémente le compteur d'utilisations à
--      chaque commande passée avec un code.
--
-- Réexécutable sans risque. Aucune colonne existante n'est modifiée.
-- =====================================================================

create table if not exists promo_codes (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  kind       text not null default 'percent' check (kind in ('percent','amount')),
  value      integer not null check (value > 0),
  min_total  integer not null default 0,
  max_uses   integer,
  uses       integer not null default 0,
  starts_at  date,
  ends_at    date,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

alter table promo_codes enable row level security;

drop policy if exists promo_admin_all on promo_codes;
create policy promo_admin_all on promo_codes
  for all using (is_admin()) with check (is_admin());

create or replace function bbc_valider_promo(p_code text, p_total integer)
returns table (code text, discount integer, message text)
language plpgsql security definer set search_path = public as $$
declare
  c promo_codes%rowtype;
  d integer;
begin
  select * into c from promo_codes pc where upper(pc.code) = upper(trim(p_code));
  if not found then
    return query select null::text, 0, 'Code inconnu.'; return;
  end if;
  if not c.is_active then
    return query select null::text, 0, 'Ce code n''est plus actif.'; return;
  end if;
  if c.starts_at is not null and current_date < c.starts_at then
    return query select null::text, 0, 'Ce code n''est pas encore actif.'; return;
  end if;
  if c.ends_at is not null and current_date > c.ends_at then
    return query select null::text, 0, 'Ce code a expiré.'; return;
  end if;
  if c.max_uses is not null and c.uses >= c.max_uses then
    return query select null::text, 0, 'Ce code a atteint sa limite d''utilisation.'; return;
  end if;
  if coalesce(p_total, 0) < c.min_total then
    return query select null::text, 0, 'Ce code demande un minimum de ' || c.min_total || ' FCFA d''achat.'; return;
  end if;
  if c.kind = 'percent' then
    d := floor(coalesce(p_total, 0) * c.value / 100.0);
  else
    d := least(c.value, coalesce(p_total, 0));
  end if;
  return query select c.code, d, null::text;
end $$;

grant execute on function bbc_valider_promo(text, integer) to anon, authenticated;

alter table orders add column if not exists promo_code text;
alter table orders add column if not exists discount_fcfa integer not null default 0;

create or replace function bbc_promo_use() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.promo_code is not null and new.promo_code <> '' then
    update promo_codes set uses = uses + 1 where upper(code) = upper(new.promo_code);
  end if;
  return new;
end $$;

drop trigger if exists trg_promo_use on orders;
create trigger trg_promo_use after insert on orders
  for each row execute function bbc_promo_use();
