// Same geometry, white colors, and indices as the original Object::create_sphere.
export function sphereMesh() {
  const vertices = [], indices = [], segments = 32;
  for (let i = 0; i <= segments; i++) for (let j = 0; j <= segments; j++) {
    const phi = Math.PI * i / segments, theta = 2 * Math.PI * j / segments;
    vertices.push(Math.cos(theta) * Math.sin(phi), Math.cos(phi), Math.sin(theta) * Math.sin(phi), 1, 1, 1, j / segments, i / segments);
  }
  for (let i = 0; i < segments; i++) for (let j = 0; j < segments; j++) {
    const a = i * (segments + 1) + j, b = a + segments + 1;
    indices.push(a, b, a + 1, a + 1, b, b + 1);
  }
  return { vertices: new Float32Array(vertices), indices: new Uint32Array(indices) };
}

