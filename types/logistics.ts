export type LogisticsSkuQuantity = {
  sku: string;
  colour: "off-white" | "dark-grey" | "peach" | "aqua" | "jade";
  module: "corner" | "armless" | "ottoman";
  quantity: number;
};

export type LogisticsCoordinate = {
  lat: number;
  lng: number;
};

export type LogisticsFactory = LogisticsCoordinate & {
  id: string;
  name: string;
  city: string;
  country: string;
};

export type LogisticsWarehouse = LogisticsCoordinate & {
  id: string;
  name: string;
  city: string;
  country: string;
  availableInventory: LogisticsSkuQuantity[];
  reservedInventory: LogisticsSkuQuantity[];
  inboundInventory: LogisticsSkuQuantity[];
};

export type LogisticsContainer = {
  id: string;
  containerNumber: string;
  origin: LogisticsFactory;
  destination: LogisticsWarehouse;
  departure_at: string;
  estimated_arrival_at: string;
  status: "Loading" | "At sea" | "Customs" | "Rail" | "Arriving soon";
  skuQuantities: LogisticsSkuQuantity[];
};

export type LogisticsRoute = {
  id: string;
  origin: LogisticsCoordinate;
  destination: LogisticsCoordinate;
  label: string;
};

export type LogisticsSelection =
  | { type: "warehouse"; item: LogisticsWarehouse }
  | { type: "container"; item: LogisticsContainer };
