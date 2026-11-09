import * as THREE from 'three';
import { BAR, DANCE_FLOOR, DOOR_WIDTH } from '../core/config';
import { ROOM3, S, toWorldX, toWorldZ, type Box } from './coords';

const H = ROOM3.height;
const WALL_T = 0.3;

export const NEON = {
  cyan: 0x00e5ff,
  magenta: 0xff2bd6,
  purple: 0xb967ff,
  yellow: 0xffd166,
  green: 0x39ff14,
  orange: 0xffb000,
};

/** A flat colour that ignores lighting and is brighter than "white", so the bloom effect makes it glow. */
function glow(color: number, strength = 3): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(strength), toneMapped: false });
}

function standard(color: number, roughness = 0.7, metalness = 0.1): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

interface Mover {
  pivot: THREE.Group;
  phase: number;
}

interface Laser {
  pivot: THREE.Group;
  phase: number;
}

/** Everything you can see and bump into: the building, the bar, the dance floor, the DJ booth and the light show. */
export class Club {
  readonly group = new THREE.Group();
  readonly colliders: Box[] = [];

  private ceiling!: THREE.Mesh;
  private tiles!: THREE.InstancedMesh;
  private tileCols = 0;
  private tileRows = 0;
  private movers: Mover[] = [];
  private lasers: Laser[] = [];
  private woofers: THREE.Mesh[] = [];
  private neon: { mat: THREE.MeshBasicMaterial; base: THREE.Color }[] = [];
  private ball!: THREE.Mesh;
  private hemi!: THREE.HemisphereLight;
  private lightA!: THREE.PointLight;
  private lightB!: THREE.PointLight;
  private screen!: { ctx: CanvasRenderingContext2D; tex: THREE.CanvasTexture; w: number; h: number };
  private tmpColor = new THREE.Color();

  constructor() {
    this.buildShell();
    this.buildFloorAndTiles();
    this.buildBar();
    this.buildDj();
    this.buildLightRig();
    this.buildSigns();
  }

  setCeilingVisible(visible: boolean): void {
    this.ceiling.visible = visible;
  }

  /** 0 = walking (dark and moody), 1 = manager view (lit up so you can read the room). */
  setManagerBlend(blend: number): void {
    this.hemi.intensity = 0.55 + 3.2 * blend;
  }

  update(time: number, beats: number, pulse: number, energy: number): void {
    // Dance floor tiles ripple and flash on the kick.
    const palette = [NEON.cyan, NEON.magenta, NEON.purple];
    for (let r = 0; r < this.tileRows; r++) {
      for (let c = 0; c < this.tileCols; c++) {
        const i = r * this.tileCols + c;
        const wave = Math.sin(time * 2.2 + c * 0.6 + r * 0.5) * 0.5 + 0.5;
        const level = 0.06 + (0.3 * wave + 0.5 * pulse * wave) * (0.4 + 0.6 * energy);
        this.tmpColor.set(palette[(c + r + Math.floor(beats / 4)) % 3]).multiplyScalar(level * 1.8);
        this.tiles.setColorAt(i, this.tmpColor);
      }
    }
    if (this.tiles.instanceColor) this.tiles.instanceColor.needsUpdate = true;

    // Neon tubes breathe with the beat.
    for (const n of this.neon) n.mat.color.copy(n.base).multiplyScalar(0.8 + pulse * 0.7);

    // Moving heads sweep, lasers fan.
    for (const m of this.movers) {
      m.pivot.rotation.x = Math.sin(time * 0.7 + m.phase) * 0.55;
      m.pivot.rotation.z = Math.cos(time * 0.9 + m.phase * 1.3) * 0.55;
    }
    for (const l of this.lasers) {
      l.pivot.rotation.y = Math.sin(time * 1.1 + l.phase) * 0.33;
      l.pivot.rotation.x = Math.PI / 2 + 0.18 + 0.16 * Math.sin(time * 0.8 + l.phase * 2);
    }

    this.ball.rotation.y = time * 0.4;
    for (const w of this.woofers) w.scale.setScalar(1 + pulse * 0.18);
    this.lightA.intensity = 22 + pulse * 30;
    this.lightB.intensity = 22 + (1 - pulse) * 14;
    this.lightA.color.setHSL((time * 0.05) % 1, 1, 0.5);
    this.lightB.color.setHSL((time * 0.05 + 0.5) % 1, 1, 0.5);

    this.drawScreen(time, pulse);
  }

  // ---- Building the shell ----

  private box(w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    this.group.add(mesh);
    return mesh;
  }

  private neonBar(w: number, h: number, d: number, x: number, y: number, z: number, color: number, pulses = true): void {
    const mat = glow(color, 2.6);
    this.box(w, h, d, x, y, z, mat);
    if (pulses) this.neon.push({ mat, base: mat.color.clone() });
  }

