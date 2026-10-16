# Read-only cash decision simulator

Demand contains a private scenario tool. Nothing writes to business records or external systems. Primary assumptions start at zero sales/ads; advanced timing, collections, costs, FX and transfers remain local React state.

Opening CAD cash uses current returned business Wise profiles; personal funds are shown separately. Missing/stale cash withholds plots and numerical closing/minimum cash. No currency rate is invented. An explicit planning rate can translate USD obligation reserves only; this does not transfer currency or combine USD cash into CAD.

Cash = opening + settled customer collections + explicit assumed transfers - recorded obligation payments - assumed ad payments - incremental fulfillment/processing/refund/tax/operating payments. No 70%-of-revenue cost substitute is deducted. Historical stock purchases create no new outflow; outstanding supplier balances remain baseline obligations. Additional costs must exclude amounts already covered by those obligations.

The no-new-sales baseline also has no new ads and uses the same obligation dates/reserves. Open/scheduled records remain settlement-unconfirmed reserves, not proof of nonpayment. Overdue payments are assumed at model start with their original dates retained. Undated reserves stay outside dated cash unless a scenario date is assigned. The third chart line deducts still-undated reserves without double deduction after their assumed payment. All figures remain conditional; spendable cash is always withheld because complete obligations/tax/fee/refund coverage is not established.

Orders are one expected cohort on the assumed date, not predicted from ad spending or checked against a complete configuration mix. Full-pay settles 100%; preorder settles 20%, and 80% only after an explicit manual collection date at/after the assumed warehouse-ready date. Settlement delay applies to both. Port estimates Nov 6/15 are business-planning context only and create no cash/stock event or public date change.

Completed net merchandise revenue × owner-estimated 30% after-ads margin is a separate conditional contribution metric. Ads are not deducted again there. Deposit-only/uncompleted orders have zero completed contribution. Margin comparability is unverified at changed acquisition/fulfillment costs. Refunds remove the cohort proportion from completed revenue and pending balances; paid processing fees remain nonrefunded. Cash is not contribution.

Daily cash calculation is plotted with weekly labels and accessible exact values. Same-day outflows are applied before receipts for conservative intraday minima. No optimal ad budget, reserve floor or guaranteed sales/delivery promise is generated.

Validation includes finance fixtures A-F, source-paid-before-opening exclusion, undated reserve assignment, no implied FX, unavailable starting cash, refund-before-balance cancellation and rendering/accessibility. Synthetic isolated Chrome screenshots are layout evidence, not authenticated live acceptance.
