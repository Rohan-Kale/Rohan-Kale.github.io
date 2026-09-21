# Read-only reference copies

Copied unchanged from `C:\Users\Rohan\Space-Simulator` at commit `80bbfc0ae9f255e8f4b21c1a4238917a5705d77a`:

- `solar_system.rs`: original initializer. The build extracts its G and planet tuples for orbital navigation.
- `gravity.wgsl`: original GPU physics. The executable browser adaptation is `src/shaders/gravity.wgsl`.
- `camera.rs`: original projection/direction math, ported by `src/camera.js` with native controls from `main.rs`.
- `example_object.rs`: original sphere mesh/instance layout, reproduced by `src/simulator-renderer.js`.

The three rendering shaders in `src/shaders/particle.wgsl`, `star.wgsl`, and `velocity.wgsl` are also unchanged source copies. Rust octree provenance is in `rust-simulator/README.md`.

The original repository is never modified by portfolio commands and is not a build dependency. No original executable, Cargo output, or Git metadata is copied. The native simulator remains the canonical desktop project; this task tests the browser port.
