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

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function projectLocation(
  location: ForecastLocation,
  rotation: { x: number; y: number },
  width: number,
  height: number
) {
  const radius = Math.min(width, height) * 0.36;
  const lat = toRadians(location.lat);
  const lng = toRadians(location.lng) + rotation.y;
  const cosLat = Math.cos(lat);
  const x0 = cosLat * Math.sin(lng);
  const y0 = Math.sin(lat);
  const z0 = cosLat * Math.cos(lng);
  const cosX = Math.cos(rotation.x);
  const sinX = Math.sin(rotation.x);
  const y = y0 * cosX - z0 * sinX;
  const z = y0 * sinX + z0 * cosX;

  return {
    visible: z > -0.08,
    x: width / 2 + x0 * radius,
    y: height / 2 - y * radius,
    z
  };
}

function drawGlobe(
  canvas: HTMLCanvasElement,
  rotation: { x: number; y: number },
  selectedLocationId: string
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
  const radius = Math.min(width, height) * 0.36;
  const centerX = width / 2;
  const centerY = height / 2;

  context.clearRect(0, 0, width, height);

  if (radius <= 0) {
    return;
  }

  const gradient = context.createRadialGradient(
    centerX - radius * 0.35,
    centerY - radius * 0.45,
    radius * 0.18,
    centerX,
    centerY,
    radius
  );
  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(0.35, "#dbeafe");
  gradient.addColorStop(1, "#8ab4f8");

  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.fillStyle = gradient;
  context.fill();
  context.strokeStyle = "rgba(26, 115, 232, 0.28)";
  context.lineWidth = 1.5;
  context.stroke();

  context.save();
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.clip();

  context.strokeStyle = "rgba(26, 115, 232, 0.22)";
  context.lineWidth = 1;
  for (let index = -4; index <= 4; index += 1) {
    context.beginPath();
    context.ellipse(centerX, centerY, radius, radius * Math.abs(index / 5), rotation.y, 0, Math.PI * 2);
    context.stroke();
  }
  for (let index = 0; index < 12; index += 1) {
    context.beginPath();
    context.ellipse(
      centerX,
      centerY,
      radius * Math.abs(Math.cos((index * Math.PI) / 12)),
      radius,
      rotation.y + (index * Math.PI) / 12,
      0,
      Math.PI * 2
    );
    context.stroke();
  }

  context.fillStyle = "rgba(255, 255, 255, 0.2)";
  [
    { x: -0.25, y: -0.1, w: 0.34, h: 0.18 },
    { x: 0.15, y: 0.1, w: 0.28, h: 0.14 },
    { x: -0.05, y: 0.28, w: 0.22, h: 0.11 },
    { x: 0.32, y: -0.28, w: 0.2, h: 0.1 }
  ].forEach((shape) => {
    context.beginPath();
    context.ellipse(
      centerX + shape.x * radius,
      centerY + shape.y * radius,
      shape.w * radius,
      shape.h * radius,
      rotation.y * 0.4,
      0,
      Math.PI * 2
    );
    context.fill();
  });

  locations.forEach((location) => {
    const point = projectLocation(location, rotation, width, height);
    if (!point.visible) return;
    const isSelected = location.id === selectedLocationId;
    const color =
      location.type === "Container" ? "#1a73e8" : location.type === "Warehouse" ? "#137333" : "#fbbc04";

    context.beginPath();
    context.arc(point.x, point.y, isSelected ? 9 : 6, 0, Math.PI * 2);
    context.fillStyle = color;
    context.fill();
    context.lineWidth = isSelected ? 4 : 2;
    context.strokeStyle = "#ffffff";
    context.stroke();
  });

  context.restore();

  context.beginPath();
  context.arc(centerX, centerY, radius + 10, 0, Math.PI * 2);
  context.strokeStyle = "rgba(26, 115, 232, 0.08)";
  context.lineWidth = 18;
  context.stroke();
}

export function ForecastingGlobe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ x: number; y: number; rotationX: number; rotationY: number } | null>(null);
  const [rotation, setRotation] = useState({ x: -0.18, y: 2.2 });
  const [selectedLocationId, setSelectedLocationId] = useState(locations[0].id);
  const selectedLocation = useMemo(
    () => locations.find((location) => location.id === selectedLocationId) || locations[0],
    [selectedLocationId]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    drawGlobe(canvas, rotation, selectedLocationId);
  }, [rotation, selectedLocationId]);

  useEffect(() => {
    const onResize = () => {
      const canvas = canvasRef.current;
      if (canvas) drawGlobe(canvas, rotation, selectedLocationId);
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [rotation, selectedLocationId]);

  function onPointerDown(event: PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      rotationX: rotation.x,
      rotationY: rotation.y
    };
  }

  function onPointerMove(event: PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    if (!drag) return;

    setRotation({
      x: Math.max(-1.1, Math.min(1.1, drag.rotationX + (event.clientY - drag.y) * 0.008)),
      y: drag.rotationY + (event.clientX - drag.x) * 0.008
    });
  }

  function onPointerUp() {
    dragRef.current = null;
  }

  function onCanvasClick(event: MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas || dragRef.current) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;
    const hit = locations.find((location) => {
      const point = projectLocation(location, rotation, rect.width, rect.height);
      if (!point.visible) return false;
      return Math.hypot(point.x - clickX, point.y - clickY) < 18;
    });

    if (hit) setSelectedLocationId(hit.id);
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_420px]">
      <section className="rounded-xl border border-line bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Global movement</h2>
            <p className="mt-1 text-sm text-slate-600">Drag the globe. Select a location to view SKUs.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            {["Container", "Warehouse", "Factory"].map((type) => (
              <span className="rounded-full border border-line bg-slate-50 px-3 py-1.5" key={type}>
                {type}
              </span>
            ))}
          </div>
        </div>
        <div className="relative min-h-[520px] overflow-hidden rounded-xl border border-line bg-gradient-to-br from-blue-50 via-white to-slate-50">
          <canvas
            aria-label="Interactive logistics globe"
            className="h-[520px] w-full cursor-grab touch-none active:cursor-grabbing"
            onClick={onCanvasClick}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            ref={canvasRef}
          />
        </div>
      </section>

      <aside className="rounded-xl border border-line bg-white p-5 shadow-sm">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">
            {selectedLocation.type}
          </p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-900">{selectedLocation.name}</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-line bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Status</p>
              <p className="mt-1 font-semibold text-slate-900">{selectedLocation.status}</p>
            </div>
            <div className="rounded-lg border border-line bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">ETA</p>
              <p className="mt-1 font-semibold text-slate-900">{selectedLocation.eta}</p>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-base font-semibold text-slate-900">SKU list</h3>
          <div className="mt-3 overflow-hidden rounded-lg border border-line">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr>
                  {["SKU", "Fabric", "Module", "Qty"].map((heading) => (
                    <th className="border-b border-line px-3 py-3 font-semibold" key={heading}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selectedLocation.skus.map((row) => (
                  <tr className="border-b border-line last:border-0" key={row.sku}>
                    <td className="px-3 py-3 font-medium text-slate-900">{row.sku}</td>
                    <td className="px-3 py-3 text-slate-600">{row.fabric}</td>
                    <td className="px-3 py-3 text-slate-600">{row.module}</td>
                    <td className="px-3 py-3 font-semibold text-slate-900">{row.qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-dashed border-line bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-700">
            Later this panel can connect to real containers, warehouses, factories, and SKU feeds.
          </p>
        </div>
      </aside>
    </div>
  );
}
