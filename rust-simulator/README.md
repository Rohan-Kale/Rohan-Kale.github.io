# Rust browser adapter provenance

Read-only source: `C:\Users\Rohan\Space-Simulator`, commit `80bbfc0ae9f255e8f4b21c1a4238917a5705d77a`.

`src/octree.rs` was copied from the original `src/physics/octree.rs`. The local CPU force calculation excludes nodes containing the current body from approximation. The original flattening method now supplies the browser GPU's 80-byte node layout. The original repository is unchanged.

`src/lib.rs` supplies compatible body/node types, original solar constants/radii/asteroid ranges, deterministic presets, a maximum 10,009 bodies, and ABI exports. The worker imports GPU body positions into Rust memory, calls `build_tree`, and transfers the resulting nodes back to WebGPU. The CPU velocity-Verlet exports remain available for reference tests; browser physics runs the adapted original WGSL gravity compute shader.

`public/simulator.wasm` is the included compiled module. `npm run build:rust` rebuilds it using a Rust toolchain with the wasm32-unknown-unknown standard library. This machine also has a matching standard library in `.local/wasm-toolchain`; nothing is installed in or built from the original repo. Normal website builds do not require Rust.

The browser uses original particle/star/velocity shaders and a JavaScript WebGPU/event adapter. Details and intentional browser differences are documented in `docs/ARCHITECTURE.md`. No native source, dependencies, executable, target output, or Git metadata were modified.
