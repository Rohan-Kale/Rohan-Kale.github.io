# Architecture

## Original project inspection

Read-only source: `C:\Users\Rohan\Space-Simulator`, commit `80bbfc0ae9f255e8f4b21c1a4238917a5705d77a`.

The native Rust executable uses winit 0.30 for windows/events, wgpu 29 for graphics and compute, egui for controls, and glam for camera math. `src/main.rs` handles keyboard movement, right-button mouse look, wheel field of view, and periodic CPU octree construction. `src/app_environment/mod.rs` creates a native surface and blocks on GPU startup using pollster. The renderer uses WGSL shaders for bodies, stars, velocities, and gravity. The solar initializer defines the Sun, eight planets, and 10,000 asteroids. The CPU octree and the GPU Barnes–Hut compute path are both present in the original source.

A direct browser build would require asynchronous initialization, canvas ownership, browser event-loop integration, web-compatible randomness, and GPU feature/limit checks. WebGL2 cannot execute the gravity compute shader. WebAssembly alone does not solve those renderer/platform differences.

Official references:

- [wgpu web platforms](https://wgpu.rs/doc/wgpu/documentation/platforms/web/index.html)
- [wgpu compute support](https://docs.rs/wgpu/latest/wasm32-unknown-unknown/wgpu/struct.DownlevelFlags.html)
- [winit browser integration](https://docs.rs/winit/latest/winit/platform/web/index.html)

## Final implementation

A static Vite site with two presentations of the same semantic HTML content. Plain mode is the default and swaps one visible section at a time within a viewport-sized layout. Space mode places About at the central sun, with Projects, Experience (including skills), and Contact as orbiting planets. An outer create-your-own-galaxy planet opens the Rust playground. The Plain toggle and section navigation provide direct access to content. Long content scrolls within a panel rather than extending the entire page. Without JavaScript, all content remains in normal document flow.

The reference portfolio informed only the compact, in-place navigation. The site uses its own split identity/content layout, dual mode control, orbit view, and project playground, without adopting the reference’s terminal interface.

`content/portfolio.json` feeds a static HTML generator with escaping and link validation. Self-hosted fonts use swap rendering. Every section is present in the initial HTML; the personal content is not fetched at runtime.

The optional orbital navigation is now a WebGPU 3D scene using the same FlyCamera, sphere mesh, and body shader as the simulator. It retains minimal white/grey bodies with muted navy orbit lines and no glow. WASD, Space/Shift, right-drag, and wheel provide free flight. Perspective ray/sphere picking lets a left-click approach a body and open its section; DOM labels offer keyboard selection. A 650 ms camera transition becomes immediate with reduced motion. Flight from an open panel dismisses that panel while preserving the camera position. Reset view restores the overview. The small-screen overview uses a higher angle to keep labels apart. Orbit motion reuses the Rust solar constants/math with distances and time adjusted for navigation. No WASM or physics worker loads for portfolio navigation; missing WebGPU returns to Plain.

## 3D Rust / WebGPU playground

Both the portfolio navigation and the separate playable simulator use 3D WebGPU. The separate playable simulator is a real 3D WebGPU port:

- `src/shaders/particle.wgsl`, `star.wgsl`, and `velocity.wgsl` are byte-for-byte copies of the original rendering shaders. The 32-by-32 sphere mesh, 64-byte GPU body layout, lighting, 5,000-star volume, depth buffer, and velocity-line behavior mirror the native renderer.
- `src/camera.js` ports the original right-handed perspective camera: initial position (0,3,8), yaw -90°, pitch -15°, 45° FOV, near/far .001/100 AU, 2.5 AU/s flight, .002-radian mouse sensitivity, ±1.5-radian pitch bounds, and 10–90° zoom. WASD, Space/Shift, right-drag, and wheel inputs match the native controls. Keyboard look/zoom and touch controls are browser additions. Camera input remains usable while physics is paused.
- `rust-simulator/src/octree.rs` contains the original octree and flattening logic. Rust compiles to a small WASM module and builds an 80-byte-per-node GPU octree in a worker. The worker receives a snapshot of the GPU body positions after each step and rebuilds a current tree.
- `src/shaders/gravity.wgsl` is adapted from `reference/gravity.wgsl`. It retains the original solar-unit gravity, softening, Barnes–Hut traversal, and leapfrog update. Browser changes provide live gravity/theta uniforms, read-only input snapshots to prevent cross-workgroup read/write races, and exclusion of cells containing the current body from approximation. These are intentional corrections in the portfolio copy only.
- `src/simulator-renderer.js` creates the native-style instanced drawing and compute pipelines directly through WebGPU. The existing CPU integration export remains for reference tests; browser integration uses the GPU shader.

The solar preset matches the native Sun/planet masses and radii and asteroid ranges, including 10,000 asteroids at the maximum/default desktop population of 10,009. Small screens initially use 512. Deterministic random seeds make reset repeatable. The extra binary/disk presets, trails, and population controls are portfolio additions.

This is a browser port, not an unchanged native binary. JavaScript handles the GPU API and browser inputs; HTML controls replace egui. The original native renderer is never built or launched by portfolio commands. Browser GPU performance varies, especially at 10,009 full sphere instances; lower the body count on slower devices.

One compute/readback/tree update is in flight at a time. Camera rendering is independent of physics latency, including while paused. Closing or hiding the playground stops new simulation requests and rendering. Trails are bounded to approximately 350 bodies across 18 frames. Reduced motion starts physics paused. Module, WASM, WebGPU/device, and worker failures show a useful fallback/retry message; portfolio content remains available.

WebGPU requires browser support and a secure context (HTTPS or local development). See [MDN WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API). The GPU module, shaders, Rust worker, and WASM load only when the playground opens. All copied/adapted source, downloaded target libraries, and compiled artifacts live inside the portfolio folder; the native repository is not a build dependency.
