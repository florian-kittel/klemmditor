import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rotate, bounds, overlaps, validate, validateAll, makeStamp, stampParts, rotationPivot, rotateParts, pruneGroups, createGroup, History } from '../src/domain.js';
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
test('a stamp copies parts relative to the lowest part and rotates as a whole', () => {
  const parts = [
    { id: 'top', partId: 'brick-1x2', x: 20, y: 10, z: 12, yaw: 0, color: '#fff' },
    { id: 'low', partId: 'brick-2x4', x: 10, y: 10, z: 0, yaw: 1, color: '#000' },
  ];
  const stamp = makeStamp(parts, [{ id: 'g', name: 'Haus', partIds: ['top', 'low'] }, { id: 'h', name: 'Fremd', partIds: ['top', 'x'] }]);
  assert.deepEqual(stamp.groups, [{ name: 'Haus', members: [0, 1] }]);
  const placed = stampParts(stamp, { x: 100, y: 50, z: 4, yaw: 0 });
  assert.deepEqual(placed.map(({ x, y, z, yaw }) => ({ x, y, z, yaw })), [{ x: 110, y: 50, z: 16, yaw: 0 }, { x: 100, y: 50, z: 4, yaw: 1 }]);
  const turned = stampParts(stamp, { x: 0, y: 0, z: 0, yaw: 1 });
  assert.deepEqual(turned.map(({ x, y, z, yaw }) => ({ x, y, z, yaw })), [{ x: 0, y: 10, z: 12, yaw: 1 }, { x: 0, y: 0, z: 0, yaw: 2 }]);
  assert.equal(validateAll(turned, [], catalog), null);
  assert.match(validateAll(turned, [{ ...turned[1], id: 'block' }], catalog), /Kollision/);
});
test('groups lose deleted parts, dissolve below two parts and never share a part', () => {
  const doc = { parts: ['a', 'b', 'c'].map(id => ({ id })), groups: [{ id: 'g1', name: 'Gruppe', partIds: ['a', 'b', 'gone'] }] };
  assert.deepEqual(pruneGroups(doc).groups, [{ id: 'g1', name: 'Gruppe', partIds: ['a', 'b'] }]);
  assert.deepEqual(pruneGroups({ ...doc, parts: [{ id: 'a' }] }).groups, []);
  const regrouped = createGroup(doc, ['b', 'c'], 'g2', 'Gruppe 2');
  assert.deepEqual(regrouped.groups, [{ id: 'g2', name: 'Gruppe 2', partIds: ['b', 'c'] }]);
  assert.deepEqual(pruneGroups({ parts: [] }).groups, []);
});
test('rotating a selection keeps every part on the raster and four turns restore it', () => {
  const layouts = [
    [{ id: 'a', partId: 'brick-2x4', x: 0, y: 0, z: 0, yaw: 0 }],
    [{ id: 'a', partId: 'brick-1x2', x: 30, y: -20, z: 12, yaw: 0 }],
    [{ id: 'a', partId: 'brick-2x4', x: 0, y: 0, z: 0, yaw: 0 }, { id: 'b', partId: 'brick-1x1', x: 30, y: 10, z: 0, yaw: 0 }, { id: 'c', partId: 'brick-corner', x: 0, y: 0, z: 12, yaw: 2 }],
  ];
  for (const parts of layouts) {
    const pivot = rotationPivot(parts, catalog);
    for (const turns of [1, 3]) {
      let current = parts;
      for (let i = 0; i < 4; i++) {
        current = rotateParts(current, turns, pivot);
        for (const p of current) assert.equal(validate(p, current.filter(o => o.id !== p.id), catalog), null);
      }
      assert.deepEqual(current, parts);
    }
    assert.deepEqual(rotateParts(rotateParts(parts, 1, pivot), 3, pivot), parts);
  }
  const once = rotateParts(layouts[2], 1, rotationPivot(layouts[2], catalog));
  assert.deepEqual(once.map(p => p.yaw), [1, 1, 3]);
  assert.deepEqual(once.map(p => p.z), [0, 0, 12]);
});
