-- Keep Luun Admin authoritative. Validate and allocate in one database request.
create or replace function public.confirm_luun_checkout(
 reservation_input uuid, fabric_input text, counts_input jsonb, cart_input text,
 preorder_input boolean, total_input integer, plan_input text,
 shop_input text, client_input text, rate_key_input text
) returns jsonb language plpgsql set search_path=public as $$
declare
 sale sale_control%rowtype; active boolean; pieces integer; bps integer;
 expected integer=0; unit integer; n integer; k text; stock_qty integer;
 plans jsonb; setup text; arrival date;
begin
 if not claim_sale_checkout_request(rate_key_input) then
  return jsonb_build_object('error','Please wait a minute before retrying.','status',429);
 end if;
 if preorder_input is null or total_input is null or fabric_input not in ('jade','aqua','peach','dark-grey','off-white') then
  return jsonb_build_object('error','Invalid checkout configuration.');
 end if;
 pieces=0;
 for k in select unnest(array['corner','armless','ottoman']) loop
  n=(counts_input->>k)::integer;
  if n is null or n<0 or n>100 then return jsonb_build_object('error','Invalid module count.'); end if;
  pieces=pieces+n;
 end loop;
 if pieces=0 then return jsonb_build_object('error','Choose at least one module.'); end if;
 select * into sale from sale_control where id=1 for share;
 active=coalesce(sale.enabled and sale.status='ready' and now()>=sale.starts_at and now()<sale.ends_at,false);
 bps=case when active then case when pieces>=6 then 4475 when pieces>=4 then 4410 when pieces=3 then 4215 else 3500 end
  else case when pieces>=6 then 1500 when pieces>=4 then 1400 when pieces=3 then 1100 else 0 end end;
 for k in select unnest(array['corner','armless','ottoman']) loop
  unit=case k when 'corner' then 148462 when 'armless' then 107692 else 61538 end;
  expected=expected+(counts_input->>k)::integer*(unit-floor(unit::numeric*bps/10000)::integer);
 end loop;
 if expected<>total_input then return jsonb_build_object('error','Pricing changed. Review the updated total before checkout.'); end if;
 if preorder_input then
  select plan_ids,plan_setup_state into plans,setup from preorder_app_connections
   where shop_domain=shop_input and client_id=client_input for share;
  if setup is distinct from 'ready' or plan_input is null or plan_input is distinct from plans->>('luun-deposit-'||bps) then
   return jsonb_build_object('error','Preorder payment terms changed. Please refresh.');
  end if;
 elsif plan_input is not null then
  return jsonb_build_object('error','Full payment cannot include a deposit plan.');
 end if;
 -- Same lock as existing claims, cancellations and received containers.
 perform pg_advisory_xact_lock(hashtext('luun-preorder-inventory'));
 if not preorder_input then
  for k in select unnest(array['corner','armless','ottoman']) loop
   if (counts_input->>k)::integer=0 then continue; end if;
   select greatest(0,coalesce(available_qty,0)-coalesce(reserved_qty,0)) into stock_qty
    from inventory where fabric_slug=fabric_input and module_slug=k and builder_visible=true for update;
   if stock_qty is null or stock_qty<(counts_input->>k)::integer then
    return jsonb_build_object('error','Availability changed. Refresh to see the correct payment option.');
   end if;
  end loop;
 end if;
 begin
  if not claim_preorder_inventory(reservation_input,fabric_input,counts_input,cart_input) then
   return jsonb_build_object('error','This inventory was just reserved. Please refresh.');
  end if;
  select eta into arrival from preorder_reservations where id=reservation_input;
  -- A refreshed stock state can require a different payment option.
  if preorder_input and arrival is null then
   raise exception 'Availability changed. Refresh to see the correct payment option.';
  end if;
 exception when others then
  return jsonb_build_object('error',sqlerrm);
 end;
 return jsonb_build_object('eta',arrival,'preorder',preorder_input,'totalCents',expected);
end $$;
revoke all on function public.confirm_luun_checkout(uuid,text,jsonb,text,boolean,integer,text,text,text,text) from public,anon,authenticated;
grant execute on function public.confirm_luun_checkout(uuid,text,jsonb,text,boolean,integer,text,text,text,text) to service_role;
