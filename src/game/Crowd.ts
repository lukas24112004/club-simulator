import * as THREE from 'three';
import { MAX_GUESTS_CAP } from '../core/config';
import type { Simulation } from '../core/simulation';
import { toWorldX, toWorldZ } from './coords';

const CAPACITY = MAX_GUESTS_CAP + 8;
const SHIRTS = [0x00b8d4, 0xd81bb4, 0x8a4fe0, 0xe0a83a, 0x2fd10f, 0xe05a2a];
const SKINS = [0xf1c9a5, 0xd9a07a, 0xb97a56, 0x8d5a3b, 0x5e3a26];

/** Draws every person (guests, bartenders, the DJ) as two instanced meshes: one draw call each, so hundreds stay cheap. */
export class Crowd {
  readonly group = new THREE.Group();
  private body: THREE.InstancedMesh;
  private head: THREE.InstancedMesh;
  private armL: THREE.InstancedMesh;
  private armR: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private armDummy = new THREE.Object3D();
  private armMatrix = new THREE.Matrix4();
  private color = new THREE.Color();
  private last = new Map<number, { x: number; z: number; yaw: number }>();
  private count = 0;

  constructor() {
    const bodyGeo = new THREE.CapsuleGeometry(0.2, 0.85, 4, 10);
    bodyGeo.translate(0, 0.62, 0);
    const headGeo = new THREE.SphereGeometry(0.14, 12, 10);
    headGeo.translate(0, 1.5, 0);
    const armGeo = new THREE.CapsuleGeometry(0.055, 0.45, 4, 8);
    armGeo.translate(0, -0.28, 0); // hangs down from the shoulder
    const shirtMat = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.1 });
    this.body = new THREE.InstancedMesh(bodyGeo, shirtMat, CAPACITY);
    this.head = new THREE.InstancedMesh(headGeo, new THREE.MeshStandardMaterial({ roughness: 0.7 }), CAPACITY);
    this.armL = new THREE.InstancedMesh(armGeo, shirtMat, CAPACITY);
    this.armR = new THREE.InstancedMesh(armGeo, shirtMat, CAPACITY);
    for (const mesh of [this.body, this.head, this.armL, this.armR]) {
      mesh.frustumCulled = false; // positions change every frame, so the default bounds would be wrong
      mesh.count = 0;
      this.group.add(mesh);
    }
  }

  update(sim: Simulation, time: number, beats: number): void {
    this.count = 0;

    for (const g of sim.guests) {
      const x = toWorldX(g.x);
      const z = toWorldZ(g.y);
      const prev = this.last.get(g.id);
      let yaw = prev?.yaw ?? Math.PI;
      if (prev) {
        const dx = x - prev.x;
        const dz = z - prev.z;
        if (dx * dx + dz * dz > 1e-6) yaw = Math.atan2(dx, dz);
      }
      this.last.set(g.id, { x, z, yaw });

      let bob = 0;
      let lean = 0;
      let turn = 0;
      let armZ = 0.12; // how far the arms swing out sideways (radians)
      let armSwing = 0; // walking swing, front to back
      if (g.phase === 'dancing') {
        bob = Math.abs(Math.sin(beats * Math.PI + g.id)) * 0.1;
        lean = Math.sin(beats * Math.PI + g.id * 1.7) * 0.14;
        turn = Math.sin(beats * Math.PI * 0.5 + g.id) * 0.6;
        armZ = 2.3 + Math.sin(beats * Math.PI * 2 + g.id) * 0.5; // hands in the air
      } else if (g.phase !== 'ordering' && g.phase !== 'queueing') {
        bob = Math.abs(Math.sin(time * 9 + g.id)) * 0.04;
        armSwing = Math.sin(time * 9 + g.id) * 0.6;
      }
      const shirt = g.unhappy ? 0xff3b3b : SHIRTS[g.colorIndex % SHIRTS.length];
      this.place(x, bob, z, yaw + turn, lean, shirt, SKINS[g.id % SKINS.length], armZ, armSwing);
    }

    sim.bartenders.forEach((b, i) => {
      const p = sim.bartenderPosition(i);
      const serving = b.guest?.atBar ?? false;
      const lean = serving ? Math.sin(time * 8 + i) * 0.1 : 0;
      const armZ = serving ? 0.7 + Math.sin(time * 8 + i) * 0.3 : 0.15;
      this.place(toWorldX(p.x), 0, toWorldZ(p.y), 0, lean, 0xffb000, SKINS[(i + 1) % SKINS.length], armZ, 0);
    });

    // The DJ, nodding on the beat with hands on the decks
    const dj = Math.sin(beats * Math.PI * 2);
    this.place(6, 0.5 + Math.abs(Math.sin(beats * Math.PI)) * 0.05, -6.3, 0, Math.sin(beats * Math.PI) * 0.1, 0xf5f5ff, SKINS[2], 0.5, 0.9 + dj * 0.15);

    for (const mesh of [this.body, this.head, this.armL, this.armR]) {
      mesh.count = this.count;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }

    // Forget guests who have left
    if (this.last.size > sim.guests.length + 32) {
      const alive = new Set(sim.guests.map((g) => g.id));
      for (const id of this.last.keys()) if (!alive.has(id)) this.last.delete(id);
    }
  }

  private place(x: number, y: number, z: number, yaw: number, lean: number, shirt: number, skin: number, armZ: number, armSwing: number): void {
    if (this.count >= CAPACITY) return;
    const i = this.count;
    const d = this.dummy;
    d.position.set(x, y, z);
    d.rotation.set(0, yaw, lean, 'YXZ');
    d.updateMatrix();
    this.body.setMatrixAt(i, d.matrix);
    this.head.setMatrixAt(i, d.matrix);

    // Arms hang from the shoulders and move relative to the body
    const a = this.armDummy;
    for (const side of [-1, 1]) {
      a.position.set(side * 0.27, 1.2, 0);
      a.rotation.set(side * armSwing, 0, side * armZ);
      a.updateMatrix();
      this.armMatrix.multiplyMatrices(d.matrix, a.matrix);
      (side < 0 ? this.armL : this.armR).setMatrixAt(i, this.armMatrix);
    }

    this.color.set(shirt);
    this.body.setColorAt(i, this.color);
    this.armL.setColorAt(i, this.color);
    this.armR.setColorAt(i, this.color);
    this.head.setColorAt(i, this.color.set(skin));
    this.count++;
  }
}
