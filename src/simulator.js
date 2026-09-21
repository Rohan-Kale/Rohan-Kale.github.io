import { FlyCamera } from './camera.js';
import { createRenderer } from './simulator-renderer.js';

export function createSimulator({ reducedMotion }) {
  const $ = (selector) => document.querySelector(selector);
  const canvas = $('#sim-canvas'), camera = new FlyCamera(), keys = new Set(), pointers = new Map();
  const controls = [...document.querySelectorAll('.sim-controls input, .sim-controls select, .sim-controls button')];
  let worker, renderer, ready = false, running = false, busy = false, paused = reducedMotion, failed = false;
  let generation = 0, launchId = 0, loading = false, frame = 0, last = 0, lastStep = 0, elapsed = 0, trails = [], dirty = true;
  let timingTimer = null, stepMilliseconds = null, treeMilliseconds = null;
  function renderTimings() {
    $('#sim-step-time').textContent = `Step ${stepMilliseconds === null ? '—' : stepMilliseconds.toFixed(1)} ms`;
    $('#sim-tree-time').textContent = `Octree ${treeMilliseconds === null ? '—' : treeMilliseconds.toFixed(1)} ms`;
  }
  function queueTimings() {
    if (!running || timingTimer !== null) return;
    timingTimer = setTimeout(() => { timingTimer = null; if (running) renderTimings(); }, 500);
  }
  function resetTimings() {
    clearTimeout(timingTimer); timingTimer = null;
    stepMilliseconds = null; treeMilliseconds = null; renderTimings();
  }
  const preset = () => Number($('#sim-preset').value), count = () => Number($('#body-count').value);
  if (innerWidth < 760) { $('#body-count').value = '512'; $('#body-count-value').value = '512'; }
  const message = (text) => { $('#sim-message').textContent = text; $('#sim-message').hidden = !text; };
  const disable = (value) => controls.forEach((control) => { control.disabled = value; });
  function pauseLabel() { $('#sim-pause').textContent = paused ? 'Resume' : 'Pause'; $('#sim-pause').setAttribute('aria-pressed', String(paused)); }
  function clearInput() { keys.clear(); pointers.clear(); }
  function fail(reason) {
    resetTimings();
    failed = true; ready = false; busy = false; loading = false; launchId++; worker?.terminate(); worker = null;
    clearInput(); renderer?.dispose(); renderer = null; disable(true);
    $('#sim-reset').disabled = false; $('#sim-reset').textContent = 'Retry';
    $('#runtime-label').textContent = '3D unavailable';
    message(`The 3D simulator could not load. ${reason} Use Retry or return to the portfolio.`);
    console.warn('3D simulator:', reason);
  }
  async function launch() {
    if (loading) return;
    const request = ++launchId;
    resetTimings();
    loading = true; failed = false; ready = false; busy = true; disable(true); message('Loading 3D simulator…');
    worker?.terminate(); renderer?.dispose(); renderer = null;
    try {
      const next = await createRenderer(canvas, fail);
      if (request !== launchId) { next.dispose(); return; }
      renderer = next; loading = false;
      worker = new Worker(new URL('./simulation.worker.js', import.meta.url), { type: 'module' });
      worker.onmessage = ({ data: response }) => {
        if (response.generation !== generation || failed || !renderer) return;
        if (response.type === 'error') { fail(response.message); return; }
        if (response.positions) { renderer.setBodies(response.positions); elapsed = 0; trails = []; }
        renderer.setTree(response.nodes); ready = true; busy = false; disable(false); message('');
        $('#runtime-label').textContent = 'Rust + WebGPU';
        $('#sim-count').textContent = `${response.count.toLocaleString()} bodies`;
        $('#sim-time').textContent = `${elapsed.toFixed(2)} years`;
        treeMilliseconds = response.cost; queueTimings();
        if (running && document.activeElement === $('#simulator-title')) canvas.focus({ preventScroll: true });
        dirty = true; draw(); wake();
      };
      worker.onerror = () => fail('The Rust worker could not start.');
      worker.postMessage({ type: 'init', url: new URL(`${import.meta.env.BASE_URL}simulator.wasm`, location.href).href, count: count(), preset: preset(), generation });
      resize(); wake();
    } catch (error) { if (request === launchId) fail(error.message); }
  }
  function reset() {
    resetTimings();
    generation++; trails = []; elapsed = 0; ready = false; busy = true;
    $('#sim-time').textContent = '0.00 years';
    if (failed || !worker) { $('#sim-reset').textContent = 'Reset'; launch(); return; }
    worker.postMessage({ type: 'reset', count: count(), preset: preset(), generation });
  }
  function draw() {
    if (!running || !renderer || !canvas.width || !canvas.height || document.hidden) return;
    renderer.draw(camera.matrix(canvas.width / canvas.height), $('#sim-vectors').checked); dirty = false;
  }
  async function step() {
    busy = true;
    const revision = generation, engine = renderer, start = performance.now();
    const dt = .001 * Number($('#sim-speed').value);
    try {
      const bodies = await engine.step(dt, Number($('#sim-gravity').value), Number($('#sim-accuracy').value));
      if (revision !== generation || engine !== renderer || !bodies) return;
      if (!bodies.every(Number.isFinite)) throw new Error('The system became unstable. Reset to start a new system.');
      elapsed += dt;
      if ($('#sim-trails').checked) { trails.push(bodies.slice()); if (trails.length > 18) trails.shift(); renderer.trails(trails); }
      $('#sim-time').textContent = `${elapsed.toFixed(2)} years`;
      stepMilliseconds = performance.now() - start; queueTimings();
      worker.postMessage({ type: 'tree', bodies, generation }, [bodies.buffer]);
      dirty = true; draw();
    } catch (error) { if (revision === generation && engine === renderer) fail(error.message); }
  }
  function tick(now) {
    frame = 0;
    if (!running || document.hidden || failed) return;
    const dt = last ? Math.min((now - last) / 1000, .05) : 0; last = now;
    if (keys.size) { camera.move(keys, dt); dirty = true; }
    if (ready && !paused && !busy && now - lastStep >= 16) { lastStep = now; step(); }
    if (dirty) draw();
    if (!paused || keys.size) frame = requestAnimationFrame(tick);
  }
  function wake() { if (!frame && running && !document.hidden && !failed) { last = 0; frame = requestAnimationFrame(tick); } }
  function resize() {
    const rectangle = canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, innerWidth < 760 ? 1.25 : 1.75);
    const width = Math.max(1, Math.round(rectangle.width * dpr)), height = Math.max(1, Math.round(rectangle.height * dpr));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    dirty = true; draw();
  }
  new ResizeObserver(resize).observe(canvas);
  $('#body-count').addEventListener('input', () => { $('#body-count-value').value = count().toLocaleString(); });
  $('#body-count').addEventListener('change', reset);
  $('#sim-preset').addEventListener('change', () => { camera.reset(); reset(); });
  for (const key of ['speed', 'gravity', 'accuracy']) $('#sim-' + key).addEventListener('input', (event) => { $('#sim-' + key + '-value').value = event.target.value + (key === 'accuracy' ? '' : '×'); });
  $('#sim-pause').addEventListener('click', () => { paused = !paused; pauseLabel(); wake(); });
  $('#sim-reset').addEventListener('click', reset);
  $('#sim-camera').addEventListener('click', () => { camera.reset(); dirty = true; draw(); });
  $('#sim-trails').addEventListener('change', () => { trails = []; renderer?.trails([]); dirty = true; draw(); });
  $('#sim-vectors').addEventListener('change', () => { dirty = true; draw(); });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  canvas.addEventListener('pointerdown', (event) => {
    canvas.focus({ preventScroll: true });
    if (event.pointerType === 'mouse' && event.button !== 2) return;
    event.preventDefault(); pointers.set(event.pointerId, { x: event.clientX, y: event.clientY }); canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    const previous = pointers.get(event.pointerId); if (!previous) return;
    if (pointers.size === 2) {
      const other = [...pointers.entries()].find(([id]) => id !== event.pointerId)[1];
      const oldDistance = Math.hypot(previous.x - other.x, previous.y - other.y), newDistance = Math.hypot(event.clientX - other.x, event.clientY - other.y);
      camera.zoom((oldDistance - newDistance) * 3);
    } else camera.look(event.clientX - previous.x, event.clientY - previous.y);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY }); dirty = true; draw();
  });
  const endDrag = (event) => pointers.delete(event.pointerId);
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(event, endDrag);
  canvas.addEventListener('wheel', (event) => { event.preventDefault(); camera.zoom(event.deltaY, event.deltaMode); dirty = true; draw(); }, { passive: false });
  const movement = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);
  canvas.addEventListener('keydown', (event) => {
    if (movement.has(event.code)) { event.preventDefault(); keys.add(event.code); wake(); }
    if (['+', '=', '-', '_'].includes(event.key)) { event.preventDefault(); camera.zoom(['+', '='].includes(event.key) ? -100 : 100); dirty = true; draw(); }
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  canvas.addEventListener('blur', clearInput); window.addEventListener('blur', clearInput);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { clearInput(); cancelAnimationFrame(frame); frame = 0; } else { dirty = true; wake(); } });
  for (const button of document.querySelectorAll('[data-fly]')) {
    button.addEventListener('pointerdown', (event) => { event.preventDefault(); keys.add(button.dataset.fly); button.setPointerCapture(event.pointerId); wake(); });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(type, () => keys.delete(button.dataset.fly));
    button.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); keys.add(button.dataset.fly); wake(); } });
    button.addEventListener('keyup', () => keys.delete(button.dataset.fly)); button.addEventListener('blur', () => keys.delete(button.dataset.fly));
  }
  pauseLabel();
  return {
    start() { running = true; if ((!worker || failed) && !loading) launch(); queueTimings(); resize(); wake(); },
    stop() { running = false; clearInput(); cancelAnimationFrame(frame); frame = 0; clearTimeout(timingTimer); timingTimer = null; },
    setReducedMotion(value) { if (value) { paused = true; pauseLabel(); } wake(); }
  };
}
