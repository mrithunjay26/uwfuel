export interface FanPoint {
  lat: number;
  lng: number;
}

export const SAME_SPOT_RADIUS_M = 15;

export function fanOutOffsets(points: (FanPoint | null | undefined)[]): Map<number, [number, number]> {
  const groups = new Map<string, number[]>();
  points.forEach((p, i) => {
    if (!p) return;
    const key = p.lat.toFixed(5) + "," + p.lng.toFixed(5);
    const members = groups.get(key) ?? [];
    members.push(i);
    groups.set(key, members);
  });

  const out = new Map<number, [number, number]>();
  groups.forEach((members) => {
    if (members.length < 2) return;
    members.forEach((idx, n) => {
      const p = points[idx]!;
      const angle = (2 * Math.PI * n) / members.length - Math.PI / 2;
      const dLat = (SAME_SPOT_RADIUS_M * Math.sin(angle)) / 111320;
      const dLng =
        (SAME_SPOT_RADIUS_M * Math.cos(angle)) /
        (111320 * Math.max(0.2, Math.cos((p.lat * Math.PI) / 180)));
      out.set(idx, [p.lat + dLat, p.lng + dLng]);
    });
  });
  return out;
}
