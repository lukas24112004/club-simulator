// All the numbers that shape the game live here, so balancing never means hunting through logic.
// Nothing in src/core imports Phaser: the rules can run (and be tested) without a browser.

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ---- Layout (world pixels) ----
export const WORLD = { width: 1600, height: 1000 };
export const ROOM: Rect = { x: 200, y: 150, w: 1200, h: 700 };
export const DOOR_WIDTH = 120;
export const DOOR: Point = { x: 800, y: ROOM.y + ROOM.h }; // centre of the gap in the bottom wall
export const OUTSIDE: Point = { x: 800, y: 960 }; // guests appear and disappear here
export const ENTRY_POINT: Point = { x: 800, y: 800 }; // where guests pay the entrance fee

export const BAR: Rect = { x: 260, y: 190, w: 480, h: 36 };
export const BAR_QUEUE_START: Point = { x: 300, y: 262 };
export const BAR_QUEUE_SPACING = 24;
export const BAR_QUEUE_PER_ROW = 8;
export const BARTENDER_Y = 172;
export const BARTENDER_X0 = 330;
export const BARTENDER_SPACING = 100;

export const DANCE_FLOOR: Rect = { x: 780, y: 340, w: 560, h: 400 };

// ---- Guests ----
export const MAX_GUESTS = 60;
export const BASE_SPAWN_INTERVAL = 2.2; // seconds between arrivals at the lowest entrance price
export const WALK_SPEED = 95; // px/s
export const DANCE_SPEED = 28;
export const DANCE_TIME: [number, number] = [8, 18];
export const DRINKS_WANTED: [number, number] = [1, 3];
export const PATIENCE = 30; // seconds a guest waits in the bar queue before giving up

// ---- Bar ----
export const DRINK_PRICE = 6;
export const SERVE_TIME = 2.2; // seconds a bartender needs per drink

// ---- Upgrades ----
export type UpgradeId = 'bartenders' | 'doorPrice';

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  description: string;
  costs: number[]; // cost of each level; length = max level
}

export const UPGRADES: UpgradeDef[] = [
  {
    id: 'bartenders',
    name: 'Hire a bartender',
    description: 'Serves drinks in parallel. Shorter queues.',
    costs: [120, 300, 650],
  },
  {
    id: 'doorPrice',
    name: 'Raise entrance price',
    description: 'More money per guest, slightly fewer guests.',
    costs: [60, 200, 500],
  },
];

export const DOOR_PRICES = [5, 8, 12, 18]; // indexed by doorPrice level
export const DOOR_ARRIVAL_SLOWDOWN = [1, 1.15, 1.4, 1.8]; // spawn interval multiplier per level

export const SAVE_KEY = 'club-simulator-save';
export const SAVE_VERSION = 1;
