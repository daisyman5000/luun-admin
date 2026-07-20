"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent, PointerEvent } from "react";

type SkuRow = {
  sku: string;
  fabric: string;
  module: string;
  qty: number;
};

type ForecastLocation = {
  id: string;
  name: string;
  type: "Container" | "Warehouse" | "Factory";
  lat: number;
  lng: number;
  status: string;
  eta: string;
  skus: SkuRow[];
};

type ProjectedPoint = {
  visible: boolean;
  x: number;
  y: number;
  z: number;
};

const locations: ForecastLocation[] = [
  {
    id: "container-pacific-01",
    name: "Pacific container 01",
    type: "Container",
    lat: 31,
    lng: -150,
    status: "In transit",
    eta: "Aug 12",
    skus: [
      { sku: "LCC-COR-OFFWHITE", fabric: "off-white", module: "corner", qty: 18 },
      { sku: "LCC-SIDE-OFFWHITE", fabric: "off-white", module: "armless", qty: 14 },
      { sku: "LCC-OTT-OFFWHITE", fabric: "off-white", module: "ottoman", qty: 8 }
    ]
  },
  {
    id: "container-pacific-02",
    name: "Pacific container 02",
    type: "Container",
    lat: 36,
    lng: -135,
    status: "At sea",
    eta: "Aug 19",
    skus: [
      { sku: "LCC-COR-DARKGREY", fabric: "dark-grey", module: "corner", qty: 20 },
      { sku: "LCC-SIDE-DARKGREY", fabric: "dark-grey", module: "armless", qty: 12 },
      { sku: "LCC-OTT-DARKGREY", fabric: "dark-grey", module: "ottoman", qty: 10 }
    ]
  },
  {
    id: "cal-warehouse",
    name: "Calgary warehouse",
    type: "Warehouse",
    lat: 51.04,
    lng: -114.07,
    status: "Receiving",
    eta: "Current",
    skus: [
      { sku: "LCC-COR-AQUA", fabric: "aqua", module: "corner", qty: 6 },
      { sku: "LCC-SIDE-AQUA", fabric: "aqua", module: "armless", qty: 4 },
      { sku: "LCC-OTT-AQUA", fabric: "aqua", module: "ottoman", qty: 3 }
    ]
  },
  {
    id: "factory-asia",
    name: "Factory partner",
    type: "Factory",
    lat: 22.3,
    lng: 114.2,
    status: "Production",
    eta: "Next batch",
    skus: [
      { sku: "LCC-COR-PEACH", fabric: "peach", module: "corner", qty: 16 },
      { sku: "LCC-SIDE-PEACH", fabric: "peach", module: "armless", qty: 8 },
      { sku: "LCC-OTT-PEACH", fabric: "peach", module: "ottoman", qty: 8 },
      { sku: "LCC-COR-JADE", fabric: "jade", module: "corner", qty: 6 }
    ]
  }
];

