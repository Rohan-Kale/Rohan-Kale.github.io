import { FlyCamera } from './camera.js';
import { createNavigationRenderer } from './navigation-renderer.js';
import { planets } from './generated/solar-system.js';
import { orbitalPosition } from './orbital.js';

export async function createScene(container, { reducedMotion, onFailure, onSelect, onFlightStart }) {
  const canvas = document.createElement('canvas');
  canvas.style.visibility = 'hidden';
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', 'Explore the portfolio in 3D. WASD to fly, Space and Shift to move vertically, right-drag or arrow keys to look, scroll to zoom, and click a planet to open its section.');
  container.append(canvas);
  const definitions = [
    { id: 'about', orbit: 0, size: .46 },
    { id: 'projects', index: 2, orbit: 2.3, phase: .15, size: .23 },
    // Keep the outer destinations visibly moving: roughly 40/50/60-second laps.
    { id: 'experience', index: 4, orbit: 3.5, phase: 2.6, size: .28, timeScale: 10 },
    { id: 'contact', index: 5, orbit: 4.8, phase: -1.1, size: .22, timeScale: 20 },
    { id: 'galaxy', index: 7, orbit: 6, phase: .8, size: .13, timeScale: 90 }
  ].map((d) => ({ ...d, position: [0, 0, 0], label: document.querySelector(`[data-planet="${d.id}"]`) }));
  definitions.forEach((item) => { item.label.hidden = true; });
  let renderer;
  try { renderer = await createNavigationRenderer(canvas, definitions, () => { api.dispose(); onFailure(); }); }
  catch (error) { canvas.remove(); throw error; }
  const camera = new FlyCamera(), keys = new Set(), pointers = new Map(), events = new AbortController();
  let enabled = true, visible = true, paused = reducedMotion, reduced = reducedMotion, disposed = false;
  let frame = 0, last = 0, years = 0, width = 0, height = 0, focused = null, transition = null, returnCamera = null, down = null;
  const state = () => ({ position: [...camera.position], yaw: camera.yaw, pitch: camera.pitch, fov: camera.fov });
  const assign = (s) => { camera.position = [...s.position]; camera.yaw = s.yaw; camera.pitch = s.pitch; camera.fov = s.fov; };
  function overview() {
    camera.reset();
    const scale = Math.max(1, 1.3 / (width / height || 1));
    const elevation = width < 760 ? 11 : 5, distance = width < 760 ? 11 : 14;
    camera.position = [0, elevation * scale, distance * scale]; camera.pitch = -Math.atan2(elevation, distance);
  }
  function updatePositions() {
    for (const item of definitions) item.position = item.orbit ? orbitalPosition(item.orbit, item.phase, years * (item.timeScale ?? 1), planets[item.index].distance) : [0, 0, 0];
  }
  function matrix() {
    const m = camera.matrix(width / height);
    // Keep the selected destination beside the reading panel on wide screens.
    if (focused && width > 760) for (let c = 0; c < 4; c++) m[c * 4] -= .38 * m[c * 4 + 3];
    return m;
  }
  function project(position, m) {
    const clip = [0, 1, 2, 3].map((row) => m[row] * position[0] + m[4 + row] * position[1] + m[8 + row] * position[2] + m[12 + row]);
    if (clip[3] <= .01 || clip[2] < 0 || clip[2] > clip[3]) return null;
    return { x: (clip[0] / clip[3] + 1) * width / 2, y: (1 - clip[1] / clip[3]) * height / 2, depth: clip[3] };
  }
  function labels(m) {
    for (const item of definitions) {
      const p = project(item.position, m);
      const show = !focused && p && p.x >= 0 && p.x <= width && p.y >= 0 && p.y < height - 70;
      item.label.hidden = !show;
      if (!show) continue;
      const radius = item.size * height / (2 * Math.tan(camera.fov / 2) * p.depth);
      const x = Math.max(6, Math.min(width - item.label.offsetWidth - 6, p.x - item.label.offsetWidth / 2));
      const y = Math.min(height - 90, p.y + radius + 8);
      item.label.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`;
    }
  }
  function draw(now = performance.now()) {
    frame = 0;
    if (!enabled || !visible || document.hidden || disposed || !width || !height) return;
    const dt = last ? Math.min((now - last) / 1000, .05) : 0; last = now;
    if (keys.size) { transition = null; camera.move(keys, dt); }
    if (!paused && !focused && !transition) years += dt * .03;
    updatePositions();
    if (transition) {
      const t = Math.min(1, (now - transition.start) / 650), blend = t * t * (3 - 2 * t);
      for (let i = 0; i < 3; i++) camera.position[i] = transition.from.position[i] + (transition.to.position[i] - transition.from.position[i]) * blend;
      for (const key of ['yaw', 'pitch', 'fov']) camera[key] = transition.from[key] + (transition.to[key] - transition.from[key]) * blend;
      if (t === 1) transition = null;
    }
    const m = matrix(), packed = new Float32Array(definitions.length * 4);
    definitions.forEach((item, i) => { packed.set(item.position, i * 4); packed[i * 4 + 3] = item.size; });
    renderer.draw(m, packed); labels(m); canvas.style.visibility = 'visible';
    if (!paused || transition || keys.size) frame = requestAnimationFrame(draw);
  }
  function wake() { if (!frame && enabled && visible && !document.hidden && !disposed) { last = 0; frame = requestAnimationFrame(draw); } }
  function clearInput() { keys.clear(); pointers.clear(); down = null; }
  function fly() {
    transition = null;
    if (focused) { focused = null; returnCamera = null; onFlightStart(); }
  }
  function travel(target, immediate) {
    if (immediate || reduced) { assign(target); transition = null; }
    else transition = { from: state(), to: target, start: performance.now() };
    wake();
  }
  function pick(x, y) {
    // Ray/sphere picking in the same camera space as the rendered scene.
    const forward = camera.direction(), right = [-Math.sin(camera.yaw), 0, Math.cos(camera.yaw)];
    const up = [right[1] * forward[2] - right[2] * forward[1], right[2] * forward[0] - right[0] * forward[2], right[0] * forward[1] - right[1] * forward[0]];
    const nx = x / width * 2 - 1 + (focused && width > 760 ? .38 : 0), ny = 1 - y / height * 2, tan = Math.tan(camera.fov / 2);
    const ray = forward.map((v, i) => v + right[i] * nx * width / height * tan + up[i] * ny * tan);
    const length = Math.hypot(...ray); for (let i = 0; i < 3; i++) ray[i] /= length;
    let closest = Infinity, selected = null;
    for (const item of definitions) {
      const offset = camera.position.map((v, i) => v - item.position[i]), b = offset.reduce((s, v, i) => s + v * ray[i], 0);
      const c = offset.reduce((s, v) => s + v * v, 0) - item.size * item.size, discriminant = b * b - c;
      if (discriminant < 0) continue;
      const near = -b - Math.sqrt(discriminant), far = -b + Math.sqrt(discriminant), distance = near > 0 ? near : far;
      if (distance > 0 && distance < closest) { closest = distance; selected = item.id; }
    }
    if (selected) onSelect(selected);
  }
  function resize() {
    const initial = !width;
    width = container.clientWidth; height = container.clientHeight;
    if (!width || !height) return;
    const dpr = Math.min(devicePixelRatio || 1, width < 800 ? 1.25 : 2);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    if (initial) overview();
    wake();
  }
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(container);
  const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) wake(); else { clearInput(); cancelAnimationFrame(frame); frame = 0; } }); observer.observe(container);
  const listen = (target, event, fn, options = {}) => target.addEventListener(event, fn, { ...options, signal: events.signal });
  const movement = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);
  listen(window, 'keydown', (event) => {
    if (!enabled || document.querySelector('dialog[open]') || event.ctrlKey || event.metaKey || event.altKey || event.target.closest('input,textarea,select,button,a,[contenteditable="true"]')) return;
    if (movement.has(event.code)) { event.preventDefault(); fly(); keys.add(event.code); canvas.focus({ preventScroll: true }); wake(); }
    if (['+', '=', '-', '_'].includes(event.key)) { event.preventDefault(); fly(); camera.zoom(['+', '='].includes(event.key) ? -100 : 100); wake(); }
  });
  listen(window, 'keyup', (event) => keys.delete(event.code));
  listen(window, 'blur', clearInput); listen(canvas, 'blur', clearInput);
  listen(document, 'visibilitychange', () => { if (document.hidden) { clearInput(); cancelAnimationFrame(frame); frame = 0; } else wake(); });
  listen(canvas, 'contextmenu', (event) => event.preventDefault());
  listen(canvas, 'pointerdown', (event) => {
    if (!enabled) return;
    canvas.focus({ preventScroll: true });
    if (event.button === 0) down = { x: event.clientX, y: event.clientY, id: event.pointerId };
    if (event.button === 2 || event.pointerType !== 'mouse') { pointers.set(event.pointerId, { x: event.clientX, y: event.clientY }); canvas.setPointerCapture(event.pointerId); }
  });
  listen(canvas, 'pointermove', (event) => {
    const previous = pointers.get(event.pointerId); if (!previous) return;
    const dx = event.clientX - previous.x, dy = event.clientY - previous.y;
    if (!dx && !dy) return;
    if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) > 5) down = null;
    fly();
    if (pointers.size === 2) {
      down = null; const other = [...pointers.entries()].find(([id]) => id !== event.pointerId)[1];
      camera.zoom((Math.hypot(previous.x - other.x, previous.y - other.y) - Math.hypot(event.clientX - other.x, event.clientY - other.y)) * 3);
    } else camera.look(dx, dy);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY }); wake();
  });
  listen(canvas, 'pointerup', (event) => {
    if (down?.id === event.pointerId && Math.hypot(event.clientX - down.x, event.clientY - down.y) <= 5) { const r = canvas.getBoundingClientRect(); pick(event.clientX - r.left, event.clientY - r.top); }
    pointers.delete(event.pointerId); down = null;
  });
  for (const type of ['pointercancel', 'lostpointercapture']) listen(canvas, type, (event) => { pointers.delete(event.pointerId); down = null; });
  listen(canvas, 'wheel', (event) => { event.preventDefault(); fly(); camera.zoom(event.deltaY, event.deltaMode); wake(); }, { passive: false });
  const api = {
    focus(id, immediate = false, preserveCamera = false) {
      clearInput();
      const item = definitions.find((d) => d.id === id);
      if (!item) {
        focused = null;
        if (preserveCamera) transition = null;
        else if (returnCamera) travel(returnCamera, immediate);
        returnCamera = null; wake(); return;
      }
      if (!focused) returnCamera = state();
      focused = id;
      const delta = item.position.map((v, i) => v - camera.position[i]), length = Math.hypot(...delta) || 1;
      const direction = delta.map((v) => v / length), distance = item.size * 8 + 1.5;
      let yaw = Math.atan2(direction[2], direction[0]);
      while (yaw - camera.yaw > Math.PI) yaw -= Math.PI * 2;
      while (yaw - camera.yaw < -Math.PI) yaw += Math.PI * 2;
      travel({ position: item.position.map((v, i) => v - direction[i] * distance), yaw, pitch: Math.asin(direction[1]), fov: Math.PI / 4 }, immediate);
    },
    resetView() { clearInput(); focused = null; transition = null; returnCamera = null; overview(); canvas.focus({ preventScroll: true }); wake(); },
    focusControls() { requestAnimationFrame(() => { if (enabled && !disposed) canvas.focus({ preventScroll: true }); }); },
    setPaused(value) { paused = value; wake(); },
    setReducedMotion(value) { reduced = value; if (value && transition) { assign(transition.to); transition = null; } wake(); },
    setEnabled(value) { enabled = value; if (value) resize(); else { clearInput(); cancelAnimationFrame(frame); frame = 0; } },
    dispose() { if (disposed) return; disposed = true; clearInput(); cancelAnimationFrame(frame); events.abort(); resizeObserver.disconnect(); observer.disconnect(); renderer.dispose(); canvas.remove(); }
  };
  resize(); updatePositions(); wake(); return api;
}
