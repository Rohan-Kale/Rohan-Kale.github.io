import { G } from './generated/solar-system.js';

// The Rust initializer uses v = sqrt(G / distance). For a circular orbit,
// angular velocity is v / distance; the visual layout compresses AU distances.
export function angularVelocity(distance) {
  if (!Number.isFinite(distance) || distance <= 0) throw new RangeError('Distance must be positive');
  return Math.sqrt(G / distance) / distance;
}
export function orbitalPosition(radius, phase, years, distance) {
  const angle = phase + angularVelocity(distance) * years;
  return [radius * Math.cos(angle), 0, radius * Math.sin(angle)];
}
