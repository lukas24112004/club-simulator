// The rules (src/core) think in pixels. The 3D world thinks in metres.
// 1 px = 0.02 m, so the 1200x700 px room becomes a 24 m x 14 m club.
// Sim x -> world X (east), sim y -> world Z (towards the entrance), y axis is up.

export const S = 0.02;
export const toWorldX = (x: number): number => (x - 800) * S;
export const toWorldZ = (y: number): number => (y - 500) * S;

export const ROOM3 = { halfW: 12, halfD: 7, height: 4.6 };

export interface Box {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}
