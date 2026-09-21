// Camera conventions and defaults from the original Rust camera.rs / main.rs.
// Right-handed, Y-up, perspective depth 0..1 (WebGPU / glam::perspective_rh).
export class FlyCamera {
  constructor() { this.reset(); }
  reset() { this.position = [0, 3, 8]; this.yaw = -Math.PI / 2; this.pitch = -Math.PI / 12; this.fov = Math.PI / 4; }
  direction() { return [Math.cos(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.sin(this.yaw) * Math.cos(this.pitch)]; }
  look(dx, dy) { this.yaw += dx * .002; this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch - dy * .002)); }
  zoom(delta, mode = 0) { this.fov = Math.max(Math.PI / 18, Math.min(Math.PI / 2, this.fov + delta * (mode === 1 ? .05 : .0005))); }
  move(keys, dt) {
    const forward = this.direction(), right = [-Math.sin(this.yaw), 0, Math.cos(this.yaw)];
    const distance = 2.5 * Math.min(dt, .05);
    const f = Number(keys.has('KeyW')) - Number(keys.has('KeyS'));
    const r = Number(keys.has('KeyD')) - Number(keys.has('KeyA'));
    const u = Number(keys.has('Space')) - Number(keys.has('ShiftLeft') || keys.has('ShiftRight'));
    for (let i = 0; i < 3; i++) this.position[i] += (forward[i] * f + right[i] * r + (i === 1 ? u : 0)) * distance;
    if (keys.has('ArrowLeft')) this.look(-700 * dt, 0);
    if (keys.has('ArrowRight')) this.look(700 * dt, 0);
    if (keys.has('ArrowUp')) this.look(0, -700 * dt);
    if (keys.has('ArrowDown')) this.look(0, 700 * dt);
  }
  matrix(aspect) {
    const f = this.direction(), r = [-Math.sin(this.yaw), 0, Math.cos(this.yaw)];
    const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    const dot = (a, b) => a.reduce((v, x, i) => v + x * b[i], 0);
    const v = [r[0], u[0], -f[0], 0, r[1], u[1], -f[1], 0, r[2], u[2], -f[2], 0, -dot(r, this.position), -dot(u, this.position), dot(f, this.position), 1];
    const focal = 1 / Math.tan(this.fov / 2), near = .001, far = 100;
    const p = [focal / aspect, 0, 0, 0, 0, focal, 0, 0, 0, 0, far / (near - far), -1, 0, 0, far * near / (near - far), 0];
    const out = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let row = 0; row < 4; row++) for (let k = 0; k < 4; k++) out[c * 4 + row] += p[k * 4 + row] * v[c * 4 + k];
    return out;
  }
}
