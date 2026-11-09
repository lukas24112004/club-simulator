import * as C from './config';
import { clubRating, createInitialState, maxLevel, type ClubState } from './state';
import type { Point } from './config';

export type GuestPhase = 'arriving' | 'queueing' | 'ordering' | 'toFloor' | 'dancing' | 'leaving';

export interface Guest {
  id: number;
  x: number;
  y: number;
  phase: GuestPhase;
  speed: number;
  colorIndex: number;
  drinksWanted: number;
  drinksBought: number;
  target: Point; // where the guest is currently heading (floor spots)
  timer: number; // dance time left
  wanderTimer: number; // time until the next dance-floor wander
  waited: number; // seconds spent in the bar queue
  bartenderIndex: number; // which bartender is serving us (while ordering)
  atBar: boolean; // standing in front of the bartender
  unhappy: boolean; // left because the queue was too long
  done: boolean; // finished leaving, will be removed
}

export interface Bartender {
  guest: Guest | null;
  timer: number;
}

export interface EarnEvent {
  amount: number;
  x: number;
  y: number;
  kind: 'entrance' | 'drink';
}

export type Rng = () => number;

export interface UpgradeInfo {
  def: C.UpgradeDef;
  level: number;
  max: number;
  nextCost: number | null; // null when maxed out
  affordable: boolean;
}

export class Simulation {
  guests: Guest[] = [];
  barQueue: Guest[] = [];
  bartenders: Bartender[] = [];
  guestsLost = 0;
  /** The view subscribes here to show "+$5" popups. */
  onEarn?: (e: EarnEvent) => void;

  private nextId = 1;
  private spawnTimer = 0.5;

  constructor(
    public readonly state: ClubState = createInitialState(),
    private readonly rng: Rng = Math.random,
  ) {
    this.syncBartenders();
  }

  // ---- Derived values ----

  get bartenderCount(): number {
    return 1 + this.state.upgrades.bartenders;
  }

  get entrancePrice(): number {
    return C.DOOR_PRICES[this.state.upgrades.doorPrice];
  }

  get rating(): number {
    return clubRating(this.state);
  }

  /** A better club draws a bigger crowd: shorter gaps between arrivals... */
  get spawnInterval(): number {
    const popularity = 1 + C.ARRIVAL_PER_RATING * (this.rating - 1);
    return (C.BASE_SPAWN_INTERVAL * C.DOOR_ARRIVAL_SLOWDOWN[this.state.upgrades.doorPrice]) / popularity;
  }

  /** ...and room for more people inside. */
  get maxGuests(): number {
    return Math.min(C.MAX_GUESTS_CAP, C.MAX_GUESTS_BASE + C.MAX_GUESTS_PER_RATING * this.rating);
  }

  // ---- Player actions ----

  upgradeInfo(id: C.UpgradeId): UpgradeInfo {
    const def = C.UPGRADES.find((u) => u.id === id)!;
    const level = this.state.upgrades[id];
    const nextCost = level < def.costs.length ? def.costs[level] : null;
    return {
      def,
      level,
      max: maxLevel(id),
      nextCost,
      affordable: nextCost !== null && this.state.money >= nextCost,
    };
  }

  buyUpgrade(id: C.UpgradeId): boolean {
    const info = this.upgradeInfo(id);
    if (info.nextCost === null || !info.affordable) return false;
    this.state.money -= info.nextCost;
    this.state.upgrades[id] += 1;
    this.syncBartenders();
    return true;
  }

  /** Wipe the club back to day one. */
  reset(): void {
    Object.assign(this.state, createInitialState());
    this.guests = [];
    this.barQueue = [];
    this.bartenders = [];
    this.guestsLost = 0;
    this.spawnTimer = 0.5;
    this.syncBartenders();
  }

  // ---- Main loop ----

  update(dtRaw: number): void {
    const dt = Math.min(dtRaw, 0.25); // a hidden tab must not cause a giant jump

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.guests.length < this.maxGuests) {
      this.spawnGuest();
      this.spawnTimer = this.spawnInterval * (0.7 + 0.6 * this.rng());
    }

