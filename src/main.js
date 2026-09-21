import './style.css';
const $ = (s) => document.querySelector(s);
const ids = ['about', 'projects', 'experience', 'contact'];
const media = matchMedia('(prefers-reduced-motion: reduce)');
const status = $('#scene-status');
let mode = 'plain', active = 'about', scene = null, simulator = null, loadVersion = 0;
let motionPaused = media.matches, returnHash = '#projects', simulatorLoad = null;
const storage = { get() { try { return localStorage.getItem('portfolio-mode-v2'); } catch { return null; } }, set(value) { try { localStorage.setItem('portfolio-mode-v2', value); } catch {} } };
function resolve(id) {
  if (id === 'home' || !id || id === 'bio' || id === 'portfolio') return 'about';
  return ids.includes(id) ? id : document.getElementById(id)?.closest('.content-section')?.id || 'about';
}
function showSection(id, { push = true, focus = true, overview = false, preserveCamera = false } = {}) {
  if (!overview) active = resolve(id);
  const mapOnly = mode === 'space' && overview;
  $('.portfolio').hidden = mapOnly;
  document.body.classList.toggle('has-section', mode === 'space' && !mapOnly);
  ids.forEach((key) => { document.getElementById(key).hidden = key !== active; });
  document.querySelectorAll('.section-nav a').forEach((link) => { if (link.hash === `#${active}`) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); });
  if (push) history.pushState(null, '', overview ? '#home' : `#${id === 'home' ? 'about' : id}`);
  $('.section-viewport').scrollTop = 0;
  if (id !== active && document.getElementById(id)?.classList.contains('project')) document.getElementById(id).scrollIntoView({ block: 'nearest' });
  scene?.focus(mapOnly || mode === 'plain' ? null : active, media.matches, preserveCamera);
  if (focus && !mapOnly) document.getElementById(active).focus({ preventScroll: true });
  status.textContent = mapOnly ? 'Space portfolio. Select a body or switch to Plain.' : `${active === 'about' ? 'About' : active} section opened.`;
}
async function setMode(next, { persist = true } = {}) {
  mode = next;
  const version = ++loadVersion;
  if (persist) storage.set(mode);
  document.body.classList.toggle('space-mode', mode === 'space');
  $('#plain-mode').setAttribute('aria-pressed', String(mode === 'plain'));
  $('#space-mode').setAttribute('aria-pressed', String(mode === 'space'));
  $('#scene').hidden = mode !== 'space';
  $('#map-labels').hidden = mode !== 'space';
  $('.space-toolbar').hidden = mode !== 'space';
  $('#close-section').hidden = mode !== 'space';
  if (mode === 'plain') {
    scene?.setEnabled(false);
    showSection(active, { push: false, focus: false });
    return;
  }
  showSection('home', { push: false, focus: false, overview: true });
  try {
    if (!scene) {
      const { createScene } = await import('./scene.js');
      if (version !== loadVersion) return;
      const nextScene = await createScene($('#scene'), { reducedMotion: media.matches, onSelect: (id) => {
        if (id === 'galaxy') openSimulator(); else showSection(id);
      }, onFlightStart: () => showSection('home', { overview: true, focus: false, preserveCamera: true }), onFailure: () => {
        scene = null; setMode('plain', { persist: false });
        status.textContent = 'Space rendering is unavailable. The plain portfolio is ready.';
      } });
      if (version !== loadVersion) { nextScene.dispose(); return; }
      scene = nextScene;
    }
    scene.setEnabled(!$('#simulator-dialog').open); scene.setPaused(motionPaused); scene.focus(null, true); scene.focusControls();
  } catch (error) {
    if (version !== loadVersion) return;
    console.warn('Optional space view:', error.message);
    await setMode('plain', { persist: false });
    status.textContent = 'Space view could not load. All sections are available in Plain mode.';
  }
}
async function openSimulator(push = true) {
  if (!$('#simulator-dialog').open) {
    returnHash = location.hash === '#simulator' ? '#projects' : location.hash || '#projects';
    $('#simulator-dialog').showModal();
    $('#simulator-title').focus({ preventScroll: true });
    scene?.setEnabled(false);
  }
  if (push && location.hash !== '#simulator') history.pushState(null, '', '#simulator');
  try {
    if (!simulatorLoad) simulatorLoad = import('./simulator.js').then(({ createSimulator }) => createSimulator({ reducedMotion: media.matches }));
    simulator = await simulatorLoad;
    if ($('#simulator-dialog').open) simulator.start();
  } catch (error) {
    simulatorLoad = null;
    $('#sim-message').hidden = false;
    $('#sim-message').textContent = 'The playground could not load. Close and reopen to retry. The project description and source code remain available.';
    console.warn(error.message);
  }
}
function closeSimulator(update = true) {
  simulator?.stop();
  $('#simulator-dialog').close();
  if (mode === 'space') scene?.setEnabled(true);
  if (update) {
    history.replaceState(null, '', returnHash);
    showSection(returnHash.slice(1), { push: false, focus: false, overview: mode === 'space' && returnHash === '#home' });
  }
}
function route() {
  if (location.hash === '#simulator') openSimulator(false);
  else {
    if ($('#simulator-dialog').open) closeSimulator(false);
    showSection(location.hash.slice(1), { push: false, focus: false, overview: mode === 'space' && (!location.hash || location.hash === '#home') });
  }
}
$('#plain-mode').addEventListener('click', () => setMode('plain'));
$('#space-mode').addEventListener('click', () => { history.replaceState(null, '', '#home'); setMode('space'); });
$('#close-section').addEventListener('click', () => { showSection('home', { overview: true, focus: false }); scene?.focusControls(); });
$('#reset-camera').addEventListener('click', () => { scene?.resetView?.(); showSection('home', { overview: true, focus: false }); });
function updateMotion() { $('#pause-motion').setAttribute('aria-pressed', String(motionPaused)); $('#pause-motion').textContent = motionPaused ? 'Resume motion' : 'Pause motion'; scene?.setPaused(motionPaused); }
$('#pause-motion').addEventListener('click', () => { motionPaused = !motionPaused; updateMotion(); });
media.addEventListener('change', ({ matches }) => { motionPaused = matches; scene?.setReducedMotion(matches); simulator?.setReducedMotion(matches); updateMotion(); });
$('#close-simulator').addEventListener('click', () => closeSimulator());
$('#simulator-dialog').addEventListener('cancel', (event) => { event.preventDefault(); closeSimulator(); });
window.addEventListener('hashchange', route);
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && mode === 'space' && !$('#simulator-dialog').open) showSection('home', { overview: true, focus: false }); });
document.addEventListener('click', (event) => {
  const link = event.target.closest('a[href^="#"]');
  if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
  event.preventDefault();
  if (link.hash === '#simulator') { openSimulator(); return; }
  if ($('#simulator-dialog').open) closeSimulator(false);
  showSection(link.hash.slice(1), { overview: mode === 'space' && link.hash === '#home' });
});
document.body.classList.add('enhanced');
$('.mode-switch').hidden = false;
active = resolve(location.hash.slice(1));
updateMotion();
setMode(storage.get() === 'space' && !navigator.connection?.saveData ? 'space' : 'plain', { persist: false }).then(route);
