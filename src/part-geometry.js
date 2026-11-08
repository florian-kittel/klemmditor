import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { solids } from './catalog.js';

const cache = new Map();
// Catalog definitions are fixed for this session. Shared geometry lives as long as the app.
export function partGeometry(id, definition) {
  if (cache.has(id)) return cache.get(id);
  const body = [], inserts = [], edges = [], rimPoints = [];
  if (definition.corner) {
    const outline = new THREE.Shape();
    outline.moveTo(-4.95,-4.95);
    for (const [x,y] of [[14.95,-4.95],[14.95,4.95],[4.95,4.95],[4.95,14.95],[-4.95,14.95]]) outline.lineTo(x,y);
    outline.closePath();
    const extruded = new THREE.ExtrudeGeometry(outline,{depth:definition.height-.1,bevelEnabled:false,steps:1});
    extruded.translate(0,0,.05);
    const geometry = mergeVertices(extruded);extruded.dispose();
    body.push(geometry);edges.push(new THREE.EdgesGeometry(geometry));
  }
  for (const box of definition.corner ? [] : solids(definition)) {
    const geometry = new THREE.BoxGeometry(box.w-.1, box.d-.1, box.h-.1);
    geometry.translate(box.x+box.w/2, box.y+box.d/2, box.z+box.h/2);
    (box.insert ? inserts : body).push(geometry);
    edges.push(new THREE.EdgesGeometry(geometry));
  }
  for (let x=0; x<definition.width; x++) for (let y=0; y<definition.depth; y++) {
    if (definition.corner && x===1 && y===1) continue;
    const geometry = new THREE.CylinderGeometry(3,3,1.5,12);
    geometry.rotateX(Math.PI/2); geometry.translate(x*10,y*10,definition.height+.75);
    body.push(geometry);
    // One shared line geometry for all stud rims, visible even directly from above.
    for (let i=0; i<12; i++) for (const angle of [i*Math.PI/6,(i+1)*Math.PI/6]) {
      rimPoints.push(x*10+3*Math.cos(angle),y*10+3*Math.sin(angle),definition.height+1.51);
    }
  }
  const rims = new THREE.BufferGeometry();
  rims.setAttribute('position',new THREE.Float32BufferAttribute(rimPoints,3));
  const result = { body: mergeGeometries(body), insert: inserts.length ? mergeGeometries(inserts) : null, edges: mergeGeometries(edges), rims };
  [...body,...inserts,...edges].forEach(g=>g.dispose());
  Object.values(result).forEach(g=>{if(g)g.userData.shared=true;});
  cache.set(id,result);
  return result;
}
