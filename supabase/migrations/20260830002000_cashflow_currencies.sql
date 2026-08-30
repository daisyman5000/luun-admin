alter table public.container_entries
add column if not exists amount_currency text default 'USD';

alter table public.major_expenses
add column if not exists currency text default 'CAD';

alter table public.wayflyer_payments
add column if not exists currency text default 'CAD';

update public.container_entries
set amount_currency = 'USD'
where amount_currency is null;

update public.major_expenses
set currency = 'CAD'
where currency is null;

update public.wayflyer_payments
set currency = 'CAD'
where currency is null;
