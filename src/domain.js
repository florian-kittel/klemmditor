import { solids } from './catalog.js';
// Domain coordinates: 10 units per stud, 4 units per plate, Z is vertical.
export const rotate = ({ x, y, z }, turns) => {
  switch (((turns % 4) + 4) % 4) {
    case 1: return { x: -y, y: x, z };
    case 2: return { x: -x, y: -y, z };
    case 3: return { x: y, y: -x, z };
    default: return { x, y, z };
  }
};

export function bounds(part, definition) {
  const corners = [];
  for (const x of [-5, definition.width * 10 - 5]) {
    for (const y of [-5, definition.depth * 10 - 5]) {
      const p = rotate({ x, y, z: 0 }, part.yaw);
      corners.push({ x: p.x + part.x, y: p.y + part.y });
    }
  }
  return { minX: Math.min(...corners.map(p => p.x)), maxX: Math.max(...corners.map(p => p.x)), minY: Math.min(...corners.map(p => p.y)), maxY: Math.max(...corners.map(p => p.y)), minZ: part.z, maxZ: part.z + definition.height };
}

export function overlaps(a, b) {
  return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY && a.minZ < b.maxZ && a.maxZ > b.minZ;
}

const boundsCache = new WeakMap();
function solidBounds(part, definition) {
  const key = `${part.x},${part.y},${part.z},${part.yaw}`;
  const cached = boundsCache.get(part);
  if (cached?.key === key && cached.definition === definition) return cached.boxes;
  const boxes = solids(definition).map(box => {
    const corners = [];
    for (const x of [box.x, box.x + box.w]) for (const y of [box.y, box.y + box.d]) {
      const p = rotate({ x, y, z: 0 }, part.yaw);
      corners.push({ x: p.x + part.x, y: p.y + part.y });
    }
    return { minX: Math.min(...corners.map(p=>p.x)), maxX: Math.max(...corners.map(p=>p.x)), minY: Math.min(...corners.map(p=>p.y)), maxY: Math.max(...corners.map(p=>p.y)), minZ: part.z + box.z, maxZ: part.z + box.z + box.h };
  });
  boundsCache.set(part, { key, definition, boxes });
  return boxes;
}

export function validate(part, parts, catalog, excluded = new Set()) {
  const definition = catalog[part.partId];
  if (!definition) return 'Unbekanntes Teil';
  if (![part.x, part.y, part.z, part.yaw].every(Number.isInteger) || part.x % 10 || part.y % 10 || part.z % 4 || part.z < 0 || part.yaw < 0 || part.yaw > 3) return 'Position oder Drehung liegt außerhalb des Rasters';
  const boxes = solidBounds(part, definition);
  const conflict = parts.find(other => !excluded.has(other.id) && boxes.some(box => solidBounds(other, catalog[other.partId]).some(otherBox => overlaps(box, otherBox))));
  return conflict ? `Kollision mit ${conflict.id}` : null;
}

export function validateAll(parts, existing, catalog, excluded = new Set()) {
  for (const part of parts) { const error = validate(part, existing, catalog, excluded); if (error) return error; }
  return null;
}

// Copy template for several parts. Offsets are relative to the lowest part, so placing the
// template on a surface puts the bottom of the copy there. Groups fully inside are copied too.
export function makeStamp(parts, groups = []) {
  const anchor = parts.reduce((low, p) => (p.z < low.z ? p : low));
  const index = new Map(parts.map((p, i) => [p.id, i]));
  return {
    parts: parts.map(p => ({ partId: p.partId, color: p.color, yaw: p.yaw, dx: p.x - anchor.x, dy: p.y - anchor.y, dz: p.z - anchor.z })),
    groups: groups.filter(g => g.partIds.every(id => index.has(id))).map(g => ({ name: g.name, members: g.partIds.map(id => index.get(id)) })),
  };
}

// Parts of a stamp placed at an anchor position, rotated as a whole by `yaw` quarter turns.
export function stampParts(stamp, { x, y, z, yaw }) {
  return stamp.parts.map((r, i) => {
    const o = rotate({ x: r.dx, y: r.dy, z: r.dz }, yaw);
    return { id: `preview-${i}`, partId: r.partId, color: r.color, x: x + o.x, y: y + o.y, z: z + o.z, yaw: (r.yaw + yaw) % 4 };
  });
}

// Pivot for turning parts as a whole: the middle of their footprint. It must lie on a stud center
// (x≡0, y≡0) or a grid crossing (x≡5, y≡5) so every part stays on the raster; when the footprint
// has one even and one odd side the middle is off by half a stud and is moved onto the raster.
export function rotationPivot(parts, catalog) {
  const boxes = parts.map(p => bounds(p, catalog[p.partId]));
  const cx = (Math.min(...boxes.map(b => b.minX)) + Math.max(...boxes.map(b => b.maxX))) / 2;
  const cy = (Math.min(...boxes.map(b => b.minY)) + Math.max(...boxes.map(b => b.maxY))) / 2;
  const mod = v => ((v % 10) + 10) % 10;
  return { x: cx, y: mod(cy) === mod(cx) ? cy : cy - 5 };
}

// Turns parts by quarter turns around a pivot. Reuse the pivot for consecutive turns of the same
// parts; a recomputed pivot can drift by half a stud and four turns would not restore the start.
export function rotateParts(parts, turns, pivot) {
  return parts.map(p => {
    const o = rotate({ x: p.x - pivot.x, y: p.y - pivot.y, z: p.z }, turns);
    return { ...p, x: pivot.x + o.x, y: pivot.y + o.y, yaw: (((p.yaw + turns) % 4) + 4) % 4 };
  });
}

// A part belongs to at most one group; groups need at least two existing parts.
export function pruneGroups(doc) {
  const ids = new Set(doc.parts.map(p => p.id)), seen = new Set();
  const groups = (doc.groups || []).map(g => ({ ...g, partIds: g.partIds.filter(id => ids.has(id) && !seen.has(id) && seen.add(id)) })).filter(g => g.partIds.length > 1);
  return { ...doc, groups };
}

export function createGroup(doc, partIds, id, name) {
  const members = new Set(partIds);
  const others = (doc.groups || []).map(g => ({ ...g, partIds: g.partIds.filter(p => !members.has(p)) }));
  return pruneGroups({ ...doc, groups: [...others, { id, name, partIds: [...members] }] });
}

export class History {
  constructor(document) { this.document = structuredClone(document); this.undoStack = []; this.redoStack = []; }
  execute(next) { this.undoStack.push(structuredClone(this.document)); this.document = structuredClone(next); this.redoStack = []; }
  undo() { if (!this.undoStack.length) return false; this.redoStack.push(this.document); this.document = this.undoStack.pop(); return true; }
  redo() { if (!this.redoStack.length) return false; this.undoStack.push(this.document); this.document = this.redoStack.pop(); return true; }
}