const landMasses: Array<Array<[number, number]>> = [
  [
    [-168, 72],
    [-140, 70],
    [-122, 58],
    [-105, 53],
    [-88, 49],
    [-65, 50],
    [-52, 58],
    [-60, 70],
    [-94, 76],
    [-130, 73]
  ],
  [
    [-130, 52],
    [-118, 34],
    [-104, 24],
    [-95, 16],
    [-83, 9],
    [-76, 18],
    [-81, 30],
    [-97, 43],
    [-113, 50]
  ],
  [
    [-82, 13],
    [-72, 7],
    [-66, -5],
    [-60, -18],
    [-55, -34],
    [-63, -53],
    [-74, -50],
    [-80, -30],
    [-78, -10]
  ],
  [
    [-10, 36],
    [8, 44],
    [28, 42],
    [38, 33],
    [31, 18],
    [15, 10],
    [-3, 18],
    [-12, 28]
  ],
  [
    [-18, 32],
    [8, 35],
    [32, 30],
    [45, 12],
    [42, -12],
    [30, -31],
    [18, -35],
    [4, -28],
    [-10, -8],
    [-16, 12]
  ],
  [
    [32, 70],
    [58, 66],
    [92, 68],
    [125, 58],
    [145, 45],
    [138, 28],
    [112, 20],
    [84, 26],
    [62, 18],
    [45, 28],
    [28, 46]
  ],
  [
    [70, 28],
    [88, 22],
    [92, 8],
    [80, 6],
    [68, 18]
  ],
  [
    [96, 22],
    [116, 20],
    [123, 8],
    [112, -6],
    [100, 5]
  ],
  [
    [112, -10],
    [154, -12],
    [153, -33],
    [134, -39],
    [116, -30]
  ],
  [
    [46, -13],
    [51, -20],
    [48, -26],
    [43, -22]
  ],
  [
    [-52, 72],
    [-30, 72],
    [-22, 64],
    [-40, 60],
    [-54, 64]
  ],
  [
    [-180, -62],
    [-120, -70],
    [-20, -68],
    [60, -72],
    [150, -68],
    [180, -62],
    [180, -82],
    [-180, -82]
  ]
];

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function projectCoordinate(
  latDegrees: number,
  lngDegrees: number,
  rotation: { x: number; y: number },
  width: number,
  height: number
): ProjectedPoint {
  const radius = Math.min(width, height) * 0.43;
  const lat = toRadians(latDegrees);
  const lng = toRadians(lngDegrees) + rotation.y;
  const cosLat = Math.cos(lat);
  const x0 = cosLat * Math.sin(lng);
  const y0 = Math.sin(lat);
  const z0 = cosLat * Math.cos(lng);
  const cosX = Math.cos(rotation.x);
  const sinX = Math.sin(rotation.x);
  const y = y0 * cosX - z0 * sinX;
  const z = y0 * sinX + z0 * cosX;

  return {
    visible: z > -0.02,
    x: width / 2 + x0 * radius,
    y: height / 2 - y * radius,
    z
  };
}

function drawLandMass(
  context: CanvasRenderingContext2D,
  landMass: Array<[number, number]>,
  rotation: { x: number; y: number },
  width: number,
  height: number
) {
  const projected = landMass.map(([lng, lat]) => projectCoordinate(lat, lng, rotation, width, height));
  const visiblePoints = projected.filter((point) => point.visible);

  if (visiblePoints.length < 2) return;

  context.beginPath();
  visiblePoints.forEach((point, index) => {
    if (index === 0) {
      context.moveTo(point.x, point.y);
    } else {
      context.lineTo(point.x, point.y);
    }
  });
  context.closePath();
  context.fillStyle = "rgba(54, 112, 74, 0.88)";
  context.fill();
  context.strokeStyle = "rgba(255, 255, 255, 0.36)";
  context.lineWidth = 1;
  context.stroke();
}

