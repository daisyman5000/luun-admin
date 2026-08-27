export type ModuleSlug = "corner" | "armless" | "ottoman";
export type ForecastStatus = "Planning" | "Production" | "In transit" | "Received";
export type ForecastView = "board" | "calendar";

export type InventoryItem = {
  color: string;
  module: ModuleSlug;
  onHand: number;
};

export type PurchaseOrderItem = {
  color: string;
  module: ModuleSlug;
  quantity: number;
};

export type PurchaseOrder = {
  id: string;
  factory: string;
  destination: string;
  crd: string;
  status: ForecastStatus;
  containerId?: string;
  items: PurchaseOrderItem[];
};

export type ContainerShipment = {
  id: string;
  purchaseOrderIds: string[];
  origin: string;
  destination: string;
  departureDate: string;
  eta: string;
  status: "On water" | "At port" | "Customs" | "Delivered";
};

export type PlanningTarget = {
  color: string;
  module: ModuleSlug;
  needed: number;
};

export type ModuleTotals = Record<ModuleSlug, number>;

export type ColorSummary = {
  color: string;
  modules: ModuleTotals;
  total: number;
};

export type SalePlan = {
  id: string;
  name: string;
  date: string;
  note: string;
  targets: ColorSummary[];
};

export type CalendarEvent = {
  id: string;
  date: string;
  detail: string;
  moduleDelta: ModuleTotals;
  purchaseOrderId?: string;
  title: string;
  totalDelta: number;
  type: "container" | "purchase-order" | "sale";
};

export const MODULES: ModuleSlug[] = ["corner", "armless", "ottoman"];
export const COLORS = ["Off-white", "Dark grey", "Peach", "Aqua", "Jade"];

export const CANADA_INVENTORY: InventoryItem[] = [
  { color: "Off-white", module: "corner", onHand: 34 },
  { color: "Off-white", module: "armless", onHand: 30 },
  { color: "Off-white", module: "ottoman", onHand: 22 },
  { color: "Dark grey", module: "corner", onHand: 30 },
  { color: "Dark grey", module: "armless", onHand: 12 },
  { color: "Dark grey", module: "ottoman", onHand: 17 },
  { color: "Peach", module: "corner", onHand: 16 },
  { color: "Peach", module: "armless", onHand: 8 },
  { color: "Peach", module: "ottoman", onHand: 8 },
  { color: "Aqua", module: "corner", onHand: 6 },
  { color: "Aqua", module: "armless", onHand: 4 },
  { color: "Aqua", module: "ottoman", onHand: 3 },
  { color: "Jade", module: "corner", onHand: 6 },
  { color: "Jade", module: "armless", onHand: 1 },
  { color: "Jade", module: "ottoman", onHand: 2 }
];

export const PURCHASE_ORDERS: PurchaseOrder[] = [
  {
    id: "PO-2607A",
    factory: "Vietnam factory",
    destination: "Canada warehouse",
    crd: "Aug 7, 2026",
    status: "In transit",
    containerId: "CONT-LUUN-0807",
    items: [
      { color: "Off-white", module: "corner", quantity: 40 },
      { color: "Off-white", module: "armless", quantity: 28 },
      { color: "Off-white", module: "ottoman", quantity: 20 },
      { color: "Dark grey", module: "corner", quantity: 28 },
      { color: "Dark grey", module: "armless", quantity: 18 },
      { color: "Dark grey", module: "ottoman", quantity: 12 }
    ]
  },
  {
    id: "PO-2608A",
    factory: "Vietnam factory",
    destination: "Canada warehouse",
    crd: "Aug 28, 2026",
    status: "Production",
    items: [
      { color: "Peach", module: "corner", quantity: 32 },
      { color: "Peach", module: "armless", quantity: 20 },
      { color: "Peach", module: "ottoman", quantity: 14 },
      { color: "Aqua", module: "corner", quantity: 24 },
      { color: "Aqua", module: "armless", quantity: 18 },
      { color: "Aqua", module: "ottoman", quantity: 12 }
    ]
  },
  {
    id: "PO-2609A",
    factory: "Vietnam factory",
    destination: "Canada warehouse",
    crd: "Sep 12, 2026",
    status: "Planning",
    items: [
      { color: "Jade", module: "corner", quantity: 30 },
      { color: "Jade", module: "armless", quantity: 22 },
      { color: "Jade", module: "ottoman", quantity: 16 }
    ]
  }
];

export const CONTAINERS: ContainerShipment[] = [
  {
    id: "CONT-LUUN-0807",
    purchaseOrderIds: ["PO-2607A"],
    origin: "Ho Chi Minh City",
    destination: "Vancouver",
    departureDate: "Jul 14, 2026",
    eta: "Aug 7, 2026",
    status: "On water"
  }
];

export const INITIAL_PLANNING_TARGETS: PlanningTarget[] = [
  { color: "Off-white", module: "corner", needed: 42 },
  { color: "Off-white", module: "armless", needed: 28 },
  { color: "Off-white", module: "ottoman", needed: 18 },
  { color: "Dark grey", module: "corner", needed: 34 },
  { color: "Dark grey", module: "armless", needed: 24 },
  { color: "Dark grey", module: "ottoman", needed: 22 },
  { color: "Peach", module: "corner", needed: 20 },
  { color: "Peach", module: "armless", needed: 12 },
  { color: "Peach", module: "ottoman", needed: 10 },
  { color: "Aqua", module: "corner", needed: 14 },
  { color: "Aqua", module: "armless", needed: 10 },
  { color: "Aqua", module: "ottoman", needed: 8 },
  { color: "Jade", module: "corner", needed: 12 },
  { color: "Jade", module: "armless", needed: 8 },
  { color: "Jade", module: "ottoman", needed: 6 }
];

