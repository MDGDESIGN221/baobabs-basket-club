-- =====================================================================
--  COMMANDES <-> STOCK : la liaison qui manquait
--  --------------------------------------------------------------------
--  Le site enregistre une commande (orders.items : [{id, size, qty}]),
--  l'admin la confirme, la prepare, la remet. Rien ne touchait au stock
--  par taille des produits (products.stock, jsonb {"M": 3, ...}) : l'ecran
--  Stock ne pouvait dire vrai qu'a la main.
--
--  Regle : quand une commande ENTRE dans un statut engageant (confirmee,
--  prete, recuperee) et que le stock n'a pas encore ete applique, chaque
--  ligne dont le produit est suivi (track_stock) retire qty de la taille
--  commandee. Une commande annulee APRES application rend les pieces.
--  orders.stock_applique garde la trace : jamais deux fois.
--
--  Les tailles inconnues du stock (accessoires sans taille, taille hors
--  liste) sont laissees telles quelles : on ne cree pas de cle.
--  products_sync_stock (deja en place) recalcule in_stock apres coup.
-- =====================================================================

alter table public.orders add column if not exists stock_applique boolean not null default false;

create or replace function public.bbc_orders_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  it jsonb;
  p  products%rowtype;
  q  integer;
  s  text;
  st jsonb;
  sens integer := 0;   -- -1 : on retire, +1 : on rend
begin
  if new.status in ('confirmée', 'prête', 'récupérée') and not coalesce(old.stock_applique, false) then
    sens := -1;
  elsif new.status = 'annulée' and coalesce(old.stock_applique, false) then
    sens := 1;
  end if;
  if sens = 0 then return new; end if;

  for it in select * from jsonb_array_elements(coalesce(new.items, '[]'::jsonb)) loop
    begin
      select * into p from products where id::text = it->>'id';
    exception when others then
      continue;
    end;
    if not found or not coalesce(p.track_stock, false) then continue; end if;
    s := coalesce(it->>'size', '');
    q := coalesce(nullif(it->>'qty', '')::integer, 1);
    st := coalesce(p.stock, '{}'::jsonb);
    if s = '' or not (st ? s) then continue; end if;
    st := jsonb_set(st, array[s], to_jsonb(greatest(coalesce((st->>s)::integer, 0) + sens * q, 0)), true);
    update products set stock = st where id = p.id;
  end loop;

  new.stock_applique := (sens = -1);
  return new;
end;
$$;

drop trigger if exists orders_stock on public.orders;
create trigger orders_stock
  before update of status on public.orders
  for each row execute function public.bbc_orders_stock();