function drawGlobe(
  canvas: HTMLCanvasElement,
  rotation: { x: number; y: number }
) {
  const context = canvas.getContext("2d");
  if (!context) return;

  const rect = canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.floor(rect.width * scale);
  canvas.height = Math.floor(rect.height * scale);
  context.setTransform(scale, 0, 0, scale, 0, 0);

  const width = rect.width;
  const height = rect.height;
  const radius = Math.min(width, height) * 0.43;
  const centerX = width / 2;
  const centerY = height / 2;

  context.clearRect(0, 0, width, height);

  if (radius <= 0) return;

  const spaceGradient = context.createLinearGradient(0, 0, width, height);
  spaceGradient.addColorStop(0, "#07111f");
  spaceGradient.addColorStop(0.45, "#102a52");
  spaceGradient.addColorStop(1, "#f8fafc");
  context.fillStyle = spaceGradient;
  context.fillRect(0, 0, width, height);

  for (let index = 0; index < 120; index += 1) {
    const x = (index * 73) % width;
    const y = (index * 37) % height;
    context.fillStyle = `rgba(255, 255, 255, ${0.18 + ((index % 7) * 0.025)})`;
    context.fillRect(x, y, 1.2, 1.2);
  }

  const glow = context.createRadialGradient(centerX, centerY, radius * 0.82, centerX, centerY, radius * 1.35);
  glow.addColorStop(0, "rgba(26, 115, 232, 0)");
  glow.addColorStop(1, "rgba(26, 115, 232, 0.32)");
  context.beginPath();
  context.arc(centerX, centerY, radius * 1.25, 0, Math.PI * 2);
  context.fillStyle = glow;
  context.fill();

  const ocean = context.createRadialGradient(
    centerX - radius * 0.32,
    centerY - radius * 0.42,
    radius * 0.12,
    centerX,
    centerY,
    radius
  );
  ocean.addColorStop(0, "#dbeafe");
  ocean.addColorStop(0.22, "#7db4f7");
  ocean.addColorStop(0.68, "#1558b0");
  ocean.addColorStop(1, "#092a63");

  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.fillStyle = ocean;
  context.fill();

  context.save();
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.clip();

  landMasses.forEach((landMass) => drawLandMass(context, landMass, rotation, width, height));

  context.strokeStyle = "rgba(255, 255, 255, 0.16)";
  context.lineWidth = 1;
  for (let lat = -60; lat <= 60; lat += 30) {
    context.beginPath();
    for (let lng = -180; lng <= 180; lng += 6) {
      const point = projectCoordinate(lat, lng, rotation, width, height);
      if (!point.visible) continue;
      if (lng === -180) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    }
    context.stroke();
  }

  context.restore();

  const shade = context.createRadialGradient(
    centerX - radius * 0.35,
    centerY - radius * 0.45,
    radius * 0.2,
    centerX + radius * 0.2,
    centerY + radius * 0.18,
    radius
  );
  shade.addColorStop(0, "rgba(255, 255, 255, 0.32)");
  shade.addColorStop(0.55, "rgba(255, 255, 255, 0)");
  shade.addColorStop(1, "rgba(4, 17, 39, 0.5)");
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.fillStyle = shade;
  context.fill();

  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.strokeStyle = "rgba(255, 255, 255, 0.55)";
  context.lineWidth = 1.5;
  context.stroke();

  locations.forEach((location) => {
    const point = projectCoordinate(location.lat, location.lng, rotation, width, height);
    if (!point.visible) return;
    const color =
      location.type === "Container" ? "#8ab4f8" : location.type === "Warehouse" ? "#34a853" : "#fbbc04";

    context.beginPath();
    context.arc(point.x, point.y, 15, 0, Math.PI * 2);
    context.fillStyle = "rgba(255, 255, 255, 0.2)";
    context.fill();
    context.beginPath();
    context.arc(point.x, point.y, 7, 0, Math.PI * 2);
    context.fillStyle = color;
    context.fill();
    context.lineWidth = 3;
    context.strokeStyle = "#ffffff";
    context.stroke();
  });
}

