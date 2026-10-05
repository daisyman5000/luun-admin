create table public.preorder_reservations (
 id uuid primary key,
 fabric text not null,
 counts jsonb not null,
 cart_id text not null unique,
 created_at timestamptz not null default now(),
 released_at timestamptz
);
alter table public.preorder_reservations enable row level security;
revoke all on public.preorder_reservations from anon, authenticated;
grant all on public.preorder_reservations to service_role;

create or replace function public.claim_preorder_inventory(reservation_id uuid, fabric_input text, counts_input jsonb, cart_input text)
returns boolean language plpgsql set search_path = public as $$
declare
 k text; n integer; row_id uuid; current_qty integer; reserved_qty integer; incoming_qty integer;
begin
 perform pg_advisory_xact_lock(hashtext('luun-preorder-inventory'));
 if exists(select 1 from preorder_reservations where id=reservation_id) then
  return exists(select 1 from preorder_reservations where id=reservation_id and fabric=fabric_input and counts=counts_input and cart_id=cart_input and released_at is null);
 end if;
 if fabric_input not in ('jade','aqua','peach','dark-grey','off-white') or cart_input not like 'gid://shopify/Cart/%' then raise exception 'Invalid reservation'; end if;
 for k in select unnest(array['corner','armless','ottoman']) loop
  n=(counts_input->>k)::integer;
  if n is null or n<0 or n>100 then raise exception 'Invalid quantity'; end if;
  if n=0 then continue; end if;
  select id,coalesce(available_qty,0),coalesce(inventory.reserved_qty,0) into row_id,current_qty,reserved_qty from inventory
   where fabric_slug=fabric_input and module_slug=k and builder_visible=true for update;
  if row_id is null then raise exception 'Inventory unavailable'; end if;
  select coalesce(sum((item->>'quantity')::integer),0) into incoming_qty
  from container_entries c cross join lateral jsonb_array_elements(c.manifest_json) item
  where (c.status in ('production','in_transit') or c.status='planning' and c.container_number in ('MT-LUUN-007','MT-LUUN-008'))
   and c.eta >= (now() at time zone 'America/Vancouver')::date
   and item->>'module'=k
   and case lower(trim(item->>'color')) when 'white' then 'off-white' when 'dark grey' then 'dark-grey' when 'dark-gray' then 'dark-grey' else lower(trim(item->>'color')) end=fabric_input;
  if current_qty+incoming_qty-reserved_qty<n then raise exception 'Configuration exceeds remaining inventory'; end if;
 end loop;
 if (counts_input->>'corner')::integer+(counts_input->>'armless')::integer+(counts_input->>'ottoman')::integer=0 then raise exception 'Empty configuration'; end if;
 for k in select unnest(array['corner','armless','ottoman']) loop
  n=(counts_input->>k)::integer;
  if n>0 then update inventory set reserved_qty=coalesce(inventory.reserved_qty,0)+n where fabric_slug=fabric_input and module_slug=k and builder_visible=true; end if;
 end loop;
 insert into preorder_reservations(id,fabric,counts,cart_id) values(reservation_id,fabric_input,counts_input,cart_input);
 return true;
end $$;
revoke all on function public.claim_preorder_inventory(uuid,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.claim_preorder_inventory(uuid,text,jsonb,text) to service_role;

create or replace function public.release_preorder_inventory(reservation_id uuid)
returns boolean language plpgsql set search_path = public as $$
declare r preorder_reservations%rowtype; k text;
begin
 perform pg_advisory_xact_lock(hashtext('luun-preorder-inventory'));
 select * into r from preorder_reservations where id=reservation_id for update;
 if r.id is null then return false; end if;
 if r.released_at is not null then return true; end if;
 for k in select unnest(array['corner','armless','ottoman']) loop
  update inventory set reserved_qty=greatest(0,coalesce(inventory.reserved_qty,0)-(r.counts->>k)::integer)
   where fabric_slug=r.fabric and module_slug=k and builder_visible=true;
 end loop;
 update preorder_reservations set released_at=now() where id=reservation_id;
 return true;
end $$;
revoke all on function public.release_preorder_inventory(uuid) from public,anon,authenticated;
grant execute on function public.release_preorder_inventory(uuid) to service_role;

alter table public.preorder_reservations add column shopify_order_id text unique;
create or replace function public.sync_preorder_reservation_order()
returns trigger language plpgsql set search_path=public as $$
declare reservation_key text; r preorder_reservations%rowtype; k text;
begin
 select item->>'value' into reservation_key from jsonb_array_elements(coalesce(new.raw_shopify_json->'customAttributes','[]'::jsonb)) item where item->>'key'='Luun reservation' limit 1;
 if reservation_key is null or reservation_key !~ '^[0-9a-fA-F-]{36}$' then return new; end if;
 perform pg_advisory_xact_lock(hashtext('luun-preorder-inventory'));
 select * into r from preorder_reservations where id=reservation_key::uuid for update;
 if r.id is null or r.released_at is not null or new.shopify_order_id is null then return new; end if;
 if r.fabric is distinct from new.fabric_slug or (r.counts->>'corner')::integer is distinct from new.corner_qty or (r.counts->>'armless')::integer is distinct from new.armless_qty or (r.counts->>'ottoman')::integer is distinct from new.ottoman_qty then return new; end if;
 if r.shopify_order_id is not null and r.shopify_order_id<>new.shopify_order_id then return new; end if;
 update preorder_reservations set shopify_order_id=new.shopify_order_id where id=r.id;
 if new.raw_shopify_json->>'cancelledAt' is not null then
  perform release_preorder_inventory(r.id);
 elsif upper(coalesce(new.fulfillment_status,''))='FULFILLED' and upper(coalesce(new.payment_status,''))='PAID' then
  for k in select unnest(array['corner','armless','ottoman']) loop
   update inventory set available_qty=greatest(0,coalesce(available_qty,0)-(r.counts->>k)::integer) where fabric_slug=r.fabric and module_slug=k and builder_visible=true;
  end loop;
  perform release_preorder_inventory(r.id);
 end if;
 return new;
end $$;
create trigger sync_preorder_reservation_order after insert or update on public.shopify_orders for each row execute function public.sync_preorder_reservation_order();

create or replace function public.release_abandoned_preorder_inventory(reservation_id uuid)
returns boolean language plpgsql set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtext('luun-preorder-inventory'));
 if not exists(select 1 from preorder_reservations where id=reservation_id and shopify_order_id is null and released_at is null) then return false; end if;
 return release_preorder_inventory(reservation_id);
end $$;
revoke all on function public.release_abandoned_preorder_inventory(uuid) from public,anon,authenticated;
grant execute on function public.release_abandoned_preorder_inventory(uuid) to service_role;
