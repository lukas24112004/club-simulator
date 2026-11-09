import * as THREE from 'three';
import { UPGRADES, type UpgradeId } from '../core/config';
import type { Simulation } from '../core/simulation';
import { clubRating } from '../core/state';

interface Popup {
  el: HTMLElement;
  pos: THREE.Vector3;
  born: number;
}

const fmt = (n: number) => Math.floor(n).toLocaleString('en-US');

/** The 2D layer on top of the 3D view: money, stats, shop, floating "+$" and the start screen. Plain HTML, styled in index.html. */
export class Hud {
  private money = document.getElementById('money')!;
  private stats = document.getElementById('stats')!;
  private overlay = document.getElementById('overlay')!;
  private mode = document.getElementById('mode')!;
  private popups: Popup[] = [];
  private cards = new Map<UpgradeId, { root: HTMLElement; title: HTMLElement; cost: HTMLElement }>();
  private lastStats = '';
  private v = new THREE.Vector3();

  constructor(
    private sim: Simulation,
    onBuy: (id: UpgradeId) => void,
  ) {
    const shop = document.getElementById('shop')!;
    UPGRADES.forEach((def, i) => {
      const root = document.createElement('button');
      root.className = 'card';
      root.innerHTML = `<span class="key">${i + 1}</span><b class="title"></b><span class="cost"></span><small>${def.description}</small>`;
      root.addEventListener('click', () => onBuy(def.id));
      shop.appendChild(root);
      this.cards.set(def.id, { root, title: root.querySelector('.title')!, cost: root.querySelector('.cost')!});
    });
  }

  showOverlay(visible: boolean): void {
    this.overlay.classList.toggle('hidden', !visible);
  }

  setMode(text: string): void {
    this.mode.textContent = text;
  }

  popup(text: string, pos: THREE.Vector3, color: string): void {
    if (this.popups.length > 24) return;
    const el = document.createElement('div');
    el.className = 'popup';
    el.textContent = text;
    el.style.color = color;
    el.style.textShadow = `0 0 10px ${color}`;
    document.body.appendChild(el);
    this.popups.push({ el, pos: pos.clone(), born: performance.now() });
  }

  update(camera: THREE.Camera, width: number, height: number): void {
    const s = this.sim.state;
    this.money.textContent = `$${fmt(s.money)}`;
    const stats = `Rating ★ ${clubRating(s)}  ·  Guests ${this.sim.guests.length}  ·  Queue ${this.sim.barQueue.length}  ·  Entered ${fmt(s.guestsEntered)}  ·  Angry ${this.sim.guestsLost}`;
    if (stats !== this.lastStats) {
      this.stats.textContent = stats;
      this.lastStats = stats;
    }

    for (const def of UPGRADES) {
      const card = this.cards.get(def.id)!;
      const info = this.sim.upgradeInfo(def.id);
      card.title.textContent = `${def.name} · Lv ${info.level}/${info.max}`;
      card.cost.textContent = info.nextCost === null ? 'MAX' : `$${fmt(info.nextCost)}`;
      card.root.classList.toggle('afford', info.affordable);
      card.root.classList.toggle('maxed', info.nextCost === null);
    }

    const now = performance.now();
    this.popups = this.popups.filter((p) => {
      const age = (now - p.born) / 1000;
      this.v.copy(p.pos).y += age * 0.7;
      this.v.project(camera);
      const visible = age < 1.1 && this.v.z < 1 && this.v.z > -1;
      if (!visible) {
        p.el.remove();
        return false;
      }
      p.el.style.transform = `translate(${((this.v.x + 1) / 2) * width}px, ${((1 - this.v.y) / 2) * height}px) translate(-50%, -50%)`;
      p.el.style.opacity = String(Math.max(0, 1 - age / 1.1));
      return true;
    });
  }
}
