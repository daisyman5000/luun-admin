"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import Globe from "react-globe.gl";

import { LogisticsDetailsPanel } from "@/components/logistics/LogisticsDetailsPanel";
import { getContainerPosition } from "@/lib/globe/shipment-position";
import type {
  LogisticsContainer,
  LogisticsFactory,
  LogisticsRoute,
  LogisticsSelection,
  LogisticsWarehouse
} from "@/types/logistics";

type GlobeSceneProps = {
  factories: LogisticsFactory[];
  warehouses: LogisticsWarehouse[];
  containers: LogisticsContainer[];
  routes: LogisticsRoute[];
};

type GlobePoint = {
  id: string;
  lat: number;
  lng: number;
  altitude: number;
  radius: number;
  color: string;
  label: string;
  kind: "factory" | "warehouse" | "container";
  warehouse?: LogisticsWarehouse;
  container?: LogisticsContainer;
};

type GlobeArc = {
  id: string;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color: string[];
};

type ProjectedMarker = GlobePoint & {
  visible: boolean;
  x: number;
  y: number;
};

type GlobeControlApi = {
  autoRotate: boolean;
  autoRotateSpeed: number;
  enableDamping: boolean;
  enableRotate: boolean;
  enableZoom: boolean;
  dampingFactor: number;
  rotateSpeed: number;
  zoomSpeed: number;
};

type GlobeApi = {
  pointOfView: (
    pointOfView?: { lat: number; lng: number; altitude: number },
    transitionMs?: number
  ) => { lat: number; lng: number; altitude: number };
  controls: () => GlobeControlApi;
};

const EARTH_TEXTURE_URL = "https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg";
const EARTH_BUMP_URL = "https://unpkg.com/three-globe/example/img/earth-topology.png";

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function projectPoint(
  point: { lat: number; lng: number },
  rotation: { x: number; y: number },
  size: { width: number; height: number }
) {
  const radius = Math.min(size.width, size.height) * 0.39;
  const lat = toRadians(point.lat);
  const lng = toRadians(point.lng + rotation.y);
  const tilt = toRadians(rotation.x);
  const cosLat = Math.cos(lat);
  const x0 = cosLat * Math.sin(lng);
  const y0 = Math.sin(lat);
  const z0 = cosLat * Math.cos(lng);
  const y = y0 * Math.cos(tilt) - z0 * Math.sin(tilt);
  const z = y0 * Math.sin(tilt) + z0 * Math.cos(tilt);

  return {
    visible: z > -0.04,
    x: size.width / 2 + x0 * radius,
    y: size.height / 2 - y * radius
  };
}

