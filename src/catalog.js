export const catalog = Object.freeze({
  'brick-2x4': { label: 'Stein 2 × 4', width: 2, depth: 4, height: 12 },
  'plate-2x4': { label: 'Platte 2 × 4', width: 2, depth: 4, height: 4 },
  'brick-1x1': { label: 'Stein 1 × 1', width: 1, depth: 1, height: 12 },
  'brick-1x2': { label: 'Stein 1 × 2', width: 2, depth: 1, height: 12 },
  'brick-1x4': { label: 'Stein 1 × 4', width: 4, depth: 1, height: 12 },
  'plate-1x1': { label: 'Platte 1 × 1', width: 1, depth: 1, height: 4 },
  'plate-1x2': { label: 'Platte 1 × 2', width: 2, depth: 1, height: 4 },
  'plate-1x4': { label: 'Platte 1 × 4', width: 4, depth: 1, height: 4 },
  'plate-2x2': { label: 'Platte 2 × 2', width: 2, depth: 2, height: 4 },
  'brick-corner': { label: 'Eckstein 2 × 2', width: 2, depth: 2, height: 12, corner: true },
  'plate-corner': { label: 'Eckplatte 2 × 2', width: 2, depth: 2, height: 4, corner: true },
  'window-4x2': { label: 'Fenster 4 × 2', width: 4, depth: 2, height: 36, assembly: 'window' },
  'window-2x2': { label: 'Fenster 2 × 2', width: 2, depth: 2, height: 36, assembly: 'window' },
  'door-4x2': { label: 'Tür 4 × 2', width: 4, depth: 2, height: 72, assembly: 'door' },
  'window-4x1': { label: 'Fenster 4 × 1', width: 4, depth: 1, height: 36, assembly: 'window' },
  'window-2x1': { label: 'Fenster 2 × 1', width: 2, depth: 1, height: 36, assembly: 'window' },
  'door-4x1': { label: 'Tür 4 × 1', width: 4, depth: 1, height: 72, assembly: 'door' },
});

// Frame and insert are separate solids; the rest of the opening stays empty.
export function solids(def) {
  const w=def.width*10, d=def.depth*10, h=def.height;
  if (def.corner) return [{x:-5,y:-5,z:0,w:20,d:10,h},{x:-5,y:5,z:0,w:10,d:10,h}];
  if (!def.assembly) return [{x:-5,y:-5,z:0,w,d,h}];
  const t=2;
  return [
    {x:-5,y:-5,z:0,w:t,d,h}, {x:w-5-t,y:-5,z:0,w:t,d,h},
    {x:-5+t,y:-5,z:0,w:w-2*t,d,h:t}, {x:-5+t,y:-5,z:h-t,w:w-2*t,d,h:t},
    {x:-5+t,y:(d-1)/2-5,z:t,w:w-2*t,d:1,h:h-2*t,insert:true},
  ];
}
