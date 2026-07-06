insert into public.inventory (fabric_slug, module_slug, available_qty, reserved_qty, incoming_qty, low_stock_threshold, builder_visible)
values
  ('white', 'corner', 34, 0, 0, 3, true),
  ('dark-grey', 'corner', 30, 0, 0, 3, true),
  ('white', 'side', 30, 0, 0, 3, true),
  ('white', 'ottoman', 22, 0, 0, 3, true),
  ('jade', 'corner', 6, 0, 0, 3, true),
  ('peach', 'side', 8, 0, 0, 3, true),
  ('peach', 'ottoman', 8, 0, 0, 3, true),
  ('jade', 'ottoman', 2, 0, 0, 3, true),
  ('jade', 'side', 1, 0, 0, 3, true),
  ('skyblue', 'side', 4, 0, 0, 3, true),
  ('skyblue', 'corner', 4, 0, 0, 3, true),
  ('skyblue', 'ottoman', 2, 0, 0, 3, true),
  ('blue', 'corner', 2, 0, 0, 3, true),
  ('blue', 'ottoman', 1, 0, 0, 3, true)
on conflict (fabric_slug, module_slug) do update set
  available_qty = excluded.available_qty,
  updated_at = now();
