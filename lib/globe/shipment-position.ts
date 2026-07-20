import type { LogisticsCoordinate, LogisticsContainer } from "@/types/logistics";

export type ShipmentPosition = LogisticsCoordinate & {
  progress: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function toDegrees(value: number) {
  return (value * 180) / Math.PI;
}

export function getShipmentProgress(
  departureAt: string,
  estimatedArrivalAt: string,
  now = new Date()
) {
  const departure = new Date(departureAt).getTime();
  const arrival = new Date(estimatedArrivalAt).getTime();
  const current = now.getTime();

  if (!Number.isFinite(departure) || !Number.isFinite(arrival) || arrival <= departure) {
    return 0;
  }

  return clamp((current - departure) / (arrival - departure), 0, 1);
}

export function interpolateGreatCircle(
  origin: LogisticsCoordinate,
  destination: LogisticsCoordinate,
  progress: number
): LogisticsCoordinate {
  const lat1 = toRadians(origin.lat);
  const lng1 = toRadians(origin.lng);
  const lat2 = toRadians(destination.lat);
  const lng2 = toRadians(destination.lng);

  const delta = 2 * Math.asin(
    Math.sqrt(
      Math.sin((lat2 - lat1) / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin((lng2 - lng1) / 2) ** 2
    )
  );

  if (delta === 0) {
    return origin;
  }

  const boundedProgress = clamp(progress, 0, 1);
  const originWeight = Math.sin((1 - boundedProgress) * delta) / Math.sin(delta);
  const destinationWeight = Math.sin(boundedProgress * delta) / Math.sin(delta);
  const x =
    originWeight * Math.cos(lat1) * Math.cos(lng1) +
    destinationWeight * Math.cos(lat2) * Math.cos(lng2);
  const y =
    originWeight * Math.cos(lat1) * Math.sin(lng1) +
    destinationWeight * Math.cos(lat2) * Math.sin(lng2);
  const z = originWeight * Math.sin(lat1) + destinationWeight * Math.sin(lat2);

  return {
    lat: toDegrees(Math.atan2(z, Math.sqrt(x * x + y * y))),
    lng: toDegrees(Math.atan2(y, x))
  };
}

export function getContainerPosition(
  container: LogisticsContainer,
  now = new Date()
): ShipmentPosition {
  const progress = getShipmentProgress(
    container.departure_at,
    container.estimated_arrival_at,
    now
  );
  const coordinate = interpolateGreatCircle(container.origin, container.destination, progress);

  return {
    ...coordinate,
    progress
  };
}
