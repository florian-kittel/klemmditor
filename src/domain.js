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

export function validate(part, parts, catalog, excluded = new Set()) {
  const definition = catalog[part.partId];
  if (!definition) return 'Unbekanntes Teil';
  if (![part.x, part.y, part.z, part.yaw].every(Number.isInteger) || part.x % 10 || part.y % 10 || part.z % 4 || part.z < 0 || part.yaw < 0 || part.yaw > 3) return 'Position oder Drehung liegt außerhalb des Rasters';
  const box = bounds(part, definition);
  const conflict = parts.find(other => !excluded.has(other.id) && overlaps(box, bounds(other, catalog[other.partId])));
  return conflict ? `Kollision mit ${conflict.id}` : null;
}

export class History {
  constructor(document) { this.document = structuredClone(document); this.undoStack = []; this.redoStack = []; }
  execute(next) { this.undoStack.push(structuredClone(this.document)); this.document = structuredClone(next); this.redoStack = []; }
  undo() { if (!this.undoStack.length) return false; this.redoStack.push(this.document); this.document = this.undoStack.pop(); return true; }
  redo() { if (!this.redoStack.length) return false; this.undoStack.push(this.document); this.document = this.redoStack.pop(); return true; }
}
