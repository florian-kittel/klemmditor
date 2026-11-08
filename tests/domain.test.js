import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rotate, bounds, overlaps, validate, History } from '../src/domain.js';
import { catalog } from '../src/catalog.js';

const part = { id: 'a', partId: 'brick-2x4', x: 0, y: 0, z: 0, yaw: 0 };
test('four rotations restore exact coordinates', () => {
  const p = { x: -17, y: 31, z: 4 };
  assert.deepEqual(Array.from({ length: 4 }).reduce(v => rotate(v, 1), p), p);
});
test('rotated bounds preserve the first stud origin', () => {
  assert.deepEqual(bounds({ ...part, yaw: 1 }, catalog[part.partId]), { minX: -35, maxX: 5, minY: -5, maxY: 15, minZ: 0, maxZ: 12 });
});
test('touching sides and stacking are not collisions', () => {
  const box = bounds(part, catalog[part.partId]);
  assert.equal(overlaps(box, bounds({ ...part, x: 20 }, catalog[part.partId])), false);
  assert.equal(validate({ ...part, id: 'b', z: 12 }, [part], catalog), null);
  assert.match(validate({ ...part, id: 'b' }, [part], catalog), /Kollision/);
});
test('invalid raster positions are rejected', () => assert.match(validate({ ...part, z: -4 }, [], catalog), /Raster/));
test('undo and redo restore independent document snapshots', () => {
  const h = new History({ parts: [] });
  h.execute({ parts: [part] });
  assert.equal(h.undo(), true); assert.equal(h.document.parts.length, 0);
  assert.equal(h.redo(), true); assert.deepEqual(h.document.parts, [part]);
});
