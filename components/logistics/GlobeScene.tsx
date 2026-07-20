"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Globe from "react-globe.gl";
import * as THREE from "three";

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

type CountryFeature = {
  properties?: {
    ADMIN?: string;
    name?: string;
  };
  geometry: {
    type: string;
    coordinates: unknown;
  };
};

type GlobeControlApi = {
  autoRotate: boolean;
  autoRotateSpeed: number;
  enableDamping: boolean;
  dampingFactor: number;
};

type GlobeApi = {
  pointOfView: (
    pointOfView?: { lat: number; lng: number; altitude: number },
    transitionMs?: number
  ) => { lat: number; lng: number; altitude: number };
  controls: () => GlobeControlApi;
};

const EARTH_TEXTURE_URL = "//unpkg.com/three-globe/example/img/earth-blue-marble.jpg";
const EARTH_BUMP_URL = "//unpkg.com/three-globe/example/img/earth-topology.png";
const SPACE_BACKGROUND_URL = "//unpkg.com/three-globe/example/img/night-sky.png";
const COUNTRIES_URL =
  "https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson";

function WebGlFallback() {
  return (
    <div className="grid h-full min-h-[520px] place-items-center bg-slate-950 px-6 text-center text-white">
      <div>
        <p className="text-lg font-semibold">3D globe unavailable</p>
        <p className="mt-2 max-w-md text-sm text-slate-300">
          This device or browser could not start WebGL. The logistics data is still available from
          the inventory and orders tabs.
        </p>
      </div>
    </div>
  );
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

export function GlobeScene({
  factories,
  warehouses,
  containers,
  routes
}: GlobeSceneProps) {
  const globeRef = useRef<GlobeApi | undefined>(undefined);
  const [selection, setSelection] = useState<LogisticsSelection | null>(null);
  const [countries, setCountries] = useState<CountryFeature[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [webGlSupported, setWebGlSupported] = useState(true);
  const [containerPositions, setContainerPositions] = useState(() =>
    containers.map((container) => ({
      container,
      position: getContainerPosition(container)
    }))
  );
  const globeMaterial = useMemo(() => {
    const material = new THREE.MeshPhongMaterial();
    material.color = new THREE.Color("#ffffff");
    material.shininess = 18;
    material.bumpScale = 8;
    return material;
  }, []);

  useEffect(() => {
    setWebGlSupported(hasWebGlSupport());
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetch(COUNTRIES_URL)
      .then((response) => response.json())
      .then((geoJson: { features?: CountryFeature[] }) => {
        if (!cancelled) setCountries(geoJson.features || []);
      })
      .catch(() => {
        if (!cancelled) setCountries([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;

    globe.pointOfView({ lat: 28, lng: -122, altitude: 1.9 }, 0);
    const controls = globe.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.28;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
  }, [isReady]);

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

  const points = useMemo<GlobePoint[]>(() => {
    const factoryPoints = factories.map((factory) => ({
      id: factory.id,
      lat: factory.lat,
      lng: factory.lng,
      altitude: 0.02,
      radius: 0.34,
      color: "#fbbc04",
      label: factory.name,
      kind: "factory" as const
    }));

    const warehousePoints = warehouses.map((warehouse) => ({
      id: warehouse.id,
      lat: warehouse.lat,
      lng: warehouse.lng,
      altitude: 0.03,
      radius: 0.42,
      color: "#34a853",
      label: warehouse.name,
      kind: "warehouse" as const,
      warehouse
    }));

    const containerPoints = containerPositions.map(({ container, position }) => ({
      id: container.id,
      lat: position.lat,
      lng: position.lng,
      altitude: 0.08,
      radius: 0.3,
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
        color: ["rgba(138, 180, 248, 0.35)", "rgba(255, 255, 255, 0.9)"]
      })),
    [routes]
  );

  function handlePointClick(point: object) {
    const globePoint = point as GlobePoint;

    if (globePoint.kind === "warehouse" && globePoint.warehouse) {
      globeRef.current?.pointOfView(
        { lat: globePoint.lat, lng: globePoint.lng, altitude: 1.25 },
        1200
      );
      setSelection({ type: "warehouse", item: globePoint.warehouse });
      return;
    }

    if (globePoint.kind === "container" && globePoint.container) {
      globeRef.current?.pointOfView(
        { lat: globePoint.lat, lng: globePoint.lng, altitude: 1.35 },
        1000
      );
      setSelection({ type: "container", item: globePoint.container });
      return;
    }

    globeRef.current?.pointOfView(
      { lat: globePoint.lat, lng: globePoint.lng, altitude: 1.3 },
      1000
    );
    setSelection(null);
  }

  if (!webGlSupported) {
    return <WebGlFallback />;
  }

  return (
    <section className="relative min-h-[calc(100vh-120px)] overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 shadow-sm lg:min-h-[calc(100vh-32px)]">
      {!isReady ? (
        <div className="absolute inset-0 z-10 grid place-items-center bg-slate-950 text-white">
          <div className="text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            <p className="mt-4 text-sm font-semibold text-slate-200">Loading globe</p>
          </div>
        </div>
      ) : null}

      <Globe
        ref={globeRef}
        animateIn
        backgroundColor="rgba(2, 6, 23, 1)"
        backgroundImageUrl={SPACE_BACKGROUND_URL}
        globeImageUrl={EARTH_TEXTURE_URL}
        bumpImageUrl={EARTH_BUMP_URL}
        globeMaterial={globeMaterial}
        showAtmosphere
        atmosphereColor="#8ab4f8"
        atmosphereAltitude={0.18}
        polygonsData={countries}
        polygonCapColor={() => "rgba(255, 255, 255, 0)"}
        polygonSideColor={() => "rgba(255, 255, 255, 0)"}
        polygonStrokeColor={() => "rgba(255, 255, 255, 0.32)"}
        arcsData={arcs}
        arcColor="color"
        arcDashLength={0.5}
        arcDashGap={0.2}
        arcDashAnimateTime={2600}
        arcAltitude={0.24}
        arcStroke={0.8}
        pointsData={points}
        pointAltitude="altitude"
        pointRadius="radius"
        pointColor="color"
        labelsData={points}
        labelLat="lat"
        labelLng="lng"
        labelAltitude={(point: object) => (point as GlobePoint).altitude + 0.01}
        labelText="label"
        labelSize={0.7}
        labelDotRadius={0}
        labelColor={() => "rgba(255,255,255,0.9)"}
        onPointClick={handlePointClick}
        onGlobeClick={() => setSelection(null)}
        onGlobeReady={() => setIsReady(true)}
      />

      <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white shadow-sm backdrop-blur-xl">
        Forecasting
      </div>

      <div className="absolute bottom-4 left-4 right-4 z-10 flex flex-wrap gap-2">
        {warehouses.map((warehouse) => (
          <button
            className="rounded-full border border-white/20 bg-white/90 px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm backdrop-blur-xl hover:bg-white"
            key={warehouse.id}
            onClick={() => {
              globeRef.current?.pointOfView(
                { lat: warehouse.lat, lng: warehouse.lng, altitude: 1.25 },
                1200
              );
              setSelection({ type: "warehouse", item: warehouse });
            }}
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
