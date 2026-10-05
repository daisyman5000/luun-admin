-- Run the entire file. Fixtures and every test change are rolled back.
begin;
do $ declare incoming integer; begin
 perform pg_advisory_xact_lock(hashtext('luun-preorder-inventory'));
 select coalesce(sum((item->>'quantity')::integer),0) into incoming from container_entries c cross join lateral jsonb_array_elements(c.manifest_json) item
 where (c.status in ('production','in_transit') or c.status='planning' and c.container_number in ('MT-LUUN-007','MT-LUUN-008')) and c.eta >= (now() at time zone 'America/Vancouver')::date and item->>'module'='armless' and lower(trim(item->>'color')) in ('dark grey','dark-grey','dark-gray');
 update inventory set available_qty=1,reserved_qty=incoming where fabric_slug='dark-grey' and module_slug='armless';
end $;
do $$
declare a uuid=gen_random_uuid(); b uuid=gen_random_uuid(); c jsonb='{"corner":0,"armless":1,"ottoman":0}';
begin
 if not public.claim_preorder_inventory(a,'dark-grey',c,'gid://shopify/Cart/regression-a') then raise exception 'Claim failed'; end if;
 if not public.claim_preorder_inventory(a,'dark-grey',c,'gid://shopify/Cart/regression-a') then raise exception 'Retry failed'; end if;
 begin
  perform public.claim_preorder_inventory(b,'dark-grey','{"corner":0,"armless":1,"ottoman":0}','gid://shopify/Cart/regression-b');
  raise exception 'Oversell was allowed';
 exception when others then
  if sqlerrm <> 'Configuration exceeds remaining inventory' then raise; end if;
 end;
 if not public.release_preorder_inventory(a) then raise exception 'Release failed'; end if;
 if not public.release_preorder_inventory(a) then raise exception 'Release retry failed'; end if;
end $$;
rollback;

begin;
do $ declare incoming integer; begin
 perform pg_advisory_xact_lock(hashtext('luun-preorder-inventory'));
 select coalesce(sum((item->>'quantity')::integer),0) into incoming from container_entries c cross join lateral jsonb_array_elements(c.manifest_json) item
 where (c.status in ('production','in_transit') or c.status='planning' and c.container_number in ('MT-LUUN-007','MT-LUUN-008')) and c.eta >= (now() at time zone 'America/Vancouver')::date and item->>'module'='armless' and lower(trim(item->>'color')) in ('dark grey','dark-grey','dark-gray');
 update inventory set available_qty=1,reserved_qty=incoming where fabric_slug='dark-grey' and module_slug='armless';
end $;
update inventory set available_qty=2,reserved_qty=0 where fabric_slug='dark-grey' and module_slug='corner';
do $$
declare a uuid=gen_random_uuid(); b uuid=gen_random_uuid(); order_a text='regression-'||a; order_b text='regression-'||b; before_qty integer; metadata jsonb;
begin
 perform claim_preorder_inventory(a,'dark-grey','{"corner":0,"armless":1,"ottoman":0}','gid://shopify/Cart/regression-cancel');
 metadata=jsonb_build_object('customAttributes',jsonb_build_array(jsonb_build_object('key','Luun reservation','value',a::text)));
 insert into shopify_orders(shopify_order_id,fabric_slug,corner_qty,armless_qty,ottoman_qty,payment_status,fulfillment_status,raw_shopify_json) values(order_a,'dark-grey',0,1,0,'PARTIALLY_PAID','UNFULFILLED',metadata);
 if (select shopify_order_id from preorder_reservations where id=a) is distinct from order_a then raise exception 'Order binding failed'; end if;
 if release_abandoned_preorder_inventory(a) then raise exception 'Live order was released'; end if;
 update shopify_orders set raw_shopify_json=metadata||jsonb_build_object('cancelledAt',now()) where shopify_order_id=order_a;
 if (select released_at from preorder_reservations where id=a) is null then raise exception 'Cancellation failed'; end if;
 select available_qty into before_qty from inventory where fabric_slug='dark-grey' and module_slug='corner';
 perform claim_preorder_inventory(b,'dark-grey','{"corner":1,"armless":0,"ottoman":0}','gid://shopify/Cart/regression-fulfilled');
 metadata=jsonb_build_object('customAttributes',jsonb_build_array(jsonb_build_object('key','Luun reservation','value',b::text)));
 insert into shopify_orders(shopify_order_id,fabric_slug,corner_qty,armless_qty,ottoman_qty,payment_status,fulfillment_status,raw_shopify_json) values(order_b,'dark-grey',1,0,0,'PAID','FULFILLED',metadata);
 update shopify_orders set raw_shopify_json=metadata where shopify_order_id=order_b;
 if (select available_qty from inventory where fabric_slug='dark-grey' and module_slug='corner')<>before_qty-1 then raise exception 'Fulfillment did not deduct exactly once'; end if;
end $$;
rollback;
