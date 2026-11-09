import { clearSave, loadState, saveState, type StorageLike } from './core/save';
import { Simulation } from './core/simulation';
import { createInitialState } from './core/state';
import { App } from './game/App';

/** localStorage can be missing or throw (private windows, blocked cookies), so fall back to "no saving". */
function getStorage(): StorageLike {
  try {
    const probe = '__club_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return { getItem: () => null, setItem: () => undefined, removeItem: () => undefined };
  }
}

const storage = getStorage();
const sim = new Simulation(loadState(storage) ?? createInitialState());

const saveNow = () => void saveState(storage, sim.state);
const resetAll = () => {
  sim.reset();
  clearSave(storage);
};

const app = new App(sim, saveNow, resetAll);

// Auto-save: every few seconds, and whenever the player leaves the page.
window.setInterval(saveNow, 5000);
window.addEventListener('pagehide', saveNow);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saveNow();
});

// Handles for automated checks and the browser console.
Object.assign(window, { __club: { sim, app } });
