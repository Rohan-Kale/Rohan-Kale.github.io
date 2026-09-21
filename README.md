# Rohan — Portfolio

A compact portfolio with **Plain** and **Space** modes, plus a playable Rust Space Simulator. All work is contained in `C:\Users\Rohan\Portfolio-Website`. The original `C:\Users\Rohan\Space-Simulator` is read-only and unchanged.

## Run locally

Requires Node.js 22.12+ and npm; tested with Node 24.

```powershell
cd C:\Users\Rohan\Portfolio-Website
npm ci
npm run dev
```

Open the URL shown in the terminal, normally `http://127.0.0.1:5173/`.

## Portfolio modes

- **Plain** is the default. Your greeting, email, and resume stay visible. About, Projects, Experience (including skills), and Contact replace each other in the content panel. There is no page scrolling; long content can scroll inside its panel so it remains accessible on small screens.
- **Space** places About at the central sun and Projects, Experience, and Contact on orbiting planets. Fly with WASD, use right-drag to look and the wheel to zoom, then left-click a body to approach it and open its content. Space/Shift moves vertically. Reset view returns to the overview; switch to Plain for direct section navigation. The outer create-your-own-galaxy planet opens the playground. Escape or the close button returns to the system. Motion can be paused, and reduced-motion preferences are respected.
- The mode preference is stored only on the visitor’s device. Plain mode does not download the space scene, simulator controller, worker, or WebAssembly module.
- Without JavaScript, all portfolio sections appear as regular readable HTML. Failed optional graphics return to Plain mode.

## Simulator playground

Open **Space Simulator** through the outer **create your own galaxy** planet in Space mode. This is a 3D browser port with the original rendering shaders, GPU gravity, and a Rust WebAssembly octree:

- 16–10,009 bodies. Desktop starts with the original Sun, eight planets, and 10,000 asteroids; small screens start with 512 bodies.
- Solar system, binary stars, and orbital disk presets.
- Speed, gravity, and Barnes–Hut approximation accuracy.
- Trails, velocity vectors, pause/resume, deterministic reset, and camera reset.
- WASD flies the camera, Space/Shift moves vertically, right-drag looks around, and scrolling changes the field of view. Arrow keys and `+` / `-` are keyboard alternatives. Touch supports drag, pinch, and flight buttons.

Changing a preset or body count resets the system. Gravity, speed, and accuracy affect subsequent integration steps. The browser uses the original sphere/star/velocity WGSL shaders, sphere mesh, camera defaults and controls. Rust builds the octree in a worker; an adapted version of the original gravity shader runs on WebGPU. Browser event handling and HTML controls replace winit/egui. It requires a WebGPU-capable browser with hardware acceleration; unavailable graphics leave the plain portfolio accessible. Read [the architecture](docs/ARCHITECTURE.md) for details.

The precompiled `public/simulator.wasm` is included. Running or deploying the site does **not** require Rust. To modify the physics, install a Rust toolchain with its `wasm32-unknown-unknown` standard library and run:

```powershell
npm run build:rust
npm run build
```

On this machine, the build script can also use the downloaded standard library in `.local/wasm-toolchain/`. It never modifies the original repo or the installed native toolchain.

## Edit content

Edit `content/portfolio.json`, then run `npm run content` (or restart the dev server). Both `npm run dev` and `npm run build` regenerate content automatically.

- Name, biography, projects, experience, skills, email, and social links live in that file. Role and introduction fields are retained for editing but are no longer displayed under the greeting.
- Experience and skills remain separately editable in the file but share one tab and one space body.
- The supplied email, `kalerohan42@gmail.com`, is already linked on the homepage and in Contact.
- Put a resume in `public/files/resume.pdf` and set `resume` to `/files/resume.pdf`, or use a public HTTPS URL. Until then the resume link is visibly labeled “Not added yet.”
- Add screenshots to `public/images/`, set a project’s `image` to `/images/filename.webp`, and provide useful `imageAlt` text. Empty image fields produce simple text entries.
- Projects need unique lowercase IDs. Projects accept HTTPS `source` and `demo` URLs; keep unknown links `null`.
- Square-bracketed fields are intentional placeholders. No unprovided experience, skills, or accomplishments are invented.

Structure: `src/template.html`; theme: `src/style.css`; navigation: `src/main.js`; space view: `src/scene.js` and `src/navigation-renderer.js`; playground: `src/simulator.js`; worker: `src/simulation.worker.js`; camera: `src/camera.js`; WebGPU rendering: `src/simulator-renderer.js`; shaders: `src/shaders/`; Rust octree: `rust-simulator/src/`.

Do not edit generated `index.html` or `src/generated/solar-system.js` directly.

## Build and deploy

```powershell
npm run build
npm run preview
```

Publish the **contents of `dist/`** to any static host. Build command: `npm run build`. Output directory: `dist`. Include `simulator.wasm` and the worker file under `assets/`. No backend, database, API keys, or SPA rewrite is required. Relative asset paths support subdirectory hosting. A host must allow Web Workers and same-origin WASM downloads; configure `script-src 'wasm-unsafe-eval'` and `worker-src 'self'` if you impose a strict Content Security Policy.

Deploy with HTTPS for WebGPU; localhost HTTP works for development. Use a server, not `file://`. This task prepares the site locally; it has not published it publicly.

## Check changes

```powershell
npm test
npx playwright test
```

Browser tests use installed Google Chrome and the running preview on port 5173. Tests cover compact navigation, both modes, actual Rust/WASM octree and WebGPU gravity, free-flight camera/zoom, simulator controls, reduced motion, no-JavaScript content, download failure/retry, responsiveness, and automated accessibility. Screenshots are saved in `.local/`.

See [verification](docs/VERIFICATION.md) and [Rust provenance](rust-simulator/README.md).


