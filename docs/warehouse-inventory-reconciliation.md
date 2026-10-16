# Inventory reconciliation constraints

Warehouse snapshot source and as-of are not currently established. Database read time is not warehouse freshness. No counts/reservations were changed by the UI release.

Before a source-backed count transaction:
- Map each warehouse SKU explicitly to the existing fabric/module row. Keep covers/accessories distinct. Confirm physical-on-hand versus net-available basis.
- Establish snapshot time/timezone and reconcile dispatch/receipt deltas through the chosen cutoff. Do not add inbound before verified receipt.
- Review active reservation allocations: source `stock` versus container UUID. `reserved_qty` includes both. Current checkout semantics sum max(0,on-hand-all-reserved) per SKU, never aggregate on-hand minus aggregate reserved.
- Match warehouse dispatches against linked paid+fulfilled Shopify orders. The live order trigger can deduct on-hand and release reservations; do not subtract dispatches already reflected in the snapshot again or let a late import repeat that deduction.
- Use one transaction, acquire `pg_advisory_xact_lock(hashtext('luun-preorder-inventory'))`, lock target inventory and relevant reservation rows, verify expected prior counts/updated_at, then apply mapped absolute physical counts only after fulfillment reconciliation. Existing manual inventory edits do not share this advisory lock, so row locks and prior-value checks are also required.
- Preserve reservation allocations, reserved_qty, incoming_qty, builder visibility, Shopify order/product data and unrelated SKUs unless a separately evidenced correction is approved.
- Insert inventory_adjustments rows for each actual delta, with source document reference, snapshot/cutoff times and reconciliation explanation. Maintain an immutable before/after record and source mapping. Validate row counts and totals before commit; rollback on mismatch.
- No warehouse sync or automatic external refresh is claimed. The UI only rereads app records every minute while visible.
