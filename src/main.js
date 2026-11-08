import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { catalog } from './catalog.js';
import { partGeometry } from './part-geometry.js';
import { History, validate } from './domain.js';
import './style.css';

document.querySelector('#app').innerHTML = `<header><strong>▦ Klemmditor</strong><input id="name" aria-label="Projektname"><span id="save"></span><div class="spacer"></div><button id="undo">↶ Rückgängig</button><button id="redo">↷ Wiederholen</button><button id="export">JSON exportieren</button><label class="button">Importieren<input id="import" type="file" accept="application/json" hidden></label></header><main><aside><h2>Teilekatalog</h2><p>Teil auswählen und auf die Arbeitsfläche klicken.</p><div id="catalog"></div><h3>Farbe</h3><input type="color" id="color" value="#db4437" aria-label="Teilefarbe"><h3>Bauhöhe</h3><label>Modus <select id="placement"><option value="surface">Oberfläche</option><option value="fixed">Feste Höhe</option></select></label><label>Plattenhöhen <input type="number" id="height" value="0" min="0" step="1"></label><p>Bei fester Höhe gilt der Wert für die Unterkante des Teils.</p></aside><section class="workspace"><div class="tools"><button id="select" class="active">Auswählen · V</button><button id="place">Setzen · B</button><button id="rotate">Drehen · R</button><button id="delete">Löschen · Entf</button><span></span><button id="iso">Isometrisch</button><button id="top">Draufsicht</button></div><div id="viewport" tabindex="0" aria-label="3D-Arbeitsfläche"></div><div id="status" role="status">Teil im Katalog wählen, um mit dem Bauen zu beginnen.</div></section><aside class="right"><h2>Projekt</h2><div id="details"></div><h3>Materialliste</h3><div id="materials"></div><p>Früher Entwicklungsstand. Verbindungen, Gruppen und weitere Funktionen folgen.</p></aside></main>`;
const $ = id => document.getElementById(id);
const deleteTool = document.createElement('button');
deleteTool.id = 'delete-tool'; deleteTool.textContent = 'Löschwerkzeug · X';
$('delete').textContent = 'Auswahl löschen · Entf';
$('delete').before(deleteTool);
$('color').value = '#ffffff';
const swatches = document.createElement('div');
swatches.className = 'swatches';
swatches.setAttribute('aria-label', 'Standardfarben');
for (const [label, value] of [['Weiß', '#ffffff'], ['Grau', '#888888'], ['Schwarz', '#171717']]) {
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'swatch'; button.style.backgroundColor = value; button.dataset.color = value;
  button.title = label; button.setAttribute('aria-label', label);
  button.setAttribute('aria-pressed', String(value === $('color').value));
  button.onclick = () => { $('color').value = value; $('color').dispatchEvent(new Event('input')); };
  swatches.append(button);
}
$('color').before(swatches);
$('color').addEventListener('input', () => {
  for (const button of swatches.children) button.setAttribute('aria-pressed', String(button.dataset.color === $('color').value));
});
let saved; try { saved = JSON.parse(localStorage.getItem('klemmditor-project')); } catch { saved = null; }
const history = new History(saved && Array.isArray(saved.parts) ? saved : {name:'Mein Projekt',parts:[]});
let selected=null, hovered=null, mode='select', partId='brick-2x4', yaw=0, preview=null, blocked=false, lastPointer=null, down=null, drag=null, pan=null;
let framePending=false;
function requestRender(){if(!framePending){framePending=true;requestAnimationFrame(()=>{framePending=false;controls.update();renderer.render(scene,camera);});}}
const viewport=$('viewport'), scene=new THREE.Scene(); scene.background=new THREE.Color('#e9edf0');
const camera=new THREE.OrthographicCamera(-160,160,120,-120,1,4000); camera.position.set(200,200,200); camera.up.set(0,0,1); camera.lookAt(0,0,0);
const renderer=new THREE.WebGLRenderer({antialias:true}); renderer.setPixelRatio(Math.min(devicePixelRatio,2)); viewport.appendChild(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement); controls.enableDamping=true; controls.mouseButtons={LEFT:null,MIDDLE:THREE.MOUSE.PAN,RIGHT:THREE.MOUSE.ROTATE}; controls.update();
controls.addEventListener('change',requestRender);
const viewControls=document.createElement('div');viewControls.className='view-controls';viewControls.setAttribute('role','group');viewControls.setAttribute('aria-label','Ansicht drehen');
viewControls.innerHTML='<button type="button" id="view-left" aria-label="Ansicht 90 Grad nach links drehen" title="Ansicht nach links drehen">↶</button><button type="button" id="view-reset" title="Zur ursprünglichen Ausrichtung zurückkehren">Ausgangsrichtung · 0°</button><button type="button" id="view-right" aria-label="Ansicht 90 Grad nach rechts drehen" title="Ansicht nach rechts drehen">↷</button>';
viewport.append(viewControls);
function updateViewDirection(){const offset=camera.position.clone().sub(controls.target);const top=Math.hypot(offset.x,offset.y)<offset.length()*0.001;let angle=top?Math.atan2(-camera.up.x,camera.up.y):Math.atan2(offset.y,offset.x)-Math.PI/4;let degrees=Math.round(((angle*180/Math.PI+180)%360+360)%360-180);if(degrees===0)degrees=0;$('view-reset').textContent=degrees===0?'Ausgangsrichtung · 0°':`Zurück zu 0° · ${degrees>0?'+':''}${degrees}°`;$('view-reset').setAttribute('aria-label',`Aktuelle Ausrichtung ${degrees} Grad zur Ausgangsrichtung. Ausgangsrichtung wiederherstellen.`);}
function rotateView(angle){const axis=new THREE.Vector3(0,0,1),offset=camera.position.clone().sub(controls.target);if(Math.hypot(offset.x,offset.y)<offset.length()*0.001)camera.up.applyAxisAngle(axis,angle);else camera.position.copy(controls.target).add(offset.applyAxisAngle(axis,angle));camera.lookAt(controls.target);controls.update();updateViewDirection();}
$('view-left').onclick=()=>rotateView(Math.PI/2);$('view-right').onclick=()=>rotateView(-Math.PI/2);
$('view-reset').onclick=()=>{$('iso').click();};controls.addEventListener('change',updateViewDirection);updateViewDirection();
scene.add(new THREE.HemisphereLight(0xffffff,0x718091,2)); const light=new THREE.DirectionalLight(0xffffff,2); light.position.set(100,-100,250); scene.add(light);
// Part origins are stud centers; grid lines mark the cell boundaries between them.
const grid=new THREE.GridHelper(2000,200,0xaab5bc,0xcdd5da); grid.rotation.x=Math.PI/2; grid.position.set(5,5,0); scene.add(grid);
const model=new THREE.Group(), ghost=new THREE.Group(); scene.add(model,ghost); const raycaster=new THREE.Raycaster(), pointer=new THREE.Vector2();
function clear(group){ while(group.children.length){const child=group.children[0];group.remove(child);child.traverse(o=>{if(o.geometry&&!o.geometry.userData.shared)o.geometry.dispose();if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());});} }
function makePart(p,isGhost=false){
  const d=catalog[p.partId],group=new THREE.Group(), color=isGhost?(validate(p,history.document.parts,catalog,drag?new Set([drag.original.id]):undefined)?'#d34848':'#2ca87f'):(p.color||'#db4437');
  const geometry=partGeometry(p.partId,d);
  group.add(new THREE.Mesh(geometry.body,new THREE.MeshStandardMaterial({color,transparent:isGhost,opacity:isGhost?.52:1})));
  if(geometry.insert){const transparent=isGhost||d.assembly==='window';group.add(new THREE.Mesh(geometry.insert,new THREE.MeshStandardMaterial({color:isGhost?color:d.assembly==='window'?'#9ccbdc':'#6c4735',transparent,opacity:isGhost?.52:transparent?.5:1,depthWrite:!transparent})));}
  if(p.id===selected&&!isGhost)group.add(new THREE.LineSegments(geometry.edges,new THREE.LineBasicMaterial({color:'#1169db'})));
  group.position.set(p.x,p.y,p.z);group.rotation.z=p.yaw*Math.PI/2;group.userData.partId=p.id;return group;
}
let ghostKey='';
function updateGhost(){const active=(mode==='place'||drag?.active)&&preview;const error=active?validate(preview,history.document.parts,catalog,drag?new Set([drag.original.id]):undefined):null;const nextKey=active?JSON.stringify([preview,error]):'';if(nextKey!==ghostKey){clear(ghost);if(active)ghost.add(makePart(preview,true));ghostKey=nextKey;requestRender();}}
function syncModel(){
  setHover(null);
  const existing=new Map(model.children.map(group=>[group.userData.partId,group]));
  for(const part of history.document.parts){
    const signature=JSON.stringify([part,part.id===selected]);const old=existing.get(part.id);existing.delete(part.id);
    if(old?.userData.signature===signature)continue;
    if(old){model.remove(old);clear(old);}
    const group=makePart(part);group.userData.signature=signature;model.add(group);
  }
  for(const group of existing.values()){model.remove(group);clear(group);}
  requestRender();
}
function persist(){try{localStorage.setItem('klemmditor-project',JSON.stringify(history.document));$('save').textContent='Lokal gespeichert';}catch{$('save').textContent='Speichern fehlgeschlagen – JSON exportieren';}}
function render(){syncModel();$('name').value=history.document.name;$('details').textContent=`${history.document.parts.length} Teile${selected?' · 1 ausgewählt':''}`;const counts=new Map();for(const p of history.document.parts){const def=catalog[p.partId], keys=def.assembly?[`${def.label} – Rahmen · ${p.color}`,`${def.label} – ${def.assembly==='window'?'Scheibe':'Türblatt'}`]:[`${def.label} · ${p.color}`];for(const key of keys)counts.set(key,(counts.get(key)||0)+1);}$('materials').replaceChildren(...Array.from(counts,([name,count])=>{const row=document.createElement('div');row.className='material';row.textContent=`${name} × ${count}`;return row;}));$('undo').disabled=!history.undoStack.length;$('redo').disabled=!history.redoStack.length;updateGhost();}
function commit(doc){history.execute(doc);persist();render();}
function setMode(next){cancelDrag();cancelPan();setHover(null);mode=next;preview=null;blocked=false;$('select').classList.toggle('active',mode==='select');$('place').classList.toggle('active',mode==='place');deleteTool.classList.toggle('active',mode==='delete');deleteTool.setAttribute('aria-pressed',String(mode==='delete'));renderer.domElement.style.cursor=mode==='delete'?'crosshair':'';$('status').textContent=mode==='place'?'Setzen · Mausrad dreht, Klick setzt, Strg+Klick setzt mehrfach. Esc oder Rechtsklick bricht ab.':mode==='delete'?'Löschen · Stein anklicken. Mit Strg+Z rückgängig machen.':'Auswählen · Stein oder freies Raster ziehen.';updateGhost();}
function cancelSelection(){selected=null;setMode('select');render();}
function point(e){const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);}
function pickedPart(e){point(e);const hit=raycaster.intersectObjects(model.children,true)[0];let obj=hit?.object;while(obj&&!obj.userData.partId)obj=obj.parent;return obj?.userData.partId||null;}
function setHover(id){
  if(id===hovered)return;
  for(const group of model.children){if(group.userData.partId!==hovered&&group.userData.partId!==id)continue;group.traverse(obj=>{if(!obj.isMesh)return;const material=obj.material;if(!material.userData.original)material.userData.original={opacity:material.opacity,transparent:material.transparent,depthWrite:material.depthWrite};const original=material.userData.original, active=group.userData.partId===id;material.opacity=active?original.opacity*.65:original.opacity;material.transparent=active||original.transparent;material.depthWrite=active?false:original.depthWrite;material.needsUpdate=true;});}
  hovered=id;
  requestRender();
}
function project(e){point(e);let z=Number($('height').value)*4;if($('placement').value==='surface'){const hit=raycaster.intersectObjects(model.children,true)[0];let obj=hit?.object;while(obj&&!obj.userData.partId)obj=obj.parent;const target=history.document.parts.find(p=>p.id===obj?.userData.partId);if(target)z=target.z+catalog[target.partId].height;else z=0;}const plane=new THREE.Plane(new THREE.Vector3(0,0,1),-z), p=new THREE.Vector3();if(!raycaster.ray.intersectPlane(plane,p))return;preview={id:'preview',partId,x:Math.round(p.x/10)*10,y:Math.round(p.y/10)*10,z,yaw,color:$('color').value};$('status').textContent=validate(preview,history.document.parts,catalog)||`Vorschau: X ${preview.x}, Y ${preview.y}, Z ${preview.z} · Klicken zum Setzen`;updateGhost();}
function cancelDrag(){if(!drag)return;const group=model.children.find(g=>g.userData.partId===drag.original.id);if(group)group.visible=true;const pointerId=drag.pointerId;drag=null;down=null;preview=null;if(renderer.domElement.hasPointerCapture(pointerId))renderer.domElement.releasePointerCapture(pointerId);updateGhost();}
function cancelPan(){if(!pan)return;const pointerId=pan.pointerId;pan=null;down=null;renderer.domElement.style.cursor=mode==='delete'?'crosshair':'';if(renderer.domElement.hasPointerCapture(pointerId))renderer.domElement.releasePointerCapture(pointerId);}
function movePreview(e){
  point(e);let z=Number($('height').value)*4;
  if($('placement').value==='surface'){
    const targets=model.children.filter(g=>g.userData.partId!==drag.original.id);
    const hit=raycaster.intersectObjects(targets,true)[0];let obj=hit?.object;while(obj&&!obj.userData.partId)obj=obj.parent;
    const target=history.document.parts.find(p=>p.id===obj?.userData.partId);z=target?target.z+catalog[target.partId].height:0;
  }
  const p=new THREE.Vector3();if(!raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,0,1),-z),p))return;
  preview={...drag.original,x:Math.round((p.x-drag.offsetX)/10)*10,y:Math.round((p.y-drag.offsetY)/10)*10,z};
  $('status').textContent=validate(preview,history.document.parts,catalog,new Set([drag.original.id]))||`Verschieben: X ${preview.x}, Y ${preview.y}, Z ${preview.z} · Loslassen zum Setzen · Esc bricht ab`;updateGhost();
}
let rightDown=null;
renderer.domElement.addEventListener('wheel',e=>{if(mode!=='place'||!e.deltaY)return;e.preventDefault();e.stopImmediatePropagation();yaw=(yaw+(e.deltaY>0?1:3))%4;if(preview){preview.yaw=yaw;updateGhost();}},{capture:true,passive:false});
renderer.domElement.addEventListener('pointerdown',e=>{if(e.button===0){down={x:e.clientX,y:e.clientY};if(mode==='select'){const id=pickedPart(e),original=history.document.parts.find(p=>p.id===id);if(original){point(e);const p=new THREE.Vector3();if(raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,0,1),-original.z),p))drag={original,pointerId:e.pointerId,offsetX:p.x-original.x,offsetY:p.y-original.y,active:false};}else{point(e);const anchor=new THREE.Vector3();if(raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,0,1),0),anchor))pan={pointerId:e.pointerId,anchor,active:false};}}}else if(e.button===2)rightDown={x:e.clientX,y:e.clientY};});
renderer.domElement.addEventListener('pointermove',e=>{if(pan&&e.pointerId===pan.pointerId&&down){if(!pan.active&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>(e.pointerType==='touch'?8:4)){pan.active=true;setHover(null);renderer.domElement.setPointerCapture(e.pointerId);renderer.domElement.style.cursor='grabbing';}if(pan.active){point(e);const current=new THREE.Vector3();if(raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,0,1),0),current)){const delta=pan.anchor.clone().sub(current);camera.position.add(delta);controls.target.add(delta);camera.updateMatrixWorld();controls.update();}return;}}if(drag&&e.pointerId===drag.pointerId&&down){if(!drag.active&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>(e.pointerType==='touch'?8:4)){drag.active=true;setHover(null);selected=drag.original.id;const group=model.children.find(g=>g.userData.partId===selected);if(group)group.visible=false;renderer.domElement.setPointerCapture(e.pointerId);}if(drag.active){movePreview(e);return;}}if(blocked&&lastPointer&&Math.hypot(e.clientX-lastPointer.x,e.clientY-lastPointer.y)>=8)blocked=false;if(e.buttons||e.pointerType==='touch'){setHover(null);return;}if(mode==='place')project(e);else setHover(pickedPart(e));});
renderer.domElement.addEventListener('pointerup',e=>{if(e.button===2){if(rightDown&&Math.hypot(e.clientX-rightDown.x,e.clientY-rightDown.y)<=4)cancelSelection();rightDown=null;return;}if(pan?.active&&e.pointerId===pan.pointerId){cancelPan();return;}pan=null;if(drag?.active&&e.pointerId===drag.pointerId){const original=drag.original, next=preview, valid=next&&!validate(next,history.document.parts,catalog,new Set([original.id]));cancelDrag();if(valid&&(next.x!==original.x||next.y!==original.y||next.z!==original.z))commit({...history.document,parts:history.document.parts.map(p=>p.id===original.id?next:p)});else render();$('status').textContent=valid?'Stein positioniert.':'Position belegt – Stein bleibt an seinem Platz.';return;}drag=null;if(!down||e.button!==0||Math.hypot(e.clientX-down.x,e.clientY-down.y)>4){down=null;return;}down=null;if(mode==='place'){if(e.pointerType==='touch'){project(e);return;}if(!preview||blocked||validate(preview,history.document.parts,catalog))return;commit({...history.document,parts:[...history.document.parts,{...preview,id:crypto.randomUUID()}]});if(e.ctrlKey){blocked=true;lastPointer={x:e.clientX,y:e.clientY};}else setMode('select');}else{const id=pickedPart(e);if(mode==='delete'){if(id){if(selected===id)selected=null;commit({...history.document,parts:history.document.parts.filter(p=>p.id!==id)});}}else{selected=id;render();if(e.pointerType!=='touch')setHover(id);}}});
renderer.domElement.addEventListener('pointerleave',()=>setHover(null));renderer.domElement.addEventListener('lostpointercapture',()=>{if(drag?.active)cancelDrag();if(pan?.active)cancelPan();});renderer.domElement.addEventListener('pointercancel',()=>{cancelDrag();cancelPan();down=null;rightDown=null;setHover(null);});window.addEventListener('blur',()=>{cancelDrag();cancelPan();down=null;rightDown=null;setHover(null);});
function resize(){const w=viewport.clientWidth,h=viewport.clientHeight;renderer.setSize(w,h);const a=w/h;camera.left=-120*a;camera.right=120*a;camera.top=120;camera.bottom=-120;camera.updateProjectionMatrix();requestRender();}new ResizeObserver(resize).observe(viewport);resize();
let brickHeight='normal';
const heightChoice=document.createElement('div'); heightChoice.className='height-choice'; heightChoice.setAttribute('role','group'); heightChoice.setAttribute('aria-label','Steinhöhe');
for(const [value,label] of [['normal','Normal'],['flat','Flach']]){const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.height=value;b.onclick=()=>{brickHeight=value;const prefix=value==='flat'?'plate-':'brick-';if(/^(brick|plate)-/.test(partId)){const variant=prefix+partId.replace(/^(brick|plate)-/,'');if(catalog[variant]){partId=variant;if(preview){preview.partId=variant;updateGhost();}}}drawCatalog();};heightChoice.append(b);}
$('catalog').before(heightChoice);
function drawCatalog(){
  for(const button of heightChoice.children){const active=button.dataset.height===brickHeight;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));}
  $('catalog').replaceChildren();
  const prefix=brickHeight==='flat'?'plate-':'brick-';
  const grid=document.createElement('div');grid.className='catalog-grid';
  const entries=Object.entries(catalog).filter(([id,def])=>id.startsWith(prefix)&&!def.corner&&!def.assembly);
  const sizes=[...new Set(entries.map(([,def])=>Math.max(def.width,def.depth)))].sort((a,b)=>a-b);
  for(const [id,def] of entries){const b=document.createElement('button');b.className='catalog-item';b.textContent=def.label;b.style.gridColumn=String(Math.min(def.width,def.depth));b.style.gridRow=String(sizes.indexOf(Math.max(def.width,def.depth))+1);b.onclick=()=>{partId=id;setMode('place');};grid.append(b);}
  $('catalog').append(grid);
  const heading=document.createElement('h3');heading.className='catalog-heading';heading.textContent='Spezialsteine';$('catalog').append(heading);
  const special=document.createElement('div');special.className='catalog-grid';
  for(const [id,def] of Object.entries(catalog)){if(!(def.assembly||(def.corner&&id.startsWith(prefix))))continue;const b=document.createElement('button');b.className='catalog-item';b.textContent=def.label;b.onclick=()=>{partId=id;setMode('place');};special.append(b);}
  $('catalog').append(special);
}
drawCatalog();
$('select').onclick=()=>setMode('select');$('place').onclick=()=>setMode('place');$('rotate').onclick=()=>{yaw=(yaw+1)%4;if(preview){preview.yaw=yaw;updateGhost();}};
deleteTool.onclick=()=>setMode('delete');deleteTool.setAttribute('aria-pressed','false');
$('delete').onclick=()=>{if(selected){commit({...history.document,parts:history.document.parts.filter(p=>p.id!==selected)});selected=null;render();}};
$('undo').onclick=()=>{if(history.undo()){selected=null;persist();render();}};$('redo').onclick=()=>{if(history.redo()){selected=null;persist();render();}};
$('name').onchange=e=>commit({...history.document,name:e.target.value.trim()||'Mein Projekt'});$('height').onchange=()=>{blocked=false;$('placement').value='fixed';if(preview){preview.z=Number($('height').value)*4;updateGhost();}};$('placement').onchange=()=>{preview=null;blocked=false;updateGhost();};$('color').oninput=()=>{const color=$('color').value;if(mode==='select'&&selected&&!drag){const part=history.document.parts.find(p=>p.id===selected);if(part&&part.color!==color)commit({...history.document,parts:history.document.parts.map(p=>p.id===selected?{...p,color}:p)});}else if(mode==='place'&&preview){preview.color=color;updateGhost();}};
$('iso').onclick=()=>{camera.position.copy(controls.target).add(new THREE.Vector3(200,200,200));camera.up.set(0,0,1);controls.update();};$('top').onclick=()=>{camera.position.copy(controls.target).add(new THREE.Vector3(0,0,300));camera.up.set(0,1,0);controls.update();};
$('export').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(history.document,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='klemmditor.json';a.click();URL.revokeObjectURL(url);};
$('import').onchange=async e=>{try{const doc=JSON.parse(await e.target.files[0].text());if(typeof doc.name!=='string'||!Array.isArray(doc.parts)||doc.parts.some(p=>!catalog[p.partId]||validate(p,[],catalog)||typeof p.id!=='string'||typeof p.color!=='string'))throw Error('Ungültiges oder nicht unterstütztes Projekt');if(!confirm('Aktuelles Projekt durch Import ersetzen?'))return;commit(doc);selected=null;render();}catch(err){alert(`Import fehlgeschlagen: ${err.message}`);}finally{e.target.value='';}};
let controlCopy=false;
window.addEventListener('keydown',e=>{
  if(/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))return;
  const key=e.key.toLowerCase();
  if(key==='control'&&!e.repeat&&mode==='select'&&selected&&!drag&&!down){
    const part=history.document.parts.find(p=>p.id===selected);
    if(part){partId=part.partId;yaw=part.yaw;$('color').value=part.color;selected=null;setMode('place');$('color').dispatchEvent(new Event('input'));render();controlCopy=true;}
  }else if((e.ctrlKey||e.metaKey)&&(key==='z'||key==='y')){
    e.preventDefault();if(controlCopy){setMode('select');controlCopy=false;}(key==='y'||e.shiftKey?$('redo'):$('undo')).click();
  }else if(!e.ctrlKey&&!e.metaKey&&!e.altKey&&key==='x')setMode('delete');else if(key==='v')setMode('select');else if(key==='b')setMode('place');else if(key==='r')$('rotate').click();else if(key==='delete'||key==='backspace')$('delete').click();else if(key==='escape')cancelSelection();
});
window.addEventListener('keyup',e=>{if(e.key==='Control')controlCopy=false;});render();
