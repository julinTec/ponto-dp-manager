export interface Coords {
  lat: number;
  lng: number;
}

/** Distance in meters between two coordinates using the Haversine formula. */
export function haversineMeters(a: Coords, b: Coords): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function isWithinRadius(user: Coords, company: Coords, radiusMeters: number): boolean {
  return haversineMeters(user, company) <= radiusMeters;
}