    for (const guest of this.guests) this.updateGuest(guest, dt);
    this.updateBar(dt);
    this.guests = this.guests.filter((g) => !g.done);
  }

  // ---- Guests ----

  private spawnGuest(): void {
    const guest: Guest = {
      id: this.nextId++,
      x: C.OUTSIDE.x + (this.rng() - 0.5) * 40,
      y: C.OUTSIDE.y,
      phase: 'arriving',
      speed: C.WALK_SPEED * (0.85 + 0.3 * this.rng()),
      colorIndex: Math.floor(this.rng() * 6),
      drinksWanted: this.randInt(C.DRINKS_WANTED[0], C.DRINKS_WANTED[1]),
      drinksBought: 0,
      target: { x: 0, y: 0 },
      timer: 0,
      wanderTimer: 0,
      waited: 0,
      bartenderIndex: -1,
      atBar: false,
      unhappy: false,
      done: false,
    };
    this.guests.push(guest);
  }

  private updateGuest(g: Guest, dt: number): void {
    switch (g.phase) {
      case 'arriving':
        if (this.moveToward(g, C.ENTRY_POINT, g.speed, dt)) {
          this.earn(this.entrancePrice, g.x, g.y, 'entrance');
          this.state.guestsEntered += 1;
          this.joinQueue(g);
        }
        break;

      case 'queueing': {
        g.waited += dt;
        if (g.waited > C.PATIENCE) {
          this.startLeaving(g, true);
        } else {
          this.moveToward(g, this.queueSlot(this.barQueue.indexOf(g)), g.speed, dt);
        }
        break;
      }

      case 'ordering':
        g.atBar = this.moveToward(g, this.bartenderSpot(g.bartenderIndex), g.speed, dt);
        break;

      case 'toFloor':
        if (this.moveToward(g, g.target, g.speed, dt)) {
          g.phase = 'dancing';
          g.timer = this.randRange(C.DANCE_TIME[0], C.DANCE_TIME[1]);
          g.wanderTimer = 1 + this.rng() * 2;
        }
        break;

      case 'dancing':
        g.timer -= dt;
        g.wanderTimer -= dt;
        if (g.wanderTimer <= 0) {
          g.target = this.randomFloorPoint();
          g.wanderTimer = 2 + this.rng() * 3;
        }
        this.moveToward(g, g.target, C.DANCE_SPEED, dt);
        if (g.timer <= 0) {
          if (g.drinksBought < g.drinksWanted) this.joinQueue(g);
          else this.startLeaving(g, false);
        }
        break;

      case 'leaving': {
        // First to the door, then out into the street.
        const goal = g.y < C.DOOR.y - 2 ? C.DOOR : C.OUTSIDE;
        if (this.moveToward(g, goal, g.speed, dt) && goal === C.OUTSIDE) g.done = true;
        break;
      }
    }
  }

  private joinQueue(g: Guest): void {
    g.phase = 'queueing';
    g.waited = 0;
    g.atBar = false;
    this.barQueue.push(g);
  }

  private startLeaving(g: Guest, unhappy: boolean): void {
    const i = this.barQueue.indexOf(g);
    if (i >= 0) this.barQueue.splice(i, 1);
    g.phase = 'leaving';
    g.unhappy = unhappy;
    if (unhappy) this.guestsLost += 1;
  }

  // ---- Bar ----

  private syncBartenders(): void {
    while (this.bartenders.length < this.bartenderCount) {
      this.bartenders.push({ guest: null, timer: 0 });
    }
  }

  private updateBar(dt: number): void {
    this.bartenders.forEach((b, index) => {
      if (b.guest) {
        const guest = b.guest;
        if (!guest.atBar) return; // still walking up to the bar
        b.timer -= dt;
        if (b.timer <= 0) {
          this.earn(C.DRINK_PRICE, guest.x, guest.y, 'drink');
          guest.drinksBought += 1;
          guest.phase = 'toFloor';
          guest.target = this.randomFloorPoint();
          b.guest = null;
        }
      } else if (this.barQueue.length > 0) {
        const guest = this.barQueue.shift()!;
        guest.phase = 'ordering';
        guest.bartenderIndex = index;
        guest.atBar = false;
        b.guest = guest;
        b.timer = C.SERVE_TIME;
      }
    });
  }

  // ---- Helpers ----

  private earn(amount: number, x: number, y: number, kind: EarnEvent['kind']): void {
    this.state.money += amount;
    this.state.totalEarned += amount;
    this.onEarn?.({ amount, x, y, kind });
  }

  private queueSlot(index: number): Point {
    const i = Math.max(0, index);
    return {
      x: C.BAR_QUEUE_START.x + (i % C.BAR_QUEUE_PER_ROW) * C.BAR_QUEUE_SPACING,
      y: C.BAR_QUEUE_START.y + Math.floor(i / C.BAR_QUEUE_PER_ROW) * C.BAR_QUEUE_SPACING,
    };
  }

  bartenderPosition(index: number): Point {
    return { x: C.BARTENDER_X0 + index * C.BARTENDER_SPACING, y: C.BARTENDER_Y };
  }

  private bartenderSpot(index: number): Point {
    return { x: C.BARTENDER_X0 + index * C.BARTENDER_SPACING, y: C.BAR.y + C.BAR.h + 18 };
  }

  private randomFloorPoint(): Point {
    const f = C.DANCE_FLOOR;
    return { x: f.x + 20 + this.rng() * (f.w - 40), y: f.y + 20 + this.rng() * (f.h - 40) };
  }

  private randRange(min: number, max: number): number {
    return min + this.rng() * (max - min);
  }

  private randInt(min: number, max: number): number {
    return Math.floor(this.randRange(min, max + 1));
  }

  /** Walks a guest toward a point. Returns true when it has arrived. */
  private moveToward(g: Guest, t: Point, speed: number, dt: number): boolean {
    const dx = t.x - g.x;
    const dy = t.y - g.y;
    const dist = Math.hypot(dx, dy);
    const step = speed * dt;
    if (dist <= step) {
      g.x = t.x;
      g.y = t.y;
      return true;
    }
    g.x += (dx / dist) * step;
    g.y += (dy / dist) * step;
    return false;
  }
}
