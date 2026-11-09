import { SAVE_KEY, SAVE_VERSION, UPGRADES } from './config';
import { createInitialState, maxLevel, type ClubState } from './state';

/** The small slice of the browser Storage API that we use (makes testing easy). */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** Returns the saved club, or null if there is no usable save. Never throws. */
export function loadState(storage: StorageLike): ClubState | null {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data?.version !== SAVE_VERSION) return null;
    if (!isFiniteNumber(data.money) || !isFiniteNumber(data.totalEarned) || !isFiniteNumber(data.guestsEntered)) {
      return null;
    }
    const state = createInitialState();
    state.money = Math.max(0, data.money);
    state.totalEarned = Math.max(0, data.totalEarned);
    state.guestsEntered = Math.max(0, Math.floor(data.guestsEntered));
    for (const u of UPGRADES) {
      const level = data.upgrades?.[u.id];
      if (isFiniteNumber(level)) {
        state.upgrades[u.id] = Math.min(maxLevel(u.id), Math.max(0, Math.floor(level)));
      }
    }
    return state;
  } catch {
    return null;
  }
}

/** Returns true if the save worked (it can fail in private windows or when storage is full). */
export function saveState(storage: StorageLike, state: ClubState): boolean {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, ...state }));
    return true;
  } catch {
    return false;
  }
}

export function clearSave(storage: StorageLike): void {
  try {
    storage.removeItem(SAVE_KEY);
  } catch {
    /* nothing to do */
  }
}