export const SALE_PLANS: SalePlan[] = [
  {
    id: "SALE-AUG-LABOUR",
    name: "Late August sale",
    date: "Aug 22, 2026",
    note: "Clear room before the next Canada receipt.",
    targets: [
      { color: "Off-white", modules: { armless: 10, corner: 14, ottoman: 8 }, total: 32 },
      { color: "Dark grey", modules: { armless: 8, corner: 12, ottoman: 8 }, total: 28 },
      { color: "Peach", modules: { armless: 4, corner: 6, ottoman: 4 }, total: 14 }
    ]
  },
  {
    id: "SALE-SEP-FALL",
    name: "Fall launch sale",
    date: "Sep 19, 2026",
    note: "Use after jade and aqua stock are replenished.",
    targets: [
      { color: "Aqua", modules: { armless: 8, corner: 10, ottoman: 6 }, total: 24 },
      { color: "Jade", modules: { armless: 8, corner: 12, ottoman: 6 }, total: 26 },
      { color: "Off-white", modules: { armless: 8, corner: 10, ottoman: 6 }, total: 24 }
    ]
  }
];

const EMPTY_TOTALS: ModuleTotals = { armless: 0, corner: 0, ottoman: 0 };

export function emptyTotals(): ModuleTotals {
  return { ...EMPTY_TOTALS };
}

export function moduleLabel(module: ModuleSlug) {
  return module === "armless" ? "Armless" : module.charAt(0).toUpperCase() + module.slice(1);
}

export function totalModules(modules: ModuleTotals) {
  return MODULES.reduce((total, module) => total + modules[module], 0);
}

export function summarizeInventory(items: InventoryItem[]): ColorSummary[] {
  return COLORS.map((color) => {
    const modules = emptyTotals();

    items
      .filter((item) => item.color === color)
      .forEach((item) => {
        modules[item.module] += item.onHand;
      });

    return { color, modules, total: totalModules(modules) };
  });
}

export function summarizePurchaseItems(items: PurchaseOrderItem[]): ColorSummary[] {
  return COLORS.map((color) => {
    const modules = emptyTotals();

    items
      .filter((item) => item.color === color)
      .forEach((item) => {
        modules[item.module] += item.quantity;
      });

    return { color, modules, total: totalModules(modules) };
  }).filter((summary) => summary.total > 0);
}

export function getContainerItems(container: ContainerShipment) {
  return PURCHASE_ORDERS.filter((purchaseOrder) => container.purchaseOrderIds.includes(purchaseOrder.id)).flatMap(
    (purchaseOrder) => purchaseOrder.items
  );
}

export function createCalendarEvents(): CalendarEvent[] {
  const containerEvents = CONTAINERS.map((container) => {
    const items = getContainerItems(container);
    const moduleDelta = items.reduce<ModuleTotals>((totals, item) => {
      totals[item.module] += item.quantity;
      return totals;
    }, emptyTotals());

    return {
      date: container.eta,
      detail: `${container.origin} to ${container.destination}`,
      id: container.id,
      moduleDelta,
      title: `${container.id} arrives`,
      totalDelta: totalModules(moduleDelta),
      type: "container" as const
    };
  });

  const purchaseOrderEvents = PURCHASE_ORDERS.filter((purchaseOrder) => purchaseOrder.status === "Planning").map((purchaseOrder) => {
    const moduleDelta = purchaseOrder.items.reduce<ModuleTotals>((totals, item) => {
      totals[item.module] += item.quantity;
      return totals;
    }, emptyTotals());

    return {
      date: "Aug 12, 2026",
      detail: `${purchaseOrder.factory} to ${purchaseOrder.destination}. CRD ${purchaseOrder.crd}.`,
      id: `BUY-${purchaseOrder.id}`,
      moduleDelta,
      purchaseOrderId: purchaseOrder.id,
      title: `Place ${purchaseOrder.id}`,
      totalDelta: totalModules(moduleDelta),
      type: "purchase-order" as const
    };
  });

  const saleEvents = SALE_PLANS.map((sale) => {
    const moduleDelta = sale.targets.reduce<ModuleTotals>((totals, target) => {
      MODULES.forEach((module) => {
        totals[module] -= target.modules[module];
      });
      return totals;
    }, emptyTotals());

    return {
      date: sale.date,
      detail: sale.note,
      id: sale.id,
      moduleDelta,
      title: sale.name,
      totalDelta: totalModules(moduleDelta),
      type: "sale" as const
    };
  });

  return [...containerEvents, ...purchaseOrderEvents, ...saleEvents].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
}

export function createCalendarProjection(inventoryRows: ColorSummary[], events: CalendarEvent[]) {
  let projected = inventoryRows.reduce((total, row) => total + row.total, 0);

  return [
    { date: "Today", projected, title: "Current Canada inventory" },
    ...events.map((event) => {
      if (event.type !== "purchase-order") {
        projected += event.totalDelta;
      }

      return {
        date: event.date,
        projected,
        title: event.title
      };
    })
  ];
}