export function ForecastingGlobe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ x: number; y: number; rotationX: number; rotationY: number; moved: boolean } | null>(null);
  const didDragRef = useRef(false);
  const [rotation, setRotation] = useState({ x: -0.16, y: 2.42 });
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const selectedLocation = useMemo(
    () => locations.find((location) => location.id === selectedLocationId) || null,
    [selectedLocationId]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || selectedLocation) return;

    drawGlobe(canvas, rotation);
  }, [rotation, selectedLocation]);

  useEffect(() => {
    const onResize = () => {
      const canvas = canvasRef.current;
      if (canvas && !selectedLocation) drawGlobe(canvas, rotation);
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [rotation, selectedLocation]);

  function onPointerDown(event: PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    didDragRef.current = false;
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      rotationX: rotation.x,
      rotationY: rotation.y,
      moved: false
    };
  }

  function onPointerMove(event: PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    if (!drag) return;

    const deltaX = event.clientX - drag.x;
    const deltaY = event.clientY - drag.y;
    if (Math.abs(deltaX) + Math.abs(deltaY) > 4) {
      drag.moved = true;
      didDragRef.current = true;
    }

    setRotation({
      x: Math.max(-1.12, Math.min(1.12, drag.rotationX + deltaY * 0.008)),
      y: drag.rotationY + deltaX * 0.008
    });
  }

  function onPointerUp() {
    dragRef.current = null;
  }

  function onCanvasClick(event: MouseEvent<HTMLCanvasElement>) {
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;
    const hit = locations.find((location) => {
      const point = projectCoordinate(location.lat, location.lng, rotation, rect.width, rect.height);
      if (!point.visible) return false;
      return Math.hypot(point.x - clickX, point.y - clickY) < 24;
    });

    if (hit) setSelectedLocationId(hit.id);
  }

  if (selectedLocation) {
    return (
      <section className="min-h-[calc(100vh-120px)] rounded-2xl border border-line bg-white p-5 shadow-sm lg:min-h-[calc(100vh-32px)]">
        <button
          className="mb-5 rounded-md border border-line bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          onClick={() => setSelectedLocationId(null)}
          type="button"
        >
          Back to globe
        </button>

        <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_360px]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-normal text-blue-700">{selectedLocation.type}</p>
            <h2 className="mt-1 text-3xl font-semibold tracking-normal text-slate-900">
              {selectedLocation.name}
            </h2>
            <p className="mt-2 text-base text-slate-600">
              Inventory drill-down for this location.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-line bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Status</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{selectedLocation.status}</p>
            </div>
            <div className="rounded-xl border border-line bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">ETA</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{selectedLocation.eta}</p>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-line">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead>
              <tr>
                {["SKU", "Fabric", "Module", "Quantity"].map((heading) => (
                  <th className="border-b border-line px-4 py-4 font-semibold" key={heading}>
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {selectedLocation.skus.map((row) => (
                <tr className="border-b border-line last:border-0" key={row.sku}>
                  <td className="px-4 py-4 font-semibold text-slate-900">{row.sku}</td>
                  <td className="px-4 py-4 text-slate-600">{row.fabric}</td>
                  <td className="px-4 py-4 text-slate-600">{row.module}</td>
                  <td className="px-4 py-4 text-lg font-semibold text-slate-900">{row.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  return (
    <section className="relative min-h-[calc(100vh-120px)] overflow-hidden rounded-2xl border border-line bg-slate-950 shadow-sm lg:min-h-[calc(100vh-32px)]">
      <canvas
        aria-label="Interactive Earth logistics globe"
        className="absolute inset-0 h-full w-full cursor-grab touch-none active:cursor-grabbing"
        onClick={onCanvasClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        ref={canvasRef}
      />
      <div className="pointer-events-none absolute left-5 top-5 max-w-md rounded-2xl border border-white/20 bg-white/80 p-5 shadow-sm backdrop-blur-xl">
        <p className="text-sm font-semibold uppercase tracking-normal text-blue-700">Forecasting</p>
        <h2 className="mt-1 text-2xl font-semibold text-slate-900">Global inventory map</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Drag Earth to rotate. Click a container, warehouse, or factory pin to drill into inventory.
        </p>
      </div>
      <div className="absolute bottom-5 left-5 right-5 flex flex-wrap gap-2">
        {locations.map((location) => (
          <button
            className="rounded-full border border-white/30 bg-white/85 px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm backdrop-blur-xl hover:bg-white"
            key={location.id}
            onClick={() => setSelectedLocationId(location.id)}
            type="button"
          >
            {location.name}
          </button>
        ))}
      </div>
    </section>
  );
}
