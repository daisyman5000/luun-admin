"use client";

import dynamic from "next/dynamic";

import type {
  LogisticsContainer,
  LogisticsFactory,
  LogisticsRoute,
  LogisticsSkuQuantity,
  LogisticsWarehouse
} from "@/types/logistics";

const GlobeScene = dynamic(
  () => import("@/components/logistics/GlobeScene").then((module) => module.GlobeScene),
  {
    ssr: false,
    loading: () => (
      <section className="grid min-h-[calc(100vh-120px)] place-items-center rounded-3xl border border-line bg-slate-950 text-white lg:min-h-[calc(100vh-32px)]">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          <p className="mt-4 text-sm font-semibold text-slate-200">Loading logistics globe</p>
        </div>
      </section>
    )
  }
);

function sku(
  skuCode: string,
  colour: LogisticsSkuQuantity["colour"],
  module: LogisticsSkuQuantity["module"],
  quantity: number
): LogisticsSkuQuantity {
  return {
    sku: skuCode,
    colour,
    module,
    quantity
  };
}

const hoChiMinhFactory: LogisticsFactory = {
  id: "factory-ho-chi-minh",
  name: "Ho Chi Minh City factory",
  city: "Ho Chi Minh City",
  country: "Vietnam",
  lat: 10.8231,
  lng: 106.6297
};

const vancouverWarehouse: LogisticsWarehouse = {
  id: "warehouse-vancouver",
  name: "Vancouver warehouse",
  city: "Vancouver",
  country: "Canada",
  lat: 49.2827,
  lng: -123.1207,
  availableInventory: [
    sku("LCC-COR-OFFWHITE", "off-white", "corner", 34),
    sku("LCC-SIDE-OFFWHITE", "off-white", "armless", 30),
    sku("LCC-COR-DARKGREY", "dark-grey", "corner", 30),
    sku("LCC-SIDE-DARKGREY", "dark-grey", "armless", 12),
    sku("LCC-OTT-DARKGREY", "dark-grey", "ottoman", 17)
  ],
  reservedInventory: [
    sku("LCC-COR-OFFWHITE", "off-white", "corner", 4),
    sku("LCC-SIDE-DARKGREY", "dark-grey", "armless", 2)
  ],
  inboundInventory: [
    sku("LCC-COR-PEACH", "peach", "corner", 16),
    sku("LCC-SIDE-PEACH", "peach", "armless", 8),
    sku("LCC-OTT-PEACH", "peach", "ottoman", 8)
  ]
};

const seattleWarehouse: LogisticsWarehouse = {
  id: "warehouse-seattle",
  name: "Seattle warehouse",
  city: "Seattle",
  country: "United States",
  lat: 47.6061,
  lng: -122.3328,
  availableInventory: [
    sku("LCC-COR-AQUA", "aqua", "corner", 6),
    sku("LCC-SIDE-AQUA", "aqua", "armless", 4),
    sku("LCC-OTT-AQUA", "aqua", "ottoman", 3),
    sku("LCC-COR-JADE", "jade", "corner", 6),
    sku("LCC-SIDE-JADE", "jade", "armless", 1),
    sku("LCC-OTT-JADE", "jade", "ottoman", 2)
  ],
  reservedInventory: [
    sku("LCC-COR-AQUA", "aqua", "corner", 1),
    sku("LCC-OTT-JADE", "jade", "ottoman", 1)
  ],
  inboundInventory: [
    sku("LCC-COR-DARKGREY", "dark-grey", "corner", 20),
    sku("LCC-SIDE-DARKGREY", "dark-grey", "armless", 12),
    sku("LCC-OTT-DARKGREY", "dark-grey", "ottoman", 10)
  ]
};

const factories = [hoChiMinhFactory];
const warehouses = [vancouverWarehouse, seattleWarehouse];

const containers: LogisticsContainer[] = [
  {
    id: "container-luun-2406-a",
    containerNumber: "LUUN-2406-A",
    origin: hoChiMinhFactory,
    destination: vancouverWarehouse,
    departure_at: "2026-07-02T08:00:00.000Z",
    estimated_arrival_at: "2026-08-12T18:00:00.000Z",
    status: "At sea",
    skuQuantities: [
      sku("LCC-COR-PEACH", "peach", "corner", 16),
      sku("LCC-SIDE-PEACH", "peach", "armless", 8),
      sku("LCC-OTT-PEACH", "peach", "ottoman", 8),
      sku("LCC-COR-OFFWHITE", "off-white", "corner", 18)
    ]
  },
  {
    id: "container-luun-2406-b",
    containerNumber: "LUUN-2406-B",
    origin: hoChiMinhFactory,
    destination: seattleWarehouse,
    departure_at: "2026-07-08T08:00:00.000Z",
    estimated_arrival_at: "2026-08-19T18:00:00.000Z",
    status: "At sea",
    skuQuantities: [
      sku("LCC-COR-DARKGREY", "dark-grey", "corner", 20),
      sku("LCC-SIDE-DARKGREY", "dark-grey", "armless", 12),
      sku("LCC-OTT-DARKGREY", "dark-grey", "ottoman", 10),
      sku("LCC-COR-JADE", "jade", "corner", 6)
    ]
  }
];

const routes: LogisticsRoute[] = containers.map((container) => ({
  id: `route-${container.id}`,
  origin: container.origin,
  destination: container.destination,
  label: `${container.origin.city} to ${container.destination.city}`
}));

export function LogisticsGlobe() {
  return (
    <GlobeScene
      containers={containers}
      factories={factories}
      routes={routes}
      warehouses={warehouses}
    />
  );
}
