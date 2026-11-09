import { describe, expect, it } from 'vitest';
import { DOOR_PRICES, MAX_GUESTS, SAVE_KEY, UPGRADES } from './config';
import { clearSave, loadState, saveState, type StorageLike } from './save';
import { Simulation } from './simulation';
import { createInitialState } from './state';

/** Tiny seeded random generator so tests behave the same every run. */
function seeded(seed = 1): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function run(sim: Simulation, seconds: number, step = 0.05): void {
  for (let t = 0; t < seconds; t += step) sim.update(step);
}

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

describe('guests and money', () => {
  it('guests arrive, pay the entrance fee and the club earns money', () => {
    const sim = new Simulation(createInitialState(), seeded());
    run(sim, 30);
    expect(sim.state.guestsEntered).toBeGreaterThan(5);
    expect(sim.state.money).toBeGreaterThanOrEqual(sim.state.guestsEntered * DOOR_PRICES[0]);
  });

  it('guests buy drinks at the bar', () => {
    const sim = new Simulation(createInitialState(), seeded());
    const kinds: string[] = [];
    sim.onEarn = (e) => kinds.push(e.kind);
    run(sim, 60);
    expect(kinds).toContain('drink');
    expect(sim.state.totalEarned).toBeGreaterThan(sim.state.guestsEntered * DOOR_PRICES[0]);
  });

  it('never lets money drop below zero or exceed the guest cap', () => {
    const sim = new Simulation(createInitialState(), seeded(7));
    for (let i = 0; i < 4000; i++) {
      sim.update(0.05);
      expect(sim.guests.length).toBeLessThanOrEqual(MAX_GUESTS);
      expect(sim.state.money).toBeGreaterThanOrEqual(0);
    }
  });

  it('guests eventually leave, so the club does not fill up forever', () => {
    const sim = new Simulation(createInitialState(), seeded(3));
    run(sim, 300);
    expect(sim.guests.length).toBeLessThan(MAX_GUESTS);
  });

  it('a very long frame is clamped instead of teleporting guests', () => {
    const sim = new Simulation(createInitialState(), seeded());
    sim.update(10);
    expect(sim.guests.every((g) => g.y > 900)).toBe(true);
  });
});

describe('upgrades', () => {
  it('refuses to buy when the club cannot afford it', () => {
    const sim = new Simulation(createInitialState(), seeded());
    expect(sim.buyUpgrade('bartenders')).toBe(false);
    expect(sim.state.upgrades.bartenders).toBe(0);
  });

  it('spends money, raises the level and adds a bartender', () => {
    const sim = new Simulation(createInitialState(), seeded());
    const cost = UPGRADES.find((u) => u.id === 'bartenders')!.costs[0];
    sim.state.money = cost + 10;
    expect(sim.buyUpgrade('bartenders')).toBe(true);
    expect(sim.state.money).toBe(10);
    expect(sim.bartenders.length).toBe(2);
  });

  it('raising the door price earns more per guest', () => {
    const sim = new Simulation(createInitialState(), seeded());
    sim.state.money = 1000;
    sim.buyUpgrade('doorPrice');
    expect(sim.entrancePrice).toBe(DOOR_PRICES[1]);
  });

  it('stops at the maximum level', () => {
    const sim = new Simulation(createInitialState(), seeded());
    sim.state.money = 1_000_000;
    for (let i = 0; i < 10; i++) sim.buyUpgrade('doorPrice');
    expect(sim.state.upgrades.doorPrice).toBe(DOOR_PRICES.length - 1);
    expect(sim.upgradeInfo('doorPrice').nextCost).toBeNull();
  });

  it('more bartenders mean fewer guests give up in the queue', () => {
    const one = new Simulation(createInitialState(), seeded(5));
    run(one, 400);

    const stateFour = createInitialState();
    stateFour.upgrades.bartenders = 3;
    const four = new Simulation(stateFour, seeded(5));
    run(four, 400);

    expect(four.guestsLost).toBeLessThan(one.guestsLost);
  });
});

describe('reset', () => {
  it('returns the club to day one', () => {
    const sim = new Simulation(createInitialState(), seeded());
    run(sim, 30);
    sim.state.money = 500;
    sim.buyUpgrade('doorPrice');
    sim.reset();
    expect(sim.state.money).toBe(0);
    expect(sim.state.upgrades.doorPrice).toBe(0);
    expect(sim.guests.length).toBe(0);
  });
});

describe('saving', () => {
  it('round-trips the club state', () => {
    const storage = memoryStorage();
    const state = createInitialState();
    state.money = 321;
    state.totalEarned = 999;
    state.guestsEntered = 42;
    state.upgrades.bartenders = 2;
    expect(saveState(storage, state)).toBe(true);
    expect(loadState(storage)).toEqual(state);
  });

  it('returns null when there is no save or it is corrupt', () => {
    const storage = memoryStorage();
    expect(loadState(storage)).toBeNull();
    storage.setItem(SAVE_KEY, '{not json');
    expect(loadState(storage)).toBeNull();
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 999, money: 5 }));
    expect(loadState(storage)).toBeNull();
  });

  it('clamps tampered values to sane ranges', () => {
    const storage = memoryStorage();
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({ version: 1, money: -50, totalEarned: 10, guestsEntered: 3, upgrades: { bartenders: 99, doorPrice: -4 } }),
    );
    const state = loadState(storage)!;
    expect(state.money).toBe(0);
    expect(state.upgrades.bartenders).toBe(3);
    expect(state.upgrades.doorPrice).toBe(0);
  });

  it('does not throw when storage is broken', () => {
    const broken: StorageLike = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('full');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadState(broken)).toBeNull();
    expect(saveState(broken, createInitialState())).toBe(false);
    expect(() => clearSave(broken)).not.toThrow();
  });
});
