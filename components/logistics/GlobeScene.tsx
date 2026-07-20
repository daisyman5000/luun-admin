"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { LogisticsDetailsPanel } from "@/components/logistics/LogisticsDetailsPanel";
import {
  getShipmentProgress,
  interpolateGreatCircle
} from "@/lib/globe/shipment-position";
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

type HitArea =
  | { type: "warehouse"; id: string; x: number; y: number; radius: number; z: number }
  | { type: "container"; id: string; x: number; y: number; radius: number; z: number };

type ViewState = {
  centerLat: number;
  centerLng: number;
  dragging: boolean;
  dragMoved: boolean;
  dragStartLat: number;
  dragStartLng: number;
  dragStartX: number;
  dragStartY: number;
  height: number;
  hitAreas: HitArea[];
  lastFrame: number;
  renderedLat: number;
  renderedLng: number;
  sphereReady: boolean;
  width: number;
  zoom: number;
};

const EARTH_TEXTURE_URL = "/luun-earth-texture.jpg";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

function normalizeDegrees(value: number) {
  return ((((value + 180) % 360) + 360) % 360) - 180;
}

function inventoryTotal(inventory: { corner: number; armless: number; ottoman: number }) {
  return inventory.corner + inventory.armless + inventory.ottoman;
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function normalize3(x: number, y: number, z: number) {
  const length = Math.hypot(x, y, z) || 1;
  return { x: x / length, y: y / length, z: z / length };
}

export function GlobeScene({
  factories,
  warehouses,
  containers
}: GlobeSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLElement | null>(null);
  const viewRef = useRef<ViewState>({
    centerLat: 24,
    centerLng: 171,
    dragging: false,
    dragMoved: false,
    dragStartLat: 0,
    dragStartLng: 0,
    dragStartX: 0,
    dragStartY: 0,
    height: 1,
    hitAreas: [],
    lastFrame: 0,
    renderedLat: 24,
    renderedLng: 171,
    sphereReady: false,
    width: 1,
    zoom: 1
  });
  const [selection, setSelection] = useState<LogisticsSelection | null>(null);

  const globeData = useMemo(() => {
    const locationMap = new Map<string, LogisticsFactory | LogisticsWarehouse>();
    factories.forEach((factory) => locationMap.set(factory.id, factory));
    warehouses.forEach((warehouse) => locationMap.set(warehouse.id, warehouse));

    return {
      containers,
      factories,
      locationMap,
      warehouses
    };
  }, [containers, factories, warehouses]);

  useEffect(() => {
    if (!canvasRef.current || !stageRef.current) return;
    const canvasElement = canvasRef.current as HTMLCanvasElement;
    const stageElement = stageRef.current as HTMLElement;

    const maybeContext = canvasElement.getContext("2d", { alpha: true });
    if (!maybeContext) return;
    const ctx = maybeContext as CanvasRenderingContext2D;

    const view = viewRef.current;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const sphereCanvas = document.createElement("canvas");
    const maybeSphereContext = sphereCanvas.getContext("2d", { alpha: true });
    const sphereSize = 560;
    sphereCanvas.width = sphereSize;
    sphereCanvas.height = sphereSize;

    if (!maybeSphereContext) return;
    const sphereCtx = maybeSphereContext as CanvasRenderingContext2D;

    let animationFrame = 0;
    let sourcePixels: Uint8ClampedArray | null = null;
    let sourceWidth = 0;
    let sourceHeight = 0;
    let rayX: Float32Array | null = null;
    let rayY: Float32Array | null = null;
    let rayZ: Float32Array | null = null;
    let rayShade: Float32Array | null = null;
    let rayIndices: Int32Array | null = null;
    const sphereImageData = sphereCtx.createImageData(sphereSize, sphereSize);

    function resize() {
      const rect = stageElement.getBoundingClientRect();
      view.width = Math.max(1, rect.width);
      view.height = Math.max(1, rect.height);
      canvasElement.width = Math.round(view.width * dpr);
      canvasElement.height = Math.round(view.height * dpr);
      canvasElement.style.width = `${view.width}px`;
      canvasElement.style.height = `${view.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function globeGeometry() {
      const mobile = view.width < 640;
      const radius =
        Math.min(
          view.width * (mobile ? 0.43 : 0.39),
          view.height * (mobile ? 0.36 : 0.43),
          mobile ? 235 : 420
        ) * view.zoom;
      return {
        cx: view.width * (mobile ? 0.5 : 0.49),
        cy: view.height * (mobile ? 0.54 : 0.52),
        radius
      };
    }

    function buildRayCache() {
      const total = sphereSize * sphereSize;
      rayX = new Float32Array(total);
      rayY = new Float32Array(total);
      rayZ = new Float32Array(total);
      rayShade = new Float32Array(total);
      const valid: number[] = [];
      const radius = sphereSize / 2 - 2;
      const center = sphereSize / 2;
      const light = normalize3(-0.46, 0.58, 0.82);

      for (let py = 0; py < sphereSize; py += 1) {
        for (let px = 0; px < sphereSize; px += 1) {
          const index = py * sphereSize + px;
          const x = (px + 0.5 - center) / radius;
          const y = -(py + 0.5 - center) / radius;
          const r2 = x * x + y * y;
          if (r2 <= 1) {
            const z = Math.sqrt(Math.max(0, 1 - r2));
            rayX[index] = x;
            rayY[index] = y;
            rayZ[index] = z;
            const lightDot = Math.max(0, x * light.x + y * light.y + z * light.z);
            const rim = Math.pow(Math.max(0, 1 - z), 2.1);
            rayShade[index] = 0.44 + 0.56 * Math.pow(lightDot, 0.72) + rim * 0.045;
            valid.push(index);
          }
        }
      }
      rayIndices = Int32Array.from(valid);
    }

    function renderSphere() {
      if (!sourcePixels || !rayX || !rayY || !rayZ || !rayShade || !rayIndices) return;

      view.renderedLng = view.centerLng;
      view.renderedLat = view.centerLat;
      const lng0 = degreesToRadians(view.renderedLng);
      const lat0 = degreesToRadians(view.renderedLat);
      const sinLat0 = Math.sin(lat0);
      const cosLat0 = Math.cos(lat0);
      const output = sphereImageData.data;
      output.fill(0);

      for (let n = 0; n < rayIndices.length; n += 1) {
        const index = rayIndices[n];
        const x = rayX[index];
        const y = rayY[index];
        const z = rayZ[index];
        const latitude = Math.asin(clamp(y * cosLat0 + z * sinLat0, -1, 1));
        let longitude = lng0 + Math.atan2(x, z * cosLat0 - y * sinLat0);
        longitude = ((((longitude + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;
        const u = (longitude + Math.PI) / (Math.PI * 2);
        const v = (Math.PI / 2 - latitude) / Math.PI;
        const sx = Math.min(sourceWidth - 1, Math.max(0, Math.floor(u * sourceWidth)));
        const sy = Math.min(sourceHeight - 1, Math.max(0, Math.floor(v * sourceHeight)));
        const sourceIndex = (sy * sourceWidth + sx) * 4;
        const outputIndex = index * 4;
        const shade = rayShade[index];
        const edgeAlpha = clamp(z / 0.035, 0, 1);
        const sr = sourcePixels[sourceIndex];
        const sg = sourcePixels[sourceIndex + 1];
        const sb = sourcePixels[sourceIndex + 2];
        const blueDominance = clamp((sb - (sr + sg) * 0.42) / 135, 0, 1);
        const specular =
          blueDominance * Math.pow(Math.max(0, x * -0.46 + y * 0.58 + z * 0.82), 18) * 42;

        output[outputIndex] = clamp((sr * 0.72 + 7) * shade + specular, 0, 255);
        output[outputIndex + 1] = clamp((sg * 0.78 + 8) * shade + specular, 0, 255);
        output[outputIndex + 2] = clamp((sb * 0.93 + 13) * shade + specular * 1.15, 0, 255);
        output[outputIndex + 3] = 255 * edgeAlpha;
      }

      sphereCtx.putImageData(sphereImageData, 0, 0);
      view.sphereReady = true;
    }

    function project(lat: number, lng: number, geometry = globeGeometry()) {
      const phi = degreesToRadians(lat);
      const deltaLambda = degreesToRadians(normalizeDegrees(lng - view.renderedLng));
      const phi0 = degreesToRadians(view.renderedLat);
      const cosPhi = Math.cos(phi);
      const sinPhi = Math.sin(phi);
      const cosPhi0 = Math.cos(phi0);
      const sinPhi0 = Math.sin(phi0);
      const cosDelta = Math.cos(deltaLambda);
      const x = cosPhi * Math.sin(deltaLambda);
      const y = cosPhi0 * sinPhi - sinPhi0 * cosPhi * cosDelta;
      const z = sinPhi0 * sinPhi + cosPhi0 * cosPhi * cosDelta;
      return {
        visible: z > 0,
        x: geometry.cx + geometry.radius * x,
        y: geometry.cy - geometry.radius * y,
        z
      };
    }

    function drawGeoLine(points: Array<{ lat: number; lng: number }>, geometry: ReturnType<typeof globeGeometry>) {
      let drawing = false;
      ctx.beginPath();
      for (const point of points) {
        const projected = project(point.lat, point.lng, geometry);
        if (projected.visible) {
          if (!drawing) {
            ctx.moveTo(projected.x, projected.y);
            drawing = true;
          } else {
            ctx.lineTo(projected.x, projected.y);
          }
        } else {
          drawing = false;
        }
      }
      ctx.stroke();
    }

    function drawGraticules(geometry: ReturnType<typeof globeGeometry>) {
      ctx.save();
      ctx.lineWidth = 0.62;
      ctx.strokeStyle = "rgba(229, 242, 238, 0.075)";
      ctx.setLineDash([2, 5]);

      for (let lat = -60; lat <= 60; lat += 20) {
        drawGeoLine(
          Array.from({ length: 121 }, (_, index) => ({ lat, lng: -180 + index * 3 })),
          geometry
        );
      }

      for (let lng = -180; lng < 180; lng += 20) {
        drawGeoLine(
          Array.from({ length: 61 }, (_, index) => ({ lat: -90 + index * 3, lng })),
          geometry
        );
      }
      ctx.restore();
    }

    function routePoints(container: LogisticsContainer, count: number) {
      return Array.from({ length: count }, (_, index) =>
        interpolateGreatCircle(container.origin, container.destination, index / (count - 1))
      );
    }

    function drawRouteSegment(
      points: Array<{ lat: number; lng: number }>,
      progress: number,
      geometry: ReturnType<typeof globeGeometry>,
      style: { color: string; width: number; dash: number[]; dashOffset: number }
    ) {
      const maximumIndex = Math.max(1, Math.floor((points.length - 1) * clamp(progress, 0, 1)));
      ctx.save();
      ctx.strokeStyle = style.color;
      ctx.lineWidth = style.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.setLineDash(style.dash);
      ctx.lineDashOffset = style.dashOffset;
      ctx.shadowColor = style.color;
      ctx.shadowBlur = style.width > 2 ? 8 : 3;

      let drawing = false;
      ctx.beginPath();
      for (let index = 0; index <= maximumIndex; index += 1) {
        const point = points[index];
        const projected = project(point.lat, point.lng, geometry);
        if (projected.z > 0.015) {
          if (!drawing) {
            ctx.moveTo(projected.x, projected.y);
            drawing = true;
          } else {
            ctx.lineTo(projected.x, projected.y);
          }
        } else {
          drawing = false;
        }
      }
      ctx.stroke();
      ctx.restore();
    }

    function drawRoutes(geometry: ReturnType<typeof globeGeometry>, now: number) {
      globeData.containers.forEach((container) => {
        const selectedRoute =
          selection?.type === "container" && selection.item.id === container.id;
        const progress = getShipmentProgress(
          container.departure_at,
          container.estimated_arrival_at
        );
        const points = routePoints(container, 90);
        drawRouteSegment(points, 1, geometry, {
          color: selectedRoute ? "rgba(255, 196, 118, 0.52)" : "rgba(255, 189, 106, 0.25)",
          dash: [5, 8],
          dashOffset: -(now * 0.018) % 26,
          width: selectedRoute ? 2.1 : 1.25
        });

        if (progress > 0) {
          drawRouteSegment(points, progress, geometry, {
            color: selectedRoute ? "rgba(255, 210, 154, 0.98)" : "rgba(255, 189, 106, 0.72)",
            dash: [],
            dashOffset: 0,
            width: selectedRoute ? 2.4 : 1.6
          });
        }
      });
    }

    function drawCanvasLabel(
      x: number,
      y: number,
      text: string,
      options: { accent: string; opacity?: number; selected?: boolean }
    ) {
      ctx.save();
      ctx.globalAlpha = options.opacity ?? 1;
      ctx.font = options.selected ? "600 10px Inter, sans-serif" : "550 9px Inter, sans-serif";
      const textWidth = ctx.measureText(text).width;
      const labelWidth = textWidth + 23;
      const labelHeight = options.selected ? 27 : 24;
      const left = clamp(x, 8, Math.max(8, view.width - labelWidth - 24));

      ctx.fillStyle = options.selected ? "rgba(8, 10, 11, 0.92)" : "rgba(8, 10, 11, 0.76)";
      ctx.strokeStyle = options.selected ? "rgba(255, 255, 255, 0.18)" : "rgba(255, 255, 255, 0.09)";
      ctx.lineWidth = 1;
      roundedRectPath(ctx, left, y, labelWidth, labelHeight, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = options.accent;
      ctx.beginPath();
      ctx.arc(left + 9, y + labelHeight / 2, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(237, 239, 235, 0.93)";
      ctx.textBaseline = "middle";
      ctx.fillText(text, left + 16, y + labelHeight / 2 + 0.5);
      ctx.restore();
    }

    function drawLocations(geometry: ReturnType<typeof globeGeometry>, now: number) {
      [...globeData.warehouses, ...globeData.factories].forEach((location) => {
        const projected = project(location.lat, location.lng, geometry);
        if (projected.z <= 0.02) return;

        const isWarehouse = "availableInventory" in location;
        const warehouse = isWarehouse ? (location as LogisticsWarehouse) : null;
        const inventory = isWarehouse
          ? warehouse!.availableInventory.reduce(
              (totals: { armless: number; corner: number; ottoman: number }, row) => {
                totals[row.module] += row.quantity;
                return totals;
              },
              { armless: 0, corner: 0, ottoman: 0 }
            )
          : { armless: 0, corner: 0, ottoman: 0 };
        const total = inventoryTotal(inventory);
        const isSelected = selection?.type === "warehouse" && selection.item.id === location.id;
        const opacity = clamp((projected.z - 0.01) / 0.18, 0, 1);
        const pulse = 1 + Math.sin(now * 0.0035 + location.lng) * 0.12;
        const markerRadius = isSelected ? 6.5 : 5.2;

        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.strokeStyle = isWarehouse
          ? `rgba(200, 247, 127, ${isSelected ? 0.65 : 0.28})`
          : "rgba(255, 189, 106, 0.28)";
        ctx.lineWidth = isSelected ? 1.5 : 1;
        ctx.beginPath();
        ctx.arc(projected.x, projected.y, (14 + (isSelected ? 6 : 2)) * pulse, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(projected.x, projected.y, markerRadius, 0, Math.PI * 2);
        ctx.fillStyle = isWarehouse ? "#c8f77f" : "#ffbd6a";
        ctx.shadowColor = isWarehouse ? "rgba(200, 247, 127, 0.65)" : "rgba(255, 189, 106, 0.58)";
        ctx.shadowBlur = 14;
        ctx.fill();
        ctx.restore();

        if (isWarehouse || projected.z > 0.24) {
          drawCanvasLabel(
            projected.x + 10,
            projected.y - 21,
            `${location.city} ${isWarehouse ? total : ""}`.trim(),
            {
              accent: isWarehouse ? "#c8f77f" : "#ffbd6a",
              opacity,
              selected: isSelected
            }
          );
        }

        if (isWarehouse) {
          view.hitAreas.push({
            id: location.id,
            radius: 30,
            type: "warehouse",
            x: projected.x,
            y: projected.y,
            z: projected.z
          });
        }
      });
    }

    function drawContainerMarkers(geometry: ReturnType<typeof globeGeometry>, now: number) {
      globeData.containers.forEach((container, routeIndex) => {
        const progress = getShipmentProgress(
          container.departure_at,
          container.estimated_arrival_at
        );
        if (progress >= 1) return;

        const visualProgress =
          progress > 0
            ? clamp(progress + Math.sin(now * 0.00055 + routeIndex * 1.7) * 0.006, 0, 0.995)
            : progress;
        const point = interpolateGreatCircle(container.origin, container.destination, visualProgress);
        const projected = project(point.lat, point.lng, geometry);
        if (projected.z <= 0.025) return;

        const selectedRoute =
          selection?.type === "container" && selection.item.id === container.id;
        const opacity = clamp((projected.z - 0.015) / 0.16, 0, 1);
        const nextPoint = interpolateGreatCircle(
          container.origin,
          container.destination,
          clamp(visualProgress + 0.008, 0, 1)
        );
        const nextProjected = project(nextPoint.lat, nextPoint.lng, geometry);
        const angle = Math.atan2(nextProjected.y - projected.y, nextProjected.x - projected.x);

        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.translate(projected.x, projected.y);
        ctx.rotate(angle);
        if (selectedRoute) {
          const ringPulse = 14 + Math.sin(now * 0.004) * 2.5;
          ctx.strokeStyle = "rgba(255, 189, 106, 0.48)";
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(0, 0, ringPulse, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.shadowColor = "rgba(255, 189, 106, 0.58)";
        ctx.shadowBlur = 14;
        ctx.fillStyle = selectedRoute ? "#ffd7a5" : "#ffbd6a";
        roundedRectPath(ctx, -8, -4.5, 16, 9, 3);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(25, 19, 12, 0.72)";
        ctx.fillRect(-2, -3, 1.4, 6);
        ctx.fillRect(2, -3, 1.4, 6);
        ctx.restore();

        if (selectedRoute) {
          drawCanvasLabel(
            projected.x + 12,
            projected.y - 25,
            `${container.containerNumber} ${Math.round(progress * 100)}%`,
            { accent: "#ffbd6a", opacity, selected: true }
          );
        }

        view.hitAreas.push({
          id: container.id,
          radius: selectedRoute ? 32 : 28,
          type: "container",
          x: projected.x,
          y: projected.y,
          z: projected.z
        });
      });
    }

    function draw(now: number) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, view.width, view.height);
      view.hitAreas = [];
      const geometry = globeGeometry();
      const { cx, cy, radius } = geometry;

      const glow = ctx.createRadialGradient(cx, cy, radius * 0.58, cx, cy, radius * 1.32);
      glow.addColorStop(0, "rgba(86, 151, 135, 0.13)");
      glow.addColorStop(0.62, "rgba(48, 104, 93, 0.07)");
      glow.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.32, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.clip();
      if (view.sphereReady) {
        ctx.drawImage(sphereCanvas, cx - radius, cy - radius, radius * 2, radius * 2);
      } else {
        const ocean = ctx.createRadialGradient(
          cx - radius * 0.3,
          cy - radius * 0.35,
          radius * 0.1,
          cx,
          cy,
          radius
        );
        ocean.addColorStop(0, "#2e6a78");
        ocean.addColorStop(0.55, "#173844");
        ocean.addColorStop(1, "#09141a");
        ctx.fillStyle = ocean;
        ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
      }
      drawGraticules(geometry);
      drawRoutes(geometry, now);
      ctx.restore();

      const atmosphere = ctx.createRadialGradient(cx, cy, radius * 0.88, cx, cy, radius * 1.075);
      atmosphere.addColorStop(0, "rgba(104, 207, 228, 0)");
      atmosphere.addColorStop(0.68, "rgba(104, 207, 228, 0.035)");
      atmosphere.addColorStop(0.86, "rgba(104, 207, 228, 0.18)");
      atmosphere.addColorStop(1, "rgba(104, 207, 228, 0)");
      ctx.fillStyle = atmosphere;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.075, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(155, 230, 238, 0.16)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 0.5, 0, Math.PI * 2);
      ctx.stroke();

      drawLocations(geometry, now);
      drawContainerMarkers(geometry, now);
    }

    function animate(now: number) {
      const viewChanged =
        Math.abs(normalizeDegrees(view.centerLng - view.renderedLng)) > 0.045 ||
        Math.abs(view.centerLat - view.renderedLat) > 0.045;
      if (viewChanged) renderSphere();
      draw(now);
      animationFrame = requestAnimationFrame(animate);
    }

    function pointerPosition(event: PointerEvent) {
      const rect = canvasElement.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }

    function onPointerDown(event: PointerEvent) {
      const point = pointerPosition(event);
      view.dragging = true;
      view.dragMoved = false;
      view.dragStartX = point.x;
      view.dragStartY = point.y;
      view.dragStartLng = view.centerLng;
      view.dragStartLat = view.centerLat;
      stageElement.classList.add("cursor-grabbing");
      stageElement.setPointerCapture(event.pointerId);
    }

    function onPointerMove(event: PointerEvent) {
      const point = pointerPosition(event);
      if (view.dragging) {
        const dx = point.x - view.dragStartX;
        const dy = point.y - view.dragStartY;
        if (Math.abs(dx) + Math.abs(dy) > 10) view.dragMoved = true;
        view.centerLng = normalizeDegrees(view.dragStartLng - (dx * 0.23) / view.zoom);
        view.centerLat = clamp(view.dragStartLat + (dy * 0.17) / view.zoom, -68, 68);
        return;
      }
      const hit = view.hitAreas.some((area) => Math.hypot(point.x - area.x, point.y - area.y) <= area.radius);
      stageElement.style.cursor = hit ? "pointer" : "grab";
    }

    function onPointerUp(event: PointerEvent) {
      if (!view.dragging) return;
      const point = pointerPosition(event);
      view.dragging = false;
      stageElement.classList.remove("cursor-grabbing");
      if (!view.dragMoved) {
        const hit = view.hitAreas
          .map((area) => ({ ...area, distance: Math.hypot(point.x - area.x, point.y - area.y) }))
          .filter((area) => area.distance <= area.radius)
          .sort((a, b) => a.distance - b.distance || b.z - a.z)[0];

        if (hit?.type === "warehouse") {
          const warehouse = globeData.warehouses.find((item) => item.id === hit.id);
          if (warehouse) setSelection({ type: "warehouse", item: warehouse });
        } else if (hit?.type === "container") {
          const container = globeData.containers.find((item) => item.id === hit.id);
          if (container) setSelection({ type: "container", item: container });
        } else {
          setSelection(null);
        }
      }
      stageElement.releasePointerCapture(event.pointerId);
    }

    function onWheel(event: WheelEvent) {
      event.preventDefault();
      view.zoom = clamp(view.zoom - event.deltaY * 0.00075, 0.76, 1.22);
    }

    const image = new Image();
    image.onload = () => {
      const textureCanvas = document.createElement("canvas");
      textureCanvas.width = image.naturalWidth;
      textureCanvas.height = image.naturalHeight;
      const textureContext = textureCanvas.getContext("2d", { willReadFrequently: true });
      if (!textureContext) return;
      textureContext.drawImage(image, 0, 0);
      const imageData = textureContext.getImageData(0, 0, textureCanvas.width, textureCanvas.height);
      sourcePixels = imageData.data;
      sourceWidth = textureCanvas.width;
      sourceHeight = textureCanvas.height;
      buildRayCache();
      renderSphere();
    };
    image.src = EARTH_TEXTURE_URL;

    const observer = new ResizeObserver(resize);
    observer.observe(stageElement);
    resize();
    animationFrame = requestAnimationFrame(animate);
    stageElement.addEventListener("pointerdown", onPointerDown);
    stageElement.addEventListener("pointermove", onPointerMove);
    stageElement.addEventListener("pointerup", onPointerUp);
    stageElement.addEventListener("pointercancel", onPointerUp);
    stageElement.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
      stageElement.removeEventListener("pointerdown", onPointerDown);
      stageElement.removeEventListener("pointermove", onPointerMove);
      stageElement.removeEventListener("pointerup", onPointerUp);
      stageElement.removeEventListener("pointercancel", onPointerUp);
      stageElement.removeEventListener("wheel", onWheel);
    };
  }, [globeData, selection]);

  return (
    <section
      className="relative min-h-[calc(100vh-120px)] overflow-hidden rounded-3xl border border-slate-800 bg-[#080a0c] shadow-sm lg:min-h-[calc(100vh-32px)]"
      ref={stageRef}
    >
      <canvas
        aria-label="Interactive inventory globe"
        className="absolute inset-0 h-full w-full touch-none"
        ref={canvasRef}
      />
      <div className="pointer-events-none absolute left-4 top-4 z-10 flex flex-wrap gap-2">
        <span className="rounded-full border border-white/10 bg-black/45 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c8f77f] backdrop-blur-xl">
          Live logistics
        </span>
        <span className="rounded-full border border-white/10 bg-black/45 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-300 backdrop-blur-xl">
          Drag to rotate · Scroll to zoom
        </span>
      </div>
      <div className="absolute bottom-4 left-4 right-4 z-10 flex flex-wrap gap-2">
        {warehouses.map((warehouse) => (
          <button
            className="rounded-full border border-white/15 bg-white/90 px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm backdrop-blur-xl hover:bg-white"
            key={warehouse.id}
            onClick={() => {
              viewRef.current.centerLng = warehouse.lng;
              viewRef.current.centerLat = warehouse.lat;
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
