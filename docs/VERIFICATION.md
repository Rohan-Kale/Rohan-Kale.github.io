# Verification

Verified on September 21, 2026, using Node 24, Rust 1.97.1, and installed Google Chrome on Windows.

- `npm run build:rust`: reproduces the WebAssembly module using a standard library downloaded exclusively into this project.
- `npm run build`: produces a static deployable site including the worker and WASM file. A browser smoke test against the production preview also passed the actual Rust loading, population, integration, reset, and camera checks.
- Nine Node tests: native camera axes/speed, look/zoom/projection limits, orbital math, extracted solar data, static HTML, WASM limits/reset determinism, finite 10,009-body reference simulations, gravity response, and valid GPU octree layout/rebuilding.
- Eight browser scenarios: Plain navigation; Space navigation; native camera flight/right-drag/scroll while paused and blur handling; actual WebGPU gravity at 10,009 bodies; playground controls/reset; absent WebGPU; module/WASM failures and retry; responsive layout and automated accessibility.
- All four portfolio tabs work: About, Projects, Experience (with skills), and Contact. The legacy `#skills` link resolves to the combined Experience content. Space uses About as the sun and the other three sections as planets, with an outer create-your-own-galaxy entry point.
- Plain mode loads no orbital scene or WASM. Name, email, and resume remain in the viewport. No document overflow at 320, 390, 768, 1024, and 1440 pixels. Long content and the simulator controls may scroll within their own panels.
- Simulator: a real Rust WASM worker loads, reports the selected population, advances simulated time, starts paused with reduced motion, resets deterministically, exposes trails/velocity controls, and responds to keyboard camera input. Maximum/default desktop population is 10,009. Small screens start with 512.
- Fallbacks: JavaScript-disabled HTML remains readable; an orbital-module load failure returns to Plain; failed WASM loading displays a useful retry action, and Retry succeeds after network recovery.
- Automated axe WCAG 2 A/AA and 2.1 AA checks reported zero violations on the plain page and simulator dialog. This is not a full manual screen-reader audit.
- Desktop/mobile screenshots were inspected for the compact personal introduction, Space navigation, and playground.
- Original simulator: SHA-256 file hashes are unchanged and its Git working tree remains clean. The native executable was not rebuilt or launched.

The browser playground uses unchanged copies of the original rendering shaders and sphere geometry, a Rust WASM octree, and adapted WebGPU gravity. Native camera defaults and controls are reproduced. Browser-specific event/UI integration and physics corrections are documented in ARCHITECTURE.md. The original repository remains untouched.

Personal information that was not supplied remains clearly marked, including biography, experience, skills, and the resume. The email is the user-provided `kalerohan42@gmail.com`. No public deployment has been made.


Latest visual revision: removed the identity role/introduction, About forward link, project launch link and detail accordions, Space greeting, Sections menu, and glows. Experience dates share the organization line and wrap when needed. Built the Rust module and production website; all nine Node tests and eight browser scenarios passed. Three production-preview scenarios passed after the final camera focus/resource cleanup changes. Inspected updated desktop and mobile 3D screenshots.

Space-tab flight revision: replaced the 2D map with 3D WebGPU navigation. Browser checks cover WASD movement with orbit motion paused, right-drag look, wheel zoom, camera reset, actual left-click picking on the About sun, flying out of an open panel, all category destinations, absent-WebGPU fallback, and automated accessibility. The Space tab loads no Rust worker/WASM.
