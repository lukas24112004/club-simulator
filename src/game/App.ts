import * as THREE from 'three';
import { BloomEffect, EffectComposer, EffectPass, RenderPass, ToneMappingEffect, ToneMappingMode, VignetteEffect } from 'postprocessing';
import { UPGRADES, type UpgradeId } from '../core/config';
import type { Simulation } from '../core/simulation';
import { Club } from './Club';
import { Crowd } from './Crowd';
import { Hud } from './Hud';
import { Music } from './Music';
import { Player } from './Player';
import { toWorldX, toWorldZ } from './coords';

export type Mode = 'overlay' | 'walk' | 'manager';

const MODE_TEXT: Record<Mode, string> = {
  overlay: '',
  walk: 'WASD move · Shift run · Mouse look · M manager view · 1-7 buy · N mute · Esc pause',
  manager: 'Manager view · click a card or press 1-7 to buy · M to walk in',
};

/** Owns the renderer and the frame loop. Each frame: advance the rules, then draw what they say. */
export class App {
  mode: Mode = 'overlay';

  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(72, 1, 0.1, 90);
  private composer: EffectComposer;
  private club = new Club();
  private crowd = new Crowd();
  private player: Player;
  private hud: Hud;
  private music = new Music();
  private clock = new THREE.Clock();
  private blend = 0; // 0 = walking, 1 = manager view
  private mgrPos = new THREE.Vector3(0, 17, 12.5);
  private mgrQuat = new THREE.Quaternion();

  constructor(
    private sim: Simulation,
    private saveNow: () => void,
    resetAll: () => void,
  ) {
    const canvas = document.getElementById('scene') as HTMLCanvasElement;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, stencil: false, depth: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.toneMapping = THREE.NoToneMapping; // the tone-mapping effect below does this instead

    this.scene.background = new THREE.Color(0x05050b);
    this.scene.fog = new THREE.FogExp2(0x070712, 0.03);
    this.scene.add(this.club.group, this.crowd.group);

    this.player = new Player(this.camera, this.club.colliders);
    this.player.applyToCamera();

    const look = new THREE.PerspectiveCamera();
    look.position.copy(this.mgrPos);
    look.lookAt(0, 0, -0.5);
    this.mgrQuat.copy(look.quaternion);

    this.composer = new EffectComposer(this.renderer, { frameBufferType: THREE.HalfFloatType, multisampling: 4 });
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(
      new EffectPass(
        this.camera,
        new BloomEffect({ intensity: 1.5, luminanceThreshold: 0.85, luminanceSmoothing: 0.2, mipmapBlur: true, radius: 0.75 }),
        new VignetteEffect({ offset: 0.3, darkness: 0.65 }),
        new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }),
      ),
    );

    this.hud = new Hud(sim, (id) => this.buy(id));
    sim.onEarn = (e) => {
      const color = e.kind === 'entrance' ? '#39ff14' : '#ffd166';
      this.hud.popup(`+$${e.amount}`, new THREE.Vector3(toWorldX(e.x), 1.9, toWorldZ(e.y)), color);
    };

    document.getElementById('overlay')!.addEventListener('click', () => this.enterWalk());
    document.getElementById('reset')!.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.confirm('Reset the club and start from zero?')) resetAll();
    });
    document.addEventListener('pointerlockchange', () => {
      this.player.locked = document.pointerLockElement === canvas;
      if (!this.player.locked && this.mode === 'walk') this.setMode('overlay');
    });
    document.addEventListener('pointerlockerror', () => this.setMode('overlay'));
    window.addEventListener('keydown', (e) => this.onKey(e));
    window.addEventListener('resize', () => this.resize());

    this.resize();
    this.setMode('overlay');
    this.renderer.setAnimationLoop(() => this.frame());
  }

  /** For automated checks: stand somewhere without needing the mouse to be captured. */
  debugView(x: number, z: number, yaw: number, pitch = 0): void {
    this.player.x = x;
    this.player.z = z;
    this.player.yaw = yaw;
    this.player.pitch = pitch;
    this.setMode('walk');
  }

  setMode(mode: Mode): void {
    this.mode = mode;
    this.hud.showOverlay(mode === 'overlay');
    this.hud.setMode(MODE_TEXT[mode]);
  }

  private enterWalk(): void {
    void this.music.start();
    this.setMode('walk');
    this.renderer.domElement.requestPointerLock();
  }

  private buy(id: UpgradeId): void {
    if (!this.sim.buyUpgrade(id)) return;
    this.saveNow();
    const info = this.sim.upgradeInfo(id);
    this.hud.toast(`${info.def.name} · level ${info.level}`);
  }

  private onKey(e: KeyboardEvent): void {
    if (e.repeat || this.mode === 'overlay') return;
    if (e.code === 'KeyM') {
      if (this.mode === 'walk') {
        this.setMode('manager');
        document.exitPointerLock();
      } else {
        this.enterWalk();
      }
    } else if (e.code === 'KeyN') {
      this.music.toggleMute();
    } else if (e.code.startsWith('Digit')) {
      const def = UPGRADES[Number(e.code.slice(5)) - 1];
      if (def) this.buy(def.id);
    }
  }

  private resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private frame(): void {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    const t = this.clock.elapsedTime;

    this.sim.update(dt);
    const beats = this.music.beats;
    const pulse = this.music.pulse;
    const energy = Math.min(this.sim.guests.length / 40, 1);

    this.club.update(t, beats, pulse, energy, this.sim.state.upgrades);
    const fog = this.scene.fog as THREE.FogExp2;
    fog.density += (this.club.fogDensity - fog.density) * Math.min(1, dt * 1.5);
    this.crowd.update(this.sim, t, beats);

    if (this.mode === 'walk') this.player.update(dt);
    else this.player.applyToCamera();

    // Glide between walking and the manager's bird's-eye view
    const target = this.mode === 'manager' ? 1 : 0;
    this.blend += (target - this.blend) * Math.min(1, dt * 4);
    if (Math.abs(target - this.blend) < 0.001) this.blend = target;
    if (this.blend > 0) {
      const e = this.blend * this.blend * (3 - 2 * this.blend);
      this.camera.position.lerp(this.mgrPos, e);
      this.camera.quaternion.slerp(this.mgrQuat, e);
    }
    this.club.setCeilingVisible(this.blend < 0.35);
    this.club.setManagerBlend(this.blend);

    this.composer.render(dt);
    this.hud.update(this.camera, window.innerWidth, window.innerHeight);
  }
}
