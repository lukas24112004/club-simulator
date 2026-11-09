import * as THREE from 'three';
import { ROOM3, type Box } from './coords';

const EYE = 1.65;
const RADIUS = 0.32;
const WALK = 3.4;
const RUN = 5.8;
const LOOK = 0.0022;

/** First-person walking: WASD + mouse look, with walls and furniture you can't walk through. */
export class Player {
  x = 0;
  z = 5.2;
  yaw = 0; // 0 = looking towards the bar wall (-Z)
  pitch = -0.05;
  locked = false;

  private keys = new Set<string>();
  private stride = 0;

  constructor(
    private camera: THREE.PerspectiveCamera,
    private colliders: Box[],
  ) {
    camera.rotation.order = 'YXZ';
    window.addEventListener('keydown', (e) => this.keys.add(e.code));
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    window.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.yaw -= e.movementX * LOOK;
      this.pitch = THREE.MathUtils.clamp(this.pitch - e.movementY * LOOK, -1.4, 1.4);
    });
  }

  update(dt: number): void {
    const k = this.keys;
    const forward = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const strafe = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const moving = forward !== 0 || strafe !== 0;

    if (moving) {
      const speed = (k.has('ShiftLeft') || k.has('ShiftRight') ? RUN : WALK) * dt;
      const len = Math.hypot(forward, strafe);
      const fx = -Math.sin(this.yaw);
      const fz = -Math.cos(this.yaw);
      const rx = Math.cos(this.yaw);
      const rz = -Math.sin(this.yaw);
      this.x += ((fx * forward + rx * strafe) / len) * speed;
      this.z += ((fz * forward + rz * strafe) / len) * speed;
      this.stride += speed;
      this.collide();
    }

    // Keyboard turning as a backup when the mouse isn't captured
    const turn = (k.has('KeyQ') ? 1 : 0) - (k.has('KeyE') ? 1 : 0);
    this.yaw += turn * 1.8 * dt;

    this.applyToCamera(moving);
  }

  applyToCamera(moving = false): void {
    const bob = moving ? Math.sin(this.stride * 2.4) * 0.035 : 0;
    this.camera.position.set(this.x, EYE + bob, this.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }

  private collide(): void {
    const maxX = ROOM3.halfW - RADIUS;
    const maxZ = ROOM3.halfD - RADIUS;
    this.x = THREE.MathUtils.clamp(this.x, -maxX, maxX);
    this.z = THREE.MathUtils.clamp(this.z, -maxZ, maxZ);
    for (const b of this.colliders) {
      // Push the player out of the box along the shortest way.
      const cx = THREE.MathUtils.clamp(this.x, b.minX, b.maxX);
      const cz = THREE.MathUtils.clamp(this.z, b.minZ, b.maxZ);
      const dx = this.x - cx;
      const dz = this.z - cz;
      const dist = Math.hypot(dx, dz);
      if (dist < RADIUS) {
        if (dist > 1e-5) {
          this.x = cx + (dx / dist) * RADIUS;
          this.z = cz + (dz / dist) * RADIUS;
        } else {
          this.z = b.maxZ + RADIUS; // exactly inside: step towards the room
        }
      }
    }
  }
}