  private buildShell(): void {
    const wallMat = standard(0x1a1a30, 0.85);
    const hw = ROOM3.halfW;
    const hd = ROOM3.halfD;
    const gap = DOOR_WIDTH * S;

    // Walls (the front wall has a gap for the entrance)
    this.box(hw * 2 + WALL_T * 2, H, WALL_T, 0, H / 2, -hd - WALL_T / 2, wallMat);
    this.box(WALL_T, H, hd * 2 + WALL_T * 2, -hw - WALL_T / 2, H / 2, 0, wallMat);
    this.box(WALL_T, H, hd * 2 + WALL_T * 2, hw + WALL_T / 2, H / 2, 0, wallMat);
    const sideW = hw - gap / 2;
    this.box(sideW, H, WALL_T, -(gap / 2 + sideW / 2), H / 2, hd + WALL_T / 2, wallMat);
    this.box(sideW, H, WALL_T, gap / 2 + sideW / 2, H / 2, hd + WALL_T / 2, wallMat);
    this.box(gap, H - 2.7, WALL_T, 0, 2.7 + (H - 2.7) / 2, hd + WALL_T / 2, wallMat);

    // Ground, club floor, ceiling
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), standard(0x040407, 1));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    this.group.add(ground);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2, hd * 2), standard(0x1a1a30, 0.35, 0.2));
    floor.rotation.x = -Math.PI / 2;
    this.group.add(floor);

    this.ceiling = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2, hd * 2), standard(0x06060c, 1));
    this.ceiling.rotation.x = Math.PI / 2;
    this.ceiling.position.y = H;
    this.group.add(this.ceiling);

    // Neon trim around the room and the door
    this.neonBar(hw * 2, 0.06, 0.06, 0, H - 0.5, -hd + 0.05, NEON.cyan);
    this.neonBar(0.06, 0.06, hd * 2, -hw + 0.05, H - 0.5, 0, NEON.magenta);
    this.neonBar(0.06, 0.06, hd * 2, hw - 0.05, H - 0.5, 0, NEON.magenta);
    this.neonBar(hw - gap / 2, 0.06, 0.06, -(gap / 2 + (hw - gap / 2) / 2), H - 0.5, hd - 0.05, NEON.cyan);
    this.neonBar(hw - gap / 2, 0.06, 0.06, gap / 2 + (hw - gap / 2) / 2, H - 0.5, hd - 0.05, NEON.cyan);
    this.neonBar(0.1, 2.7, 0.1, -gap / 2, 1.35, hd + 0.05, NEON.magenta);
    this.neonBar(0.1, 2.7, 0.1, gap / 2, 1.35, hd + 0.05, NEON.magenta);
    this.neonBar(gap, 0.1, 0.1, 0, 2.7, hd + 0.05, NEON.magenta);
    // Light strip along the foot of the walls
    this.neonBar(hw * 2, 0.04, 0.04, 0, 0.12, -hd + 0.05, NEON.purple, false);
    this.neonBar(0.04, 0.04, hd * 2, -hw + 0.05, 0.12, 0, NEON.purple, false);
    this.neonBar(0.04, 0.04, hd * 2, hw - 0.05, 0.12, 0, NEON.purple, false);

    // Street lamp outside, so the doorway looks alive
    this.box(0.12, 4, 0.12, 4, 2, hd + 7, standard(0x111118));
    this.neonBar(0.8, 0.12, 0.12, 3.6, 4, hd + 7, NEON.yellow, false);
  }

  private buildFloorAndTiles(): void {
    const f = DANCE_FLOOR;
    const tile = 0.8;
    const wx0 = toWorldX(f.x);
    const wz0 = toWorldZ(f.y);
    this.tileCols = Math.floor((f.w * S) / tile);
    this.tileRows = Math.floor((f.h * S) / tile);
    const geo = new THREE.BoxGeometry(tile - 0.06, 0.05, tile - 0.06);
    this.tiles = new THREE.InstancedMesh(geo, glow(0xffffff, 1), this.tileCols * this.tileRows);
    const m = new THREE.Matrix4();
    for (let r = 0; r < this.tileRows; r++) {
      for (let c = 0; c < this.tileCols; c++) {
        m.setPosition(wx0 + (c + 0.5) * tile, 0.03, wz0 + (r + 0.5) * tile);
        this.tiles.setMatrixAt(r * this.tileCols + c, m);
        this.tiles.setColorAt(r * this.tileCols + c, this.tmpColor.set(NEON.cyan));
      }
    }
    this.group.add(this.tiles);
  }

  // ---- Bar ----

  private buildBar(): void {
    const cx = toWorldX(BAR.x + BAR.w / 2);
    const cz = toWorldZ(BAR.y + BAR.h / 2);
    const w = BAR.w * S;
    const d = BAR.h * S;

    this.box(w, 1.1, d, cx, 0.55, cz, standard(0x15081f, 0.35, 0.3));
    this.box(w + 0.1, 0.06, d + 0.2, cx, 1.13, cz + 0.05, standard(0x2a1238, 0.2, 0.6));
    this.neonBar(w, 0.05, 0.05, cx, 1.1, cz + d / 2 + 0.03, NEON.magenta);
    this.neonBar(w, 0.05, 0.05, cx, 0.12, cz + d / 2 + 0.03, NEON.cyan);

    // Back shelf with glowing bottles
    const shelfZ = -ROOM3.halfD + 0.14;
    const bottleGeo = new THREE.CylinderGeometry(0.05, 0.06, 0.3, 8);
    const rows = [1.35, 1.85, 2.35];
    const perRow = Math.floor(w / 0.32);
    const bottles = new THREE.InstancedMesh(bottleGeo, glow(0xffffff, 1.6), rows.length * perRow);
    const m = new THREE.Matrix4();
    const colors = [NEON.cyan, NEON.magenta, NEON.yellow, NEON.green, NEON.purple, NEON.orange];
    let i = 0;
    for (const y of rows) {
      this.box(w, 0.05, 0.26, cx, y - 0.17, shelfZ, standard(0x1c1c2c, 0.5, 0.4));
      for (let k = 0; k < perRow; k++) {
        m.setPosition(cx - w / 2 + 0.2 + k * 0.32, y, shelfZ);
        bottles.setMatrixAt(i, m);
        bottles.setColorAt(i, this.tmpColor.set(colors[(i * 7 + k) % colors.length]));
        i++;
      }
    }
    this.group.add(bottles);

    // Bar + bartender zone is off limits
    this.colliders.push({ minX: toWorldX(BAR.x) - 0.1, maxX: toWorldX(BAR.x + BAR.w) + 0.1, minZ: -ROOM3.halfD, maxZ: toWorldZ(BAR.y + BAR.h) + 0.15 });
  }

  // ---- DJ booth ----

  private buildDj(): void {
    const bx = 6;
    const bz = -6.1;
    this.box(6, 0.5, 1.6, bx, 0.25, bz, standard(0x101020, 0.5, 0.3));
    this.neonBar(6, 0.05, 0.05, bx, 0.5, bz + 0.8, NEON.cyan);
    this.box(2.6, 0.9, 0.7, bx, 0.95, bz + 0.5, standard(0x0c0c18, 0.4, 0.5));
    this.neonBar(2.6, 0.04, 0.04, bx, 1.42, bz + 0.86, NEON.magenta);
    for (const dx of [-0.7, 0.7]) {
      const deck = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.04, 24), standard(0x222233, 0.3, 0.8));
      deck.position.set(bx + dx, 1.42, bz + 0.5);
      this.group.add(deck);
    }
    this.colliders.push({ minX: 2.9, maxX: 9.1, minZ: -ROOM3.halfD, maxZ: bz + 0.9 });

    // Speaker stacks with beating woofers
    for (const sx of [2.1, 9.9]) {
      this.box(0.9, 2.0, 0.8, sx, 1.0, -ROOM3.halfD + 0.5, standard(0x0a0a12, 0.6, 0.3));
      for (const y of [0.6, 1.5]) {
        const woofer = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.05, 8, 24), glow(NEON.magenta, 2.2));
        woofer.position.set(sx, y, -ROOM3.halfD + 0.93);
        this.group.add(woofer);
        this.woofers.push(woofer);
      }
      this.colliders.push({ minX: sx - 0.5, maxX: sx + 0.5, minZ: -ROOM3.halfD, maxZ: -ROOM3.halfD + 0.95 });
    }

    // LED screen behind the DJ
    const canvas = document.createElement('canvas');
    canvas.width = 768;
    canvas.height = 256;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
    mat.color.setScalar(1.5);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(6, 2), mat);
    screen.position.set(bx, 2.6, -ROOM3.halfD + 0.02);
    this.group.add(screen);
    this.screen = { ctx: canvas.getContext('2d')!, tex, w: 768, h: 256 };
  }

  private drawScreen(time: number, pulse: number): void {
    const { ctx, tex, w, h } = this.screen;
    ctx.fillStyle = '#05050c';
    ctx.fillRect(0, 0, w, h);
    const bars = 32;
    const bw = w / bars;
    for (let i = 0; i < bars; i++) {
      const v = (Math.sin(time * 3 + i * 0.5) * 0.5 + 0.5) * 0.55 + pulse * 0.4 * (1 - i / bars);
      const bh = v * (h - 40);
      ctx.fillStyle = `hsl(${(i * 8 + time * 40) % 360} 100% 60%)`;
      ctx.fillRect(i * bw + 3, h - bh, bw - 6, bh);
    }
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 34px Segoe UI, Arial';
    ctx.textAlign = 'center';
    ctx.fillText('DJ NEON  ·  LIVE', w / 2, 44);
    tex.needsUpdate = true;
  }

  // ---- Lights ----

  private buildLightRig(): void {
    this.hemi = new THREE.HemisphereLight(0x4a3a8a, 0x1a1a2e, 0.55);
    this.group.add(this.hemi);

    this.lightA = new THREE.PointLight(NEON.magenta, 25, 16);
    this.lightA.position.set(4, 3.6, 0);
    this.lightB = new THREE.PointLight(NEON.cyan, 25, 16);
    this.lightB.position.set(8, 3.6, 3);
    const barLight = new THREE.PointLight(NEON.magenta, 22, 12);
    barLight.position.set(-6, 3, -4);
    this.group.add(this.lightA, this.lightB, barLight);

    // Truss across the ceiling
    for (const z of [-1, 3]) this.box(11, 0.12, 0.12, 5.4, H - 0.3, z, standard(0x15151f, 0.5, 0.6));
    for (const x of [0.2, 10.6]) this.box(0.12, 0.12, 4.2, x, H - 0.3, 1, standard(0x15151f, 0.5, 0.6));

    // Moving heads: a real spotlight plus a visible beam of light
    const beamColors = [NEON.cyan, NEON.magenta, NEON.purple, NEON.green];
    const spots: [number, number][] = [[2, -1], [4.8, 3], [7.6, -1], [10, 3]];
    spots.forEach(([x, z], i) => {
      const color = beamColors[i];
      const pivot = new THREE.Group();
      pivot.position.set(x, H - 0.4, z);

      const spot = new THREE.SpotLight(color, 90, 12, 0.32, 0.8, 1.6);
      const target = new THREE.Object3D();
      target.position.set(0, -4, 0);
      pivot.add(spot, target);
      spot.target = target;

      const coneGeo = new THREE.ConeGeometry(1.3, 4.3, 24, 1, true);
      coneGeo.translate(0, -2.15, 0);
      const cone = new THREE.Mesh(
        coneGeo,
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(color).multiplyScalar(2),
          transparent: true,
          opacity: 0.045,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
          toneMapped: false,
        }),
      );
      pivot.add(cone);
      this.group.add(pivot);
      this.movers.push({ pivot, phase: i * 1.7 });
    });

    // Lasers fanning out from above the DJ
    const laserColors = [NEON.green, NEON.green, NEON.cyan, NEON.magenta, NEON.cyan, NEON.green];
    laserColors.forEach((color, i) => {
      const pivot = new THREE.Group();
      pivot.position.set(3.6 + i * 0.95, 3.7, -ROOM3.halfD + 0.4);
      pivot.rotation.order = 'YXZ';
      const geo = new THREE.CylinderGeometry(0.008, 0.008, 12, 6);
      geo.translate(0, 6, 0);
      const beam = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(color).multiplyScalar(2.2),
          transparent: true,
          opacity: 0.7,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      pivot.add(beam);
      this.group.add(pivot);
      this.lasers.push({ pivot, phase: i * 0.9 });
    });

    // Disco ball
    this.box(0.03, 0.9, 0.03, 5, H - 0.45, 1, standard(0x222222));
    this.ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.12, metalness: 1, flatShading: true }));
    this.ball.position.set(5, H - 1.0, 1);
    this.group.add(this.ball);
  }

  // ---- Neon signs ----

  private sign(text: string, color: string, w: number, h: number, x: number, y: number, z: number, rotY = 0): void {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = Math.round((512 * h) / w);
    const ctx = canvas.getContext('2d')!;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.round(canvas.height * 0.62)}px Segoe UI, Arial`;
    ctx.shadowColor = color;
    ctx.shadowBlur = 28;
    ctx.fillStyle = color;
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, depthWrite: false });
    mat.color.setScalar(1.7);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    this.group.add(mesh);
  }

  private buildSigns(): void {
    this.sign('BAR', '#ff2bd6', 3, 1, -6, 3.45, -ROOM3.halfD + 0.03);
    this.sign('CLUB SIMULATOR', '#00e5ff', 7, 1.3, -ROOM3.halfW + 0.03, 3.0, 0, Math.PI / 2);
    this.sign('ENTRANCE', '#ff2bd6', 3.2, 0.8, 0, 3.4, ROOM3.halfD + WALL_T + 0.03);
    this.sign('OPEN', '#39ff14', 1.6, 0.6, -2.4, 1.9, ROOM3.halfD + WALL_T + 0.03);
  }
}
