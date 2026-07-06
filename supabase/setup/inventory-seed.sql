delete from public.inventory;

insert into public.inventory (
  fabric_slug,
  module_slug,
  available_qty,
  reserved_qty,
  incoming_qty,
  low_stock_threshold,
  builder_visible
)
values
  ('off-white', 'corner', 34, 0, 0, 3, true),
  ('off-white', 'armless', 30, 0, 0, 3, true),
  ('off-white', 'ottoman', 22, 0, 0, 3, true),
  ('dark-grey', 'corner', 30, 0, 0, 3, true),
  ('dark-grey', 'armless', 12, 0, 0, 3, true),
  ('dark-grey', 'ottoman', 17, 0, 0, 3, true),
  ('jade', 'corner', 6, 0, 0, 3, true),
  ('jade', 'armless', 1, 0, 0, 3, true),
  ('jade', 'ottoman', 2, 0, 0, 3, true),
  ('peach', 'corner', 16, 0, 0, 3, true),
  ('peach', 'armless', 8, 0, 0, 3, true),
  ('peach', 'ottoman', 8, 0, 0, 3, true),
  ('aqua', 'corner', 6, 0, 0, 3, true),
  ('aqua', 'armless', 4, 0, 0, 3, true),
  ('aqua', 'ottoman', 3, 0, 0, 3, true);