function hasWebGlSupport() {
  if (typeof window === "undefined") return false;

  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

function StaticEarthFallback() {
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center overflow-hidden bg-[radial-gradient(circle_at_center,#102a52_0,#06111f_58%,#020617_100%)]">
      <div
        aria-hidden="true"
        className="h-[min(78vw,78vh)] w-[min(78vw,78vh)] rounded-full border border-white/30 shadow-[0_0_90px_rgba(138,180,248,0.38)]"
        style={{
          backgroundImage: `radial-gradient(circle at 34% 28%, rgba(255,255,255,0.34), transparent 24%), url(${EARTH_TEXTURE_URL})`,
          backgroundPosition: "center",
          backgroundSize: "cover",
          boxShadow:
            "inset -70px -40px 90px rgba(2,6,23,0.62), 0 0 110px rgba(138,180,248,0.34)"
        }}
      />
    </div>
  );
}

function WebGlFallback() {
  return (
    <section className="relative min-h-[calc(100vh-120px)] overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 shadow-sm lg:min-h-[calc(100vh-32px)]">
      <StaticEarthFallback />
      <div className="absolute left-4 top-4 z-10 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white shadow-sm backdrop-blur-xl">
        Forecasting
      </div>
    </section>
  );
}

export function GlobeScene({
  factories,
  warehouses,
  containers,
  routes
}: GlobeSceneProps) {
  const shellRef = useRef<HTMLElement | null>(null);
  const globeRef = useRef<GlobeApi | undefined>(undefined);
  const dragRef = useRef<{ x: number; y: number; rotationX: number; rotationY: number } | null>(null);
  const [selection, setSelection] = useState<LogisticsSelection | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [webGlSupported, setWebGlSupported] = useState(true);
  const [size, setSize] = useState({ width: 1200, height: 720 });
  const [manualRotation, setManualRotation] = useState({ x: 8, y: 158 });
  const [containerPositions, setContainerPositions] = useState(() =>
    containers.map((container) => ({
      container,
      position: getContainerPosition(container)
    }))
  );

  useEffect(() => {
    setWebGlSupported(hasWebGlSupport());
  }, []);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    const updateSize = () => {
      const rect = shell.getBoundingClientRect();
      setSize({
        width: Math.max(Math.floor(rect.width), 320),
        height: Math.max(Math.floor(rect.height), 520)
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(shell);
    window.addEventListener("resize", updateSize);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateSize);
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setContainerPositions(
        containers.map((container) => ({
          container,
          position: getContainerPosition(container)
        }))
      );
    }, 60_000);

    return () => window.clearInterval(interval);
  }, [containers]);

  useEffect(() => {
    if (!isReady || !globeRef.current) return;

    const globe = globeRef.current;
    globe.pointOfView({ lat: 36, lng: -158, altitude: 2.25 }, 600);

    const controls = globe.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.22;
    controls.enableDamping = true;
    controls.enableRotate = true;
    controls.enableZoom = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.75;
    controls.zoomSpeed = 0.7;
  }, [isReady]);

  const points = useMemo<GlobePoint[]>(() => {
    const factoryPoints = factories.map((factory) => ({
      id: factory.id,
      lat: factory.lat,
      lng: factory.lng,
      altitude: 0.03,
      radius: 0.42,
      color: "#fbbc04",
      label: factory.name,
      kind: "factory" as const
    }));

    const warehousePoints = warehouses.map((warehouse) => ({
      id: warehouse.id,
      lat: warehouse.lat,
      lng: warehouse.lng,
      altitude: 0.04,
      radius: 0.52,
      color: "#34a853",
      label: warehouse.name,
      kind: "warehouse" as const,
      warehouse
    }));

    const containerPoints = containerPositions.map(({ container, position }) => ({
      id: container.id,
      lat: position.lat,
      lng: position.lng,
      altitude: 0.09,
      radius: 0.4,
      color: "#8ab4f8",
      label: container.containerNumber,
      kind: "container" as const,
      container
    }));

    return [...factoryPoints, ...warehousePoints, ...containerPoints];
  }, [containerPositions, factories, warehouses]);

  const arcs = useMemo<GlobeArc[]>(
    () =>
      routes.map((route) => ({
        id: route.id,
        startLat: route.origin.lat,
        startLng: route.origin.lng,
        endLat: route.destination.lat,
        endLng: route.destination.lng,
        color: ["rgba(138, 180, 248, 0.15)", "rgba(138, 180, 248, 0.95)"]
      })),
    [routes]
  );

  const projectedPoints = useMemo<ProjectedMarker[]>(
    () =>
      points.map((point) => ({
        ...point,
        ...projectPoint(point, manualRotation, size)
      })),
    [manualRotation, points, size]
  );

  const projectedArcs = useMemo(
    () =>
      arcs.map((arc) => ({
        id: arc.id,
        origin: projectPoint({ lat: arc.startLat, lng: arc.startLng }, manualRotation, size),
        destination: projectPoint({ lat: arc.endLat, lng: arc.endLng }, manualRotation, size)
      })),
    [arcs, manualRotation, size]
  );

  function openWarehouse(warehouse: LogisticsWarehouse) {
    setManualRotation({ x: 8, y: -warehouse.lng });
    globeRef.current?.pointOfView(
      { lat: warehouse.lat, lng: warehouse.lng, altitude: 1.35 },
      1100
    );
    setSelection({ type: "warehouse", item: warehouse });
  }

  function focusPoint(point: GlobePoint) {
    setManualRotation({ x: Math.max(-28, Math.min(28, point.lat * -0.18)), y: -point.lng });
  }

  function handlePointClick(point: object) {
    const globePoint = point as GlobePoint;

    if (globePoint.kind === "warehouse" && globePoint.warehouse) {
      openWarehouse(globePoint.warehouse);
      return;
    }

    if (globePoint.kind === "container" && globePoint.container) {
      focusPoint(globePoint);
      globeRef.current?.pointOfView(
        { lat: globePoint.lat, lng: globePoint.lng, altitude: 1.45 },
        1000
      );
      setSelection({ type: "container", item: globePoint.container });
      return;
    }

    focusPoint(globePoint);
    globeRef.current?.pointOfView(
      { lat: globePoint.lat, lng: globePoint.lng, altitude: 1.45 },
      1000
    );
    setSelection(null);
  }

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      rotationX: manualRotation.x,
      rotationY: manualRotation.y
    };
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    if (!dragRef.current) return;

    const deltaX = event.clientX - dragRef.current.x;
    const deltaY = event.clientY - dragRef.current.y;
    setManualRotation({
      x: Math.max(-35, Math.min(35, dragRef.current.rotationX - deltaY * 0.18)),
      y: dragRef.current.rotationY + deltaX * 0.28
    });
  }

  function onPointerUp(event: PointerEvent<HTMLElement>) {
    event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
  }

  function createMarkerElement(point: object) {
    const globePoint = point as GlobePoint;
    const marker = document.createElement("button");
    const isContainer = globePoint.kind === "container";

    marker.type = "button";
    marker.title = globePoint.label;
    marker.setAttribute("aria-label", globePoint.label);
    marker.className =
      "grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-white/25 shadow-[0_0_20px_rgba(255,255,255,0.55)] backdrop-blur-sm transition hover:scale-110";
    marker.style.cursor = "pointer";

    const dot = document.createElement("span");
    dot.className = isContainer ? "block h-3 w-3 rounded-full" : "block h-4 w-4 rounded-full";
    dot.style.backgroundColor = globePoint.color;
    dot.style.boxShadow = `0 0 18px ${globePoint.color}`;

    marker.appendChild(dot);
    marker.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      handlePointClick(globePoint);
    });

    return marker;
  }

  if (!webGlSupported) {
    return <WebGlFallback />;
  }

  return (
    <section
      className="relative min-h-[calc(100vh-120px)] overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 shadow-sm lg:min-h-[calc(100vh-32px)]"
      ref={shellRef}
    >
      <StaticEarthFallback />

      <div
        className="absolute inset-0 z-[3] cursor-grab touch-none overflow-hidden active:cursor-grabbing"
        onPointerCancel={onPointerUp}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <div
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 h-[min(78vw,78vh)] w-[min(78vw,78vh)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/30 shadow-[0_0_90px_rgba(138,180,248,0.38)]"
          style={{
            backgroundImage: `radial-gradient(circle at 34% 28%, rgba(255,255,255,0.34), transparent 24%), url(${EARTH_TEXTURE_URL})`,
            backgroundPosition: `${50 - manualRotation.y / 3.6}% ${50 + manualRotation.x / 2}%`,
            backgroundSize: "auto 100%",
            boxShadow:
              "inset -70px -40px 90px rgba(2,6,23,0.62), 0 0 110px rgba(138,180,248,0.34)"
          }}
        />

        <svg className="pointer-events-none absolute inset-0 h-full w-full">
          {projectedArcs.map((arc) =>
            arc.origin.visible || arc.destination.visible ? (
              <path
                d={`M ${arc.origin.x} ${arc.origin.y} Q ${size.width / 2} ${size.height * 0.22} ${arc.destination.x} ${arc.destination.y}`}
                fill="none"
                key={arc.id}
                stroke="rgba(138, 180, 248, 0.72)"
                strokeDasharray="8 8"
                strokeWidth="2"
              />
            ) : null
          )}
        </svg>

        {projectedPoints.map((point) =>
          point.visible ? (
            <button
              className="absolute grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-white/25 shadow-[0_0_20px_rgba(255,255,255,0.55)] backdrop-blur-sm transition hover:scale-110"
              key={point.id}
              onClick={(event) => {
                event.stopPropagation();
                handlePointClick(point);
              }}
              style={{
                left: point.x,
                top: point.y
              }}
              title={point.label}
              type="button"
            >
              <span
                className={point.kind === "container" ? "block h-3 w-3 rounded-full" : "block h-4 w-4 rounded-full"}
                style={{
                  backgroundColor: point.color,
                  boxShadow: `0 0 18px ${point.color}`
                }}
              />
              <span className="pointer-events-none absolute left-9 top-1/2 hidden min-w-max -translate-y-1/2 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-slate-900 shadow-lg lg:block">
                {point.label}
              </span>
            </button>
          ) : null
        )}
      </div>

      <div className="pointer-events-none absolute inset-0 z-[1] opacity-0">
        <Globe
          ref={globeRef}
          width={size.width}
          height={size.height}
          animateIn={false}
          waitForGlobeReady={false}
          enablePointerInteraction
          backgroundColor="rgba(2, 6, 23, 0)"
          globeImageUrl={EARTH_TEXTURE_URL}
          bumpImageUrl={EARTH_BUMP_URL}
          showGlobe
          showAtmosphere
          atmosphereColor="#8ab4f8"
          atmosphereAltitude={0.16}
          arcsData={arcs}
          arcColor="color"
          arcDashLength={0.55}
          arcDashGap={0.25}
          arcDashAnimateTime={2800}
          arcAltitude={0.24}
          arcStroke={1.1}
          pointsData={points}
          pointAltitude="altitude"
          pointRadius="radius"
          pointColor="color"
          htmlElementsData={points}
          htmlLat="lat"
          htmlLng="lng"
          htmlAltitude="altitude"
          htmlElement={createMarkerElement}
          labelsData={points}
          labelLat="lat"
          labelLng="lng"
          labelAltitude={(point: object) => (point as GlobePoint).altitude + 0.02}
          labelText="label"
          labelSize={0.78}
          labelDotRadius={0}
          labelColor={() => "rgba(255,255,255,0.92)"}
          onPointClick={handlePointClick}
          onGlobeClick={() => setSelection(null)}
          onGlobeReady={() => setIsReady(true)}
        />
      </div>

      <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white shadow-sm backdrop-blur-xl">
        Forecasting
      </div>

      <div className="absolute bottom-4 left-4 right-4 z-10 flex flex-wrap gap-2">
        {warehouses.map((warehouse) => (
          <button
            className="rounded-full border border-white/20 bg-white/90 px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm backdrop-blur-xl hover:bg-white"
            key={warehouse.id}
            onClick={() => openWarehouse(warehouse)}
            type="button"
          >
            {warehouse.city}
          </button>
        ))}
      </div>

      {selection ? (
        <LogisticsDetailsPanel onClose={() => setSelection(null)} selection={selection} />
      ) : null}
    </section>
  );
}
