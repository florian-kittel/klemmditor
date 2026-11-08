import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { catalog } from './catalog.js';
import { partGeometry } from './part-geometry.js';
import { History, validate } from './domain.js';
import { ProjectStore, isProjectDocument } from './projects.js';
import './style.css';

document.querySelector('#app').innerHTML = `<header><strong>▦ Klemmditor</strong><input id="name" aria-label="Projektname"><span id="save"></span><div class="spacer"></div><button id="undo">↶ Rückgängig</button><button id="redo">↷ Wiederholen</button><button id="export">JSON exportieren</button><label class="button">Importieren<input id="import" type="file" accept="application/json" hidden></label></header><main><aside><h2>Teilekatalog</h2><p>Teil auswählen und auf die Arbeitsfläche klicken.</p><div id="catalog"></div><h3>Farbe</h3><input type="color" id="color" value="#db4437" aria-label="Teilefarbe"><h3>Bauhöhe</h3><label>Modus <select id="placement"><option value="surface">Oberfläche</option><option value="fixed">Feste Höhe</option></select></label><label>Plattenhöhen <input type="number" id="height" value="0" min="0" step="1"></label><p>Bei fester Höhe gilt der Wert für die Unterkante des Teils.</p></aside><section class="workspace"><div class="tools"><button id="select" class="active">Auswählen · V</button><button id="place">Setzen · B</button><button id="rotate">Drehen · R</button><button id="delete">Löschen · Entf</button><span></span><button id="iso">Isometrisch</button><button id="top">Draufsicht</button></div><div id="viewport" tabindex="0" aria-label="3D-Arbeitsfläche"></div><div id="status" role="status">Teil im Katalog wählen, um mit dem Bauen zu beginnen.</div></section><aside class="right"><h2>Projekt</h2><div id="details"></div><h3>Materialliste</h3><div id="materials"></div><p>Früher Entwicklungsstand. Verbindungen, Gruppen und weitere Funktionen folgen.</p></aside></main>`;
const $ = id => document.getElementById(id);
const repeatPlacementLabel=document.createElement('label');repeatPlacementLabel.className='repeat-placement';
const repeatPlacement=document.createElement('input');repeatPlacement.type='checkbox';repeatPlacement.id='repeat-placement';
try{repeatPlacement.checked=localStorage.getItem('klemmditor:repeat-placement')==='true';}catch{}
repeatPlacementLabel.append(repeatPlacement,document.createTextNode('Gleichen Stein weiter setzen'));$('catalog').after(repeatPlacementLabel);
repeatPlacement.onchange=()=>{try{localStorage.setItem('klemmditor:repeat-placement',String(repeatPlacement.checked));}catch{}};
const newProjectButton=document.createElement('button');newProjectButton.textContent='Neu';newProjectButton.type='button';
const openProjectButton=document.createElement('button');openProjectButton.textContent='Öffnen';openProjectButton.type='button';
$('name').before(newProjectButton,openProjectButton);
const projectDialog=document.createElement('dialog');projectDialog.className='project-dialog';projectDialog.setAttribute('aria-labelledby','project-dialog-title');
projectDialog.innerHTML='<div class="project-dialog-header"><h2 id="project-dialog-title">Lokale Projekte öffnen</h2><button type="button" class="project-close" aria-label="Schließen">✕</button></div><div class="project-list"></div>';
document.body.append(projectDialog);projectDialog.querySelector('.project-close').onclick=()=>projectDialog.close();
const sideButton=document.createElement('button');sideButton.id='side';sideButton.textContent='Seitenansicht';$('top').after(sideButton);
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
let projectStore,initialProject,startupError=null;
try{projectStore=new ProjectStore(localStorage);initialProject=projectStore.startup();}catch(error){startupError=error;}
let currentProjectId=initialProject?.id||crypto.randomUUID();
const history = new History(initialProject?.document||{name:'Mein Projekt',parts:[]});
let selected=null, hovered=null, mode='select', partId='brick-2x4', yaw=0, preview=null, blocked=false, lastPointer=null, down=null, drag=null, pan=null;
let framePending=false;
function requestRender(){if(!framePending){framePending=true;requestAnimationFrame(()=>{framePending=false;controls.update();renderer.render(scene,camera);});}}
const viewport=$('viewport'), scene=new THREE.Scene(); scene.background=new THREE.Color('#e9edf0');
const camera=new THREE.OrthographicCamera(-160,160,120,-120,1,4000); camera.position.set(200,200,200); camera.up.set(0,0,1); camera.lookAt(0,0,0);
const renderer=new THREE.WebGLRenderer({antialias:true}); renderer.setPixelRatio(Math.min(devicePixelRatio,2)); viewport.appendChild(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement); controls.enableDamping=true; controls.mouseButtons={LEFT:null,MIDDLE:THREE.MOUSE.PAN,RIGHT:THREE.MOUSE.ROTATE}; controls.update();
controls.maxPolarAngle=Math.PI/2;
let viewPreset='iso';
controls.addEventListener('change',requestRender);
const viewControls=document.createElement('div');viewControls.className='view-controls';viewControls.setAttribute('role','group');viewControls.setAttribute('aria-label','Ansicht drehen');
viewControls.innerHTML='<button type="button" id="view-left" aria-label="Ansicht 90 Grad nach links drehen" title="Ansicht nach links drehen">↶</button><button type="button" id="view-reset" title="Zur ursprünglichen Ausrichtung zurückkehren">Ausgangsrichtung · 0°</button><button type="button" id="view-right" aria-label="Ansicht 90 Grad nach rechts drehen" title="Ansicht nach rechts drehen">↷</button>';
viewport.append(viewControls);
function updateViewDirection(){const offset=camera.position.clone().sub(controls.target);let angle=Math.atan2(offset.y,offset.x)-(viewPreset==='side'||viewPreset==='top'?-Math.PI/2:Math.PI/4);let degrees=Math.round(((angle*180/Math.PI+180)%360+360)%360-180);if(degrees===0)degrees=0;$('view-reset').textContent=degrees===0?'Ausgangsrichtung · 0°':`Zurück zu 0° · ${degrees>0?'+':''}${degrees}°`;$('view-reset').setAttribute('aria-label',`Aktuelle Ausrichtung ${degrees} Grad zur Ausgangsrichtung. Ausgangsrichtung wiederherstellen.`);}
function rotateView(angle){const axis=new THREE.Vector3(0,0,1),offset=camera.position.clone().sub(controls.target);camera.position.copy(controls.target).add(offset.applyAxisAngle(axis,angle));camera.lookAt(controls.target);controls.update();updateViewDirection();}
$('view-left').onclick=()=>rotateView(Math.PI/2);$('view-right').onclick=()=>rotateView(-Math.PI/2);
$('view-reset').onclick=()=>setView(viewPreset);controls.addEventListener('change',updateViewDirection);updateViewDirection();
scene.add(new THREE.HemisphereLight(0xffffff,0x718091,2)); const light=new THREE.DirectionalLight(0xffffff,2); light.position.set(100,-100,250); scene.add(light);
// Part origins are stud centers; grid lines mark the cell boundaries between them.
const grid=new THREE.GridHelper(2000,200,0xaab5bc,0xcdd5da); grid.rotation.x=Math.PI/2; grid.position.set(5,5,0); scene.add(grid);
const model=new THREE.Group(), ghost=new THREE.Group(); scene.add(model,ghost); const raycaster=new THREE.Raycaster(), pointer=new THREE.Vector2();
function clear(group){ while(group.children.length){const child=group.children[0];group.remove(child);child.traverse(o=>{if(o.geometry&&!o.geometry.userData.shared)o.geometry.dispose();if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());});} }
function makePart(p,isGhost=false){
  const d=catalog[p.partId],group=new THREE.Group(), color=isGhost?(validate(p,history.document.parts,catalog,drag?new Set([drag.original.id]):undefined)?'#d34848':'#2ca87f'):(p.color||'#db4437');
  const geometry=partGeometry(p.partId,d);
  group.add(new THREE.Mesh(geometry.body,new THREE.MeshStandardMaterial({color,transparent:isGhost,opacity:isGhost?.52:1})));
  const baseColor=new THREE.Color(color), luminance=baseColor.r*.2126+baseColor.g*.7152+baseColor.b*.0722;
  const rims=new THREE.LineSegments(geometry.rims,new THREE.LineBasicMaterial({color:luminance<.18?'#999999':'#333333',transparent:true,opacity:isGhost?.25:.4,depthWrite:false}));
  rims.raycast=()=>{};group.add(rims);
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
function persist(){try{if(!projectStore)throw Error('Speicher nicht verfügbar');projectStore.save(currentProjectId,history.document);projectStore.activate(currentProjectId);$('save').textContent='Lokal gespeichert';return true;}catch{$('save').textContent='Speichern fehlgeschlagen – JSON exportieren';return false;}}
function openProject(record){
  selected=null;setMode('select');
  currentProjectId=record.id;history.document=structuredClone(record.document);history.undoStack=[];history.redoStack=[];
  controls.target.set(0,0,0);camera.zoom=1;camera.updateProjectionMatrix();setView('iso');render();$('save').textContent='Lokal gespeichert';
}
function createProject(doc){
  if(!persist()){alert('Der aktuelle Stand konnte nicht gespeichert werden. Bitte zuerst JSON exportieren.');return;}
  try{const id=crypto.randomUUID(),record=projectStore.save(id,doc);projectStore.activate(id);openProject(record);}catch(error){alert(`Projekt konnte nicht angelegt werden: ${error.message}`);}
}
newProjectButton.onclick=()=>{const name=prompt('Name des neuen Projekts','Neues Projekt');if(name!==null)createProject({name:name.trim()||'Neues Projekt',parts:[]});};
openProjectButton.onclick=()=>{
  if(!persist()){alert('Der aktuelle Stand konnte nicht gespeichert werden. Bitte zuerst JSON exportieren.');return;}
  try{
    const list=projectDialog.querySelector('.project-list');list.replaceChildren();
    for(const record of projectStore.list()){
      const button=document.createElement('button');button.type='button';button.className='project-entry';
      const title=document.createElement('strong'),detail=document.createElement('span');title.textContent=record.document.name+(record.id===currentProjectId?' · geöffnet':'');detail.textContent=`${record.document.parts.length} Teile · ${new Date(record.updatedAt).toLocaleString('de-DE')}`;button.append(title,detail);
      button.onclick=()=>{try{const latest=projectStore.read(record.id);if(!persist())throw Error('Aktueller Stand nicht gespeichert. Bitte JSON exportieren.');projectStore.activate(latest.id);openProject(latest);projectDialog.close();}catch(error){alert(`Öffnen fehlgeschlagen: ${error.message}`);}};
      list.append(button);
    }
    cancelDrag();cancelPan();setHover(null);projectDialog.showModal();
  }catch(error){alert(`Projektliste konnte nicht geladen werden: ${error.message}`);}
};
function colorName(hex){
  const palette=[['Weiß','#ffffff'],['Grau','#888888'],['Hellgrau','#cccccc'],['Schwarz','#171717'],['Rot','#db4437'],['Blau','#2455cc'],['Hellblau','#9ccbdc'],['Grün','#299447'],['Gelb','#ffdc00'],['Orange','#ff8800'],['Braun','#6c4735'],['Rosa','#ff99cc'],['Violett','#8844aa']];
  const rgb=value=>[1,3,5].map(i=>parseInt(value.slice(i,i+2),16));const value=rgb(hex);
  return palette.reduce((best,entry)=>{const distance=rgb(entry[1]).reduce((sum,v,i)=>sum+(v-value[i])**2,0);return distance<best.distance?{name:entry[0],distance}:best;},{name:'Eigene Farbe',distance:Infinity}).name;
}
function renderMaterials(){
  const counts=new Map();
  function add(id,label,color){const key=JSON.stringify([id,color]);const row=counts.get(key);if(row)row.count++;else counts.set(key,{label,color,count:1});}
  for(const p of history.document.parts){const def=catalog[p.partId];if(def.assembly){add(p.partId+'-frame',def.label+' – Rahmen',p.color);add(p.partId+'-insert',def.label+(def.assembly==='window'?' – Scheibe':' – Türblatt'),def.assembly==='window'?'#9ccbdc':'#6c4735');}else add(p.partId,def.label,p.color);}
  const table=document.createElement('table');table.className='material-table';
  table.innerHTML='<thead><tr><th scope="col">Anzahl</th><th scope="col">Steinmaße</th><th scope="col">Farbe</th></tr></thead>';
  const body=document.createElement('tbody');
  for(const item of counts.values()){
    const row=document.createElement('tr'),quantity=document.createElement('td'),label=document.createElement('td'),color=document.createElement('td'),swatch=document.createElement('span');
    quantity.textContent=item.count;label.textContent=item.label;swatch.className='material-color';swatch.style.backgroundColor=item.color;swatch.setAttribute('aria-hidden','true');
    color.append(swatch,document.createTextNode(colorName(item.color)));row.append(quantity,label,color);body.append(row);
  }
  table.append(body);$('materials').replaceChildren(table);
}
function render(){syncModel();$('name').value=history.document.name;$('details').textContent=`${history.document.parts.length} Teile${selected?' · 1 ausgewählt':''}`;renderMaterials();$('undo').disabled=!history.undoStack.length;$('redo').disabled=!history.redoStack.length;updateGhost();}
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
renderer.domElement.addEventListener('pointerdown',e=>{if(e.button===0){down={x:e.clientX,y:e.clientY};if(mode==='select'){const id=pickedPart(e),original=history.document.parts.find(p=>p.id===id);if(original){point(e);const p=new THREE.Vector3();if(raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,0,1),-original.z),p))drag={original,pointerId:e.pointerId,offsetX:p.x-original.x,offsetY:p.y-original.y,active:false};}else{point(e);const anchor=new THREE.Vector3(),plane=viewPreset==='side'?new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()),controls.target):new THREE.Plane(new THREE.Vector3(0,0,1),0);if(raycaster.ray.intersectPlane(plane,anchor))pan={pointerId:e.pointerId,anchor,plane,active:false};}}}else if(e.button===2)rightDown={x:e.clientX,y:e.clientY};});
renderer.domElement.addEventListener('pointermove',e=>{if(pan&&e.pointerId===pan.pointerId&&down){if(!pan.active&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>(e.pointerType==='touch'?8:4)){pan.active=true;setHover(null);renderer.domElement.setPointerCapture(e.pointerId);renderer.domElement.style.cursor='grabbing';}if(pan.active){point(e);const current=new THREE.Vector3();if(raycaster.ray.intersectPlane(pan.plane,current)){const delta=pan.anchor.clone().sub(current);camera.position.add(delta);controls.target.add(delta);camera.updateMatrixWorld();controls.update();}return;}}if(drag&&e.pointerId===drag.pointerId&&down){if(!drag.active&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>(e.pointerType==='touch'?8:4)){drag.active=true;setHover(null);selected=drag.original.id;const group=model.children.find(g=>g.userData.partId===selected);if(group)group.visible=false;renderer.domElement.setPointerCapture(e.pointerId);}if(drag.active){movePreview(e);return;}}if(blocked&&lastPointer&&Math.hypot(e.clientX-lastPointer.x,e.clientY-lastPointer.y)>=8)blocked=false;if(e.buttons||e.pointerType==='touch'){setHover(null);return;}if(mode==='place')project(e);else setHover(pickedPart(e));});
renderer.domElement.addEventListener('pointerup',e=>{if(e.button===2){if(rightDown&&Math.hypot(e.clientX-rightDown.x,e.clientY-rightDown.y)<=4)cancelSelection();rightDown=null;return;}if(pan?.active&&e.pointerId===pan.pointerId){cancelPan();return;}pan=null;if(drag?.active&&e.pointerId===drag.pointerId){const original=drag.original, next=preview, valid=next&&!validate(next,history.document.parts,catalog,new Set([original.id]));cancelDrag();if(valid&&(next.x!==original.x||next.y!==original.y||next.z!==original.z))commit({...history.document,parts:history.document.parts.map(p=>p.id===original.id?next:p)});else render();$('status').textContent=valid?'Stein positioniert.':'Position belegt – Stein bleibt an seinem Platz.';return;}drag=null;if(!down||e.button!==0||Math.hypot(e.clientX-down.x,e.clientY-down.y)>4){down=null;return;}down=null;if(mode==='place'){if(e.pointerType==='touch'){project(e);return;}if(!preview||blocked||validate(preview,history.document.parts,catalog))return;commit({...history.document,parts:[...history.document.parts,{...preview,id:crypto.randomUUID()}]});if(e.ctrlKey||repeatPlacement.checked){blocked=true;lastPointer={x:e.clientX,y:e.clientY};}else setMode('select');}else{const id=pickedPart(e);if(mode==='delete'){if(id){if(selected===id)selected=null;commit({...history.document,parts:history.document.parts.filter(p=>p.id!==id)});}}else{selected=id;render();if(e.pointerType!=='touch')setHover(id);}}});
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
  const groups=[
    [brickHeight==='flat'?'Eckplatten':'Ecksteine',(id,def)=>def.corner&&id.startsWith(prefix)],
    ['Fenster · 1 Steinhöhe',(_,def)=>def.assembly==='window'&&def.height===12],
    ['Fenster · 3 Steinhöhen',(_,def)=>def.assembly==='window'&&def.height===36],
    ['Türen',(_,def)=>def.assembly==='door'],
  ];
  for(const [title,filter] of groups){
    const parts=Object.entries(catalog).filter(([id,def])=>filter(id,def)).sort((a,b)=>a[1].width-b[1].width||a[1].depth-b[1].depth);
    if(!parts.length)continue;
    const section=document.createElement('section'),caption=document.createElement('h4'),special=document.createElement('div');caption.className='catalog-subheading';caption.textContent=title;special.className='catalog-grid';
    const assembly=!!parts[0][1].assembly;
    if(assembly)for(const label of ['1 tief','2 tief']){const column=document.createElement('span');column.className='catalog-column-label';column.textContent=label;special.append(column);}
    const widths=[...new Set(parts.map(([,def])=>def.width))];
    for(const [id,def] of parts){const b=document.createElement('button');b.className='catalog-item';b.textContent=def.label;if(assembly){b.style.gridColumn=String(def.depth);b.style.gridRow=String(widths.indexOf(def.width)+2);}b.onclick=()=>{partId=id;setMode('place');};special.append(b);}
    section.append(caption,special);$('catalog').append(section);
  }
}
drawCatalog();
$('select').onclick=()=>setMode('select');$('place').onclick=()=>setMode('place');$('rotate').onclick=()=>{yaw=(yaw+1)%4;if(preview){preview.yaw=yaw;updateGhost();}};
deleteTool.onclick=()=>setMode('delete');deleteTool.setAttribute('aria-pressed','false');
$('delete').onclick=()=>{if(selected){commit({...history.document,parts:history.document.parts.filter(p=>p.id!==selected)});selected=null;render();}};
$('undo').onclick=()=>{if(history.undo()){selected=null;persist();render();}};$('redo').onclick=()=>{if(history.redo()){selected=null;persist();render();}};
$('name').onchange=e=>commit({...history.document,name:e.target.value.trim()||'Mein Projekt'});$('height').onchange=()=>{blocked=false;$('placement').value='fixed';if(preview){preview.z=Number($('height').value)*4;updateGhost();}};$('placement').onchange=()=>{preview=null;blocked=false;updateGhost();};$('color').oninput=()=>{const color=$('color').value;if(mode==='select'&&selected&&!drag){const part=history.document.parts.find(p=>p.id===selected);if(part&&part.color!==color)commit({...history.document,parts:history.document.parts.map(p=>p.id===selected?{...p,color}:p)});}else if(mode==='place'&&preview){preview.color=color;updateGhost();}};
function setView(preset){
  cancelDrag();cancelPan();setHover(null);preview=null;updateGhost();
  controls.enableDamping=false;controls.update();viewPreset=preset;
  controls.minPolarAngle=preset==='side'?Math.PI/2:0;controls.maxPolarAngle=Math.PI/2;
  // OrbitControls binds its orbit axis at construction. Keep Z-up in every view.
  camera.up.set(0,0,1);
  // A tiny offset avoids the lookAt singularity directly on the vertical axis.
  const offset=preset==='side'?new THREE.Vector3(0,-300,0):preset==='top'?new THREE.Vector3(0,-.0003,300):new THREE.Vector3(200,200,200);
  camera.position.copy(controls.target).add(offset);camera.lookAt(controls.target);controls.update();controls.enableDamping=true;
  for(const id of ['iso','top','side']){$(id).classList.toggle('active',id===preset);$(id).setAttribute('aria-pressed',String(id===preset));}
  updateViewDirection();requestRender();
}
$('iso').onclick=()=>setView('iso');$('top').onclick=()=>setView('top');sideButton.onclick=()=>setView('side');
$('export').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(history.document,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='klemmditor.json';a.click();URL.revokeObjectURL(url);};
$('import').onchange=async e=>{try{if(!e.target.files[0])return;const doc=JSON.parse(await e.target.files[0].text());if(!isProjectDocument(doc))throw Error('Ungültiges oder nicht unterstütztes Projekt');createProject(doc);}catch(err){alert(`Import fehlgeschlagen: ${err.message}`);}finally{e.target.value='';}};
let controlCopy=false;
window.addEventListener('keydown',e=>{
  if(projectDialog.open||/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))return;
  const key=e.key.toLowerCase();
  if(key==='control'&&!e.repeat&&mode==='select'&&selected&&!drag&&!down){
    const part=history.document.parts.find(p=>p.id===selected);
    if(part){partId=part.partId;yaw=part.yaw;$('color').value=part.color;selected=null;setMode('place');$('color').dispatchEvent(new Event('input'));render();controlCopy=true;}
  }else if((e.ctrlKey||e.metaKey)&&(key==='z'||key==='y')){
    e.preventDefault();if(controlCopy){setMode('select');controlCopy=false;}(key==='y'||e.shiftKey?$('redo'):$('undo')).click();
  }else if(!e.ctrlKey&&!e.metaKey&&!e.altKey&&key==='x')setMode('delete');else if(key==='v')setMode('select');else if(key==='b')setMode('place');else if(key==='r')$('rotate').click();else if(key==='delete'||key==='backspace')$('delete').click();else if(key==='escape')cancelSelection();
});
window.addEventListener('keyup',e=>{if(e.key==='Control')controlCopy=false;});render();
if(startupError){$('save').textContent='Speicherstand nicht lesbar – Original bleibt erhalten';}else persist();
