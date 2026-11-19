import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { catalog } from './catalog.js';
import { partGeometry } from './part-geometry.js';
import { History, validateAll, makeStamp, stampParts, rotationPivot, rotateParts, pruneGroups, createGroup } from './domain.js';
import { ProjectStore, isProjectDocument } from './projects.js';
import './style.css';

document.querySelector('#app').innerHTML = `<header><strong>▦ Klemmditor</strong><input id="name" aria-label="Projektname"><span id="save"></span><div class="spacer"></div><button id="undo">↶ Rückgängig</button><button id="redo">↷ Wiederholen</button><button id="export">JSON exportieren</button><label class="button">Importieren<input id="import" type="file" accept="application/json" hidden></label></header><main><aside><h2>Teilekatalog</h2><p>Teil auswählen und auf die Arbeitsfläche klicken.</p><div id="catalog"></div><h3>Farbe</h3><input type="color" id="color" value="#db4437" aria-label="Teilefarbe"><h3>Bauhöhe</h3><label>Modus <select id="placement"><option value="surface">Oberfläche</option><option value="fixed">Feste Höhe</option></select></label><label>Plattenhöhen <input type="number" id="height" value="0" min="0" step="1"></label><p>Bei fester Höhe gilt der Wert für die Unterkante des Teils.</p></aside><section class="workspace"><div class="tools"><button id="select" class="active">Auswählen · V</button><button id="place">Setzen · B</button><button id="rotate">Drehen · R</button><button id="delete">Löschen · Entf</button><span></span><button id="iso">Isometrisch</button><button id="top">Draufsicht</button></div><div id="viewport" tabindex="0" aria-label="3D-Arbeitsfläche"></div><div id="status" role="status">Teil im Katalog wählen, um mit dem Bauen zu beginnen.</div></section><aside class="right"><h2>Projekt</h2><div id="details"></div><div class="tabs" role="tablist" aria-label="Projektansichten"><button type="button" role="tab" id="tab-groups" aria-controls="panel-groups">Gruppen</button><button type="button" role="tab" id="tab-floors" aria-controls="panel-floors">Stockwerke</button><button type="button" role="tab" id="tab-materials" aria-controls="panel-materials">Materialliste</button></div><div role="tabpanel" id="panel-groups" aria-labelledby="tab-groups"><div id="groups"></div></div><div role="tabpanel" id="panel-floors" aria-labelledby="tab-floors" hidden><p>Stockwerke folgen in einer späteren Version.</p></div><div role="tabpanel" id="panel-materials" aria-labelledby="tab-materials" hidden><div id="materials"></div></div><p>Früher Entwicklungsstand. Verbindungen und weitere Funktionen folgen.</p></aside></main>`;
const $ = id => document.getElementById(id);
const helpButton=document.createElement('button');helpButton.type='button';helpButton.textContent='KI-Hilfe';$('export').before(helpButton);
const helpDialog=document.createElement('dialog');helpDialog.className='project-dialog ai-help';helpDialog.setAttribute('aria-labelledby','ai-help-title');
helpDialog.innerHTML='<div class="project-dialog-header"><h2 id="ai-help-title">Haus mit KI erstellen</h2><button type="button" class="ai-help-close" aria-label="Schließen">✕</button></div><p>Gib deiner bildfähigen KI ein Foto und die Anleitung. Die erzeugte JSON-Datei kannst du anschließend über „Importieren“ öffnen.</p><p>Du kannst der KI auch direkt den <a href="./ai-guide.md" target="_blank" rel="noopener">Link zur vollständigen Anleitung</a> geben, sofern sie Webseiten lesen kann. Mit dem Link zur Startseite allein findet sie die Anleitung möglicherweise nicht zuverlässig.</p><label for="ai-help-text">Anleitung zum Kopieren</label><textarea id="ai-help-text" readonly rows="12">Anleitung wird geladen …</textarea><div class="ai-help-actions"><button type="button" class="ai-help-copy" disabled>Anleitung kopieren</button><span class="ai-help-status" role="status"></span></div><p><a href="./example-house.json" download>Beispielhaus als JSON herunterladen</a></p>';
document.body.append(helpDialog);
const helpText=helpDialog.querySelector('textarea'),helpCopy=helpDialog.querySelector('.ai-help-copy'),helpStatus=helpDialog.querySelector('.ai-help-status');
helpDialog.querySelector('.ai-help-close').onclick=()=>helpDialog.close();
helpButton.onclick=async()=>{helpDialog.showModal();helpStatus.textContent='';if(helpCopy.disabled){try{const response=await fetch(new URL('./ai-guide.md',document.baseURI));if(!response.ok)throw Error('Anleitung nicht verfügbar');helpText.value=await response.text();helpCopy.disabled=false;}catch{helpText.value='Die Anleitung konnte nicht geladen werden. Bitte den Link oben öffnen.';}}};
helpCopy.onclick=async()=>{try{await navigator.clipboard.writeText(helpText.value);helpStatus.textContent='Anleitung kopiert.';}catch{helpText.focus();helpText.select();helpStatus.textContent='Text ausgewählt. Bitte mit Strg+C kopieren.';}};
const repeatPlacementLabel=document.createElement('label');repeatPlacementLabel.className='repeat-placement';
const repeatPlacement=document.createElement('input');repeatPlacement.type='checkbox';repeatPlacement.id='repeat-placement';
repeatPlacement.checked=true;try{repeatPlacement.checked=localStorage.getItem('klemmditor:repeat-placement')!=='false';}catch{}
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
// 'transparent' is a stable color id for clear glass parts; the native color input only holds hex values.
const TRANSPARENT = 'transparent';
let pickedColor = '#ffffff', applyColor = () => {};
function setColor(value) {
  pickedColor = value;
  if (value !== TRANSPARENT) $('color').value = value;
  for (const button of swatches.children) button.setAttribute('aria-pressed', String(button.dataset.color === pickedColor));
  applyColor();
}
for (const [label, value] of [['Weiß', '#ffffff'], ['Grau', '#888888'], ['Schwarz', '#171717'], ['Transparent', TRANSPARENT]]) {
  const button = document.createElement('button');
  button.type = 'button'; button.className = value === TRANSPARENT ? 'swatch swatch-glass' : 'swatch'; button.dataset.color = value;
  if (value !== TRANSPARENT) button.style.backgroundColor = value;
  button.title = label; button.setAttribute('aria-label', label);
  button.setAttribute('aria-pressed', String(value === pickedColor));
  button.onclick = () => setColor(value);
  swatches.append(button);
}
$('color').before(swatches);
$('color').addEventListener('input', () => setColor($('color').value));
let projectStore,initialProject,startupError=null;
try{projectStore=new ProjectStore(localStorage);initialProject=projectStore.startup();}catch(error){startupError=error;}
let currentProjectId=initialProject?.id||crypto.randomUUID();
const history = new History(pruneGroups(initialProject?.document||{name:'Mein Projekt',parts:[]}));
const groupsOf = () => history.document.groups || [];
// Selecting any member of a saved group selects the whole group.
function withGroups(ids){const out=new Set(ids);for(const g of groupsOf())if(g.partIds.some(id=>out.has(id)))g.partIds.forEach(id=>out.add(id));return out;}
// stamp: copy template of several parts while placing; copySource: selection before Ctrl started a copy.
let selection=new Set(), marquee=null, stamp=null, copySource=null, hovered=new Set(), mode='select', partId='brick-2x4', yaw=0, preview=null, blocked=false, lastPointer=null, down=null, drag=null, pan=null;
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
function makePart(p,isGhost=false,invalid=false){
  const d=catalog[p.partId],group=new THREE.Group(), color=isGhost?(invalid?'#d34848':'#2ca87f'):(p.color||'#db4437');
  const geometry=partGeometry(p.partId,d);
  const glass=!isGhost&&color===TRANSPARENT;
  // Clear glass: faint tinted body seen from both sides, plus visible edges so the part keeps its shape.
  const body=glass?new THREE.MeshPhysicalMaterial({color:'#e4f2f7',transparent:true,opacity:.3,roughness:.05,metalness:0,clearcoat:1,clearcoatRoughness:.05,side:THREE.DoubleSide,depthWrite:false})
    :new THREE.MeshStandardMaterial({color,transparent:isGhost,opacity:isGhost?.52:1});
  group.add(new THREE.Mesh(geometry.body,body));
  const baseColor=new THREE.Color(glass?'#ffffff':color), luminance=baseColor.r*.2126+baseColor.g*.7152+baseColor.b*.0722;
  const rims=new THREE.LineSegments(geometry.rims,new THREE.LineBasicMaterial({color:glass?'#7fa3b3':luminance<.18?'#999999':'#333333',transparent:true,opacity:isGhost?.25:glass?.6:.4,depthWrite:false}));
  rims.raycast=()=>{};group.add(rims);
  if(glass&&!selection.has(p.id)){const outline=new THREE.LineSegments(geometry.edges,new THREE.LineBasicMaterial({color:'#8fb3c2',transparent:true,opacity:.75,depthWrite:false}));outline.raycast=()=>{};group.add(outline);}
  if(geometry.insert){const transparent=isGhost||d.assembly==='window';group.add(new THREE.Mesh(geometry.insert,new THREE.MeshStandardMaterial({color:isGhost?color:d.assembly==='window'?'#9ccbdc':'#6c4735',transparent,opacity:isGhost?.52:transparent?.5:1,depthWrite:!transparent})));}
  if(selection.has(p.id)&&!isGhost)group.add(new THREE.LineSegments(geometry.edges,new THREE.LineBasicMaterial({color:'#1169db'})));
  group.position.set(p.x,p.y,p.z);group.rotation.z=p.yaw*Math.PI/2;group.userData.partId=p.id;return group;
}
let ghostKey='';
// `preview` is the anchor; these are all parts it stands for (moved selection, copied group or one new part).
function previewParts(){
  if(!preview)return[];
  if(drag?.active)return drag.members.map(m=>({...m,x:m.x+preview.x-drag.original.x,y:m.y+preview.y-drag.original.y,z:m.z+preview.z-drag.minZ}));
  if(stamp)return stampParts(stamp,preview);
  return[preview];
}
function previewError(parts){return validateAll(parts,history.document.parts,catalog,drag?.ids);}
function updateGhost(){const active=(mode==='place'||drag?.active)&&preview;const parts=active?previewParts():[];const error=active?previewError(parts):null;const nextKey=active?JSON.stringify([parts,error]):'';if(nextKey!==ghostKey){clear(ghost);for(const p of parts)ghost.add(makePart(p,true,!!error));ghostKey=nextKey;requestRender();}}
function syncModel(){
  setHover(null);
  const existing=new Map(model.children.map(group=>[group.userData.partId,group]));
  for(const part of history.document.parts){
    const signature=JSON.stringify([part,selection.has(part.id)]);const old=existing.get(part.id);existing.delete(part.id);
    if(old?.userData.signature===signature)continue;
    if(old){model.remove(old);clear(old);}
    const group=makePart(part);group.userData.signature=signature;model.add(group);
  }
  for(const group of existing.values()){model.remove(group);clear(group);}
  requestRender();
}
function persist(){try{if(!projectStore)throw Error('Speicher nicht verfügbar');projectStore.save(currentProjectId,history.document);projectStore.activate(currentProjectId);$('save').textContent='Lokal gespeichert';return true;}catch{$('save').textContent='Speichern fehlgeschlagen – JSON exportieren';return false;}}
function openProject(record){
  selection=new Set();setMode('select');
  currentProjectId=record.id;history.document=structuredClone(pruneGroups(record.document));history.undoStack=[];history.redoStack=[];
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
  if(hex===TRANSPARENT)return 'Transparent';
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
    quantity.textContent=item.count;label.textContent=item.label;swatch.className=item.color===TRANSPARENT?'material-color swatch-glass':'material-color';if(item.color!==TRANSPARENT)swatch.style.backgroundColor=item.color;swatch.setAttribute('aria-hidden','true');
    color.append(swatch,document.createTextNode(colorName(item.color)));row.append(quantity,label,color);body.append(row);
  }
  table.append(body);$('materials').replaceChildren(table);
}
function render(){syncModel();$('name').value=history.document.name;$('details').textContent=`${history.document.parts.length} Teile${selection.size?` · ${selection.size} ausgewählt`:''}`;renderMaterials();renderGroups();$('undo').disabled=!history.undoStack.length;$('redo').disabled=!history.redoStack.length;updateGhost();}
function commit(doc){history.execute(pruneGroups(doc));persist();render();}
// One line per group: click puts a copy on the pointer (like a catalog part), double-click renames.
// Groups with the same name (copies) are bundled under a header that expands on click.
// The list is rebuilt on every render, so double-clicks are detected by group id and time.
let lastGroupClick=null;
const expandedGroups=new Set();
const groupActive=g=>stamp?.source===g.id||g.partIds.every(id=>selection.has(id));
function renderGroups(){
  const list=$('groups');list.replaceChildren();
  if(!groupsOf().length){const hint=document.createElement('p');hint.textContent='Noch keine Gruppen. Steine mit Shift auswählen und Strg+G drücken.';list.append(hint);return;}
  const byName=new Map();
  for(const g of groupsOf()){if(!byName.has(g.name))byName.set(g.name,[]);byName.get(g.name).push(g);}
  for(const [name,members] of byName){
    if(members.length===1){list.append(groupRow(members[0]));continue;}
    const open=expandedGroups.has(name),toggle=()=>{if(open)expandedGroups.delete(name);else expandedGroups.add(name);renderGroups();list.querySelector(`[data-cluster="${CSS.escape(name)}"]`)?.focus();};
    const header=document.createElement('div');header.className='group-row group-cluster';header.dataset.cluster=name;header.tabIndex=0;header.setAttribute('role','button');header.setAttribute('aria-expanded',String(open));
    header.title=`${name} · ${members.length} gleichnamige Gruppen · Klick klappt ${open?'zu':'auf'}`;
    header.classList.toggle('active',!open&&members.some(groupActive));
    const chevron=document.createElement('span');chevron.className='group-chevron';chevron.textContent='▸';chevron.setAttribute('aria-hidden','true');
    const label=document.createElement('span');label.className='group-name';label.textContent=name;
    const count=document.createElement('span');count.className='group-cluster-count';count.textContent=`(${members.length})`;
    header.onclick=toggle;header.onkeydown=e=>{if(e.target===header&&(e.key==='Enter'||e.key===' '||e.key===(open?'ArrowLeft':'ArrowRight'))){e.preventDefault();toggle();}};
    header.append(chevron,label,count);list.append(header);
    if(open)members.forEach((g,i)=>{const row=groupRow(g,`Nr. ${i+1}`);row.classList.add('group-child');list.append(row);});
  }
}
function groupRow(g,label=g.name){
  const row=document.createElement('div');row.className='group-row';row.dataset.group=g.id;row.tabIndex=0;row.setAttribute('role','button');
  row.title=`${g.name} · Klick: an die Maus legen und platzieren · Doppelklick oder F2: umbenennen`;
  row.classList.toggle('active',groupActive(g));
  row.onmouseenter=()=>setHover(new Set(g.partIds));row.onmouseleave=()=>setHover(null);
  const name=document.createElement('span');name.className='group-name';name.textContent=label;
  const count=document.createElement('span');count.className='group-count';count.textContent=g.partIds.length;count.setAttribute('aria-label',`${g.partIds.length} Teile`);
  const ungroup=document.createElement('button');ungroup.type='button';ungroup.className='group-remove';ungroup.textContent='✕';ungroup.title='Gruppe auflösen (Steine bleiben erhalten)';ungroup.setAttribute('aria-label',`${g.name} auflösen`);
  ungroup.onclick=e=>{e.stopPropagation();commit({...history.document,groups:groupsOf().filter(x=>x.id!==g.id)});};
  const place=()=>startStamp(history.document.parts.filter(p=>g.partIds.includes(p.id)),g.id);
  row.onclick=()=>{
    const now=Date.now(),repeat=lastGroupClick?.id===g.id&&now-lastGroupClick.time<400;lastGroupClick={id:g.id,time:now};
    if(repeat){lastGroupClick=null;setMode('select');renameGroup(g.id);}else place();
  };
  row.onkeydown=e=>{if(e.target!==row)return;if(e.key==='F2'){e.preventDefault();renameGroup(g.id);}else if(e.key==='Enter'||e.key===' '){e.preventDefault();place();}};
  row.append(name,count,ungroup);return row;
}
function renameGroup(id){
  const group=groupsOf().find(g=>g.id===id);if(!group)return;
  // A group inside a collapsed bundle of same-named groups has no row yet.
  if(groupsOf().filter(g=>g.name===group.name).length>1&&!expandedGroups.has(group.name)){expandedGroups.add(group.name);renderGroups();}
  const row=$('groups').querySelector(`[data-group="${CSS.escape(id)}"]`);if(!row)return;
  const input=document.createElement('input');input.className='group-name-input';input.value=group.name;input.setAttribute('aria-label','Gruppenname');
  let done=false;
  const finish=save=>{if(done)return;done=true;const value=input.value.trim()||'Gruppe';if(save&&value!==group.name)commit({...history.document,groups:groupsOf().map(g=>g.id===id?{...g,name:value}:g)});else render();};
  input.onkeydown=e=>{e.stopPropagation();if(e.key==='Enter')finish(true);else if(e.key==='Escape')finish(false);};
  input.onblur=()=>finish(true);input.onclick=e=>e.stopPropagation();
  row.querySelector('.group-name').replaceWith(input);input.focus();input.select();
}
// Puts a copy of several parts (with their groups) on the pointer as a ghost; a click places it.
function startStamp(parts,source=null){
  if(!parts.length)return;
  stamp=makeStamp(parts,groupsOf());stamp.source=source;yaw=0;selection=new Set();setMode('place');render();
  $('status').textContent=`Kopie setzen · ${parts.length} Teile · Mausrad, R oder Q/E dreht, Klick setzt. Esc bricht ab.`;
}
// Q/E turn the selection in place. Consecutive turns of unchanged parts keep their pivot,
// so four turns (or Q then E) return exactly to the start.
let lastTurn=null;
function rotateSelection(turns){
  const parts=history.document.parts.filter(p=>selection.has(p.id));if(!parts.length)return;
  const key=JSON.stringify(parts),pivot=lastTurn?.key===key?lastTurn.pivot:rotationPivot(parts,catalog);
  const turned=rotateParts(parts,turns,pivot),error=validateAll(turned,history.document.parts,catalog,selection);
  if(error){$('status').textContent=/Kollision/.test(error)?'Drehen nicht möglich – der Platz ist belegt.':`Drehen nicht möglich – ${error}.`;return;}
  const byId=new Map(turned.map(p=>[p.id,p]));commit({...history.document,parts:history.document.parts.map(p=>byId.get(p.id)||p)});
  lastTurn={key:JSON.stringify(history.document.parts.filter(p=>selection.has(p.id))),pivot};
  $('status').textContent=`${parts.length>1?`${parts.length} Teile`:'Teil'} um 90° ${turns===1?'gegen den':'im'} Uhrzeigersinn gedreht · Q/E dreht weiter.`;
}
function groupSelection(){
  if(selection.size<2){$('status').textContent='Für eine Gruppe mindestens zwei Steine auswählen.';return;}
  const existing=groupsOf().find(g=>g.partIds.length===selection.size&&g.partIds.every(id=>selection.has(id)));
  let id=existing?.id;
  if(!existing){
    const names=new Set(groupsOf().map(g=>g.name));let name='Gruppe';for(let i=2;names.has(name);i++)name=`Gruppe ${i}`;
    id=crypto.randomUUID();commit(createGroup(history.document,[...selection],id,name));
  }
  showTab('groups');
  renameGroup(id);
  $('status').textContent=existing?'Diese Steine sind bereits eine Gruppe.':'Gruppe angelegt · Namen eingeben und mit Enter bestätigen.';
}
const rightTabs=['groups','floors','materials'];
function showTab(name){
  for(const id of rightTabs){const tab=$(`tab-${id}`),on=id===name;tab.setAttribute('aria-selected',String(on));tab.classList.toggle('active',on);tab.tabIndex=on?0:-1;$(`panel-${id}`).hidden=!on;}
  try{localStorage.setItem('klemmditor:right-tab',name);}catch{}
}
for(const id of rightTabs){
  const tab=$(`tab-${id}`);tab.onclick=()=>showTab(id);
  tab.onkeydown=e=>{const step=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0;if(!step)return;const next=rightTabs[(rightTabs.indexOf(id)+step+rightTabs.length)%rightTabs.length];showTab(next);$(`tab-${next}`).focus();};
}
{let saved='groups';try{saved=localStorage.getItem('klemmditor:right-tab')||saved;}catch{}showTab(rightTabs.includes(saved)?saved:'groups');}
function setMode(next){cancelDrag();cancelPan();cancelMarquee();setHover(null);mode=next;preview=null;blocked=false;if(next!=='place')stamp=null;$('select').classList.toggle('active',mode==='select');$('place').classList.toggle('active',mode==='place');deleteTool.classList.toggle('active',mode==='delete');deleteTool.setAttribute('aria-pressed',String(mode==='delete'));renderer.domElement.style.cursor=mode==='delete'?'crosshair':'';$('status').textContent=mode==='place'?'Setzen · Mausrad dreht, Klick setzt, Strg+Klick setzt mehrfach. Esc oder Rechtsklick bricht ab.':mode==='delete'?'Löschen · Stein anklicken. Mit Strg+Z rückgängig machen.':'Auswählen · Stein oder freies Raster ziehen. Shift+Klick oder Shift+Rahmen wählt mehrere, Q/E dreht die Auswahl.';updateGhost();renderGroups();}
function cancelSelection(){selection=new Set();setMode('select');render();}
function point(e){const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);}
function pickedPart(e){point(e);const hit=raycaster.intersectObjects(model.children,true)[0];let obj=hit?.object;while(obj&&!obj.userData.partId)obj=obj.parent;return obj?.userData.partId||null;}
// Highlights one part id, a Set of ids (a group hovered in the list) or nothing (null).
function setHover(target){
  const next=target instanceof Set?target:new Set(target?[target]:[]);
  if(next.size===hovered.size&&[...next].every(id=>hovered.has(id)))return;
  for(const group of model.children){if(!hovered.has(group.userData.partId)&&!next.has(group.userData.partId))continue;group.traverse(obj=>{if(!obj.isMesh)return;const material=obj.material;if(!material.userData.original)material.userData.original={opacity:material.opacity,transparent:material.transparent,depthWrite:material.depthWrite};const original=material.userData.original, active=next.has(group.userData.partId);material.opacity=active?original.opacity*.65:original.opacity;material.transparent=active||original.transparent;material.depthWrite=active?false:original.depthWrite;material.needsUpdate=true;});}
  hovered=next;
  requestRender();
}
function project(e){point(e);let z=Number($('height').value)*4;if($('placement').value==='surface'){const hit=raycaster.intersectObjects(model.children,true)[0];let obj=hit?.object;while(obj&&!obj.userData.partId)obj=obj.parent;const target=history.document.parts.find(p=>p.id===obj?.userData.partId);if(target)z=target.z+catalog[target.partId].height;else z=0;}const plane=new THREE.Plane(new THREE.Vector3(0,0,1),-z), p=new THREE.Vector3();if(!raycaster.ray.intersectPlane(plane,p))return;preview={id:'preview',partId,x:Math.round(p.x/10)*10,y:Math.round(p.y/10)*10,z,yaw,color:pickedColor};$('status').textContent=previewError(previewParts())||`${stamp?`Kopie · ${stamp.parts.length} Teile · `:''}Vorschau: X ${preview.x}, Y ${preview.y}, Z ${preview.z} · Klicken zum Setzen`;updateGhost();}
function cancelDrag(){if(!drag)return;for(const group of model.children)if(drag.ids?.has(group.userData.partId))group.visible=true;const pointerId=drag.pointerId;drag=null;down=null;preview=null;if(renderer.domElement.hasPointerCapture(pointerId))renderer.domElement.releasePointerCapture(pointerId);updateGhost();}
function cancelPan(){if(!pan)return;const pointerId=pan.pointerId;pan=null;down=null;renderer.domElement.style.cursor=mode==='delete'?'crosshair':'';if(renderer.domElement.hasPointerCapture(pointerId))renderer.domElement.releasePointerCapture(pointerId);}
// Shift+drag draws a selection rectangle in screen space; parts fully inside are added to the selection.
const marqueeBox=document.createElement('div');marqueeBox.className='marquee';marqueeBox.hidden=true;viewport.append(marqueeBox);
function cancelMarquee(){if(!marquee)return;const pointerId=marquee.pointerId;marquee=null;marqueeBox.hidden=true;if(renderer.domElement.hasPointerCapture(pointerId))renderer.domElement.releasePointerCapture(pointerId);}
function updateMarquee(e){
  const r=renderer.domElement.getBoundingClientRect();
  Object.assign(marqueeBox.style,{left:`${Math.min(marquee.x,e.clientX)-r.left}px`,top:`${Math.min(marquee.y,e.clientY)-r.top}px`,width:`${Math.abs(e.clientX-marquee.x)}px`,height:`${Math.abs(e.clientY-marquee.y)}px`});
}
function partsInRect(a,b){
  const r=renderer.domElement.getBoundingClientRect(),minX=Math.min(a.x,b.x),maxX=Math.max(a.x,b.x),minY=Math.min(a.y,b.y),maxY=Math.max(a.y,b.y);
  model.updateMatrixWorld(true);camera.updateMatrixWorld();
  const ids=[],corner=new THREE.Vector3(),box=new THREE.Box3();
  for(const group of model.children){
    if(!group.visible)continue;box.setFromObject(group);let inside=!box.isEmpty();
    for(let i=0;i<8&&inside;i++){
      corner.set(i&1?box.max.x:box.min.x,i&2?box.max.y:box.min.y,i&4?box.max.z:box.min.z).project(camera);
      const x=r.left+(corner.x+1)/2*r.width,y=r.top+(1-corner.y)/2*r.height;
      inside=x>=minX&&x<=maxX&&y>=minY&&y<=maxY;
    }
    if(inside)ids.push(group.userData.partId);
  }
  return ids;
}
function movePreview(e){
  point(e);let z=Number($('height').value)*4;
  if($('placement').value==='surface'){
    const targets=model.children.filter(g=>!drag.ids.has(g.userData.partId));
    const hit=raycaster.intersectObjects(targets,true)[0];let obj=hit?.object;while(obj&&!obj.userData.partId)obj=obj.parent;
    const target=history.document.parts.find(p=>p.id===obj?.userData.partId);z=target?target.z+catalog[target.partId].height:0;
  }
  const p=new THREE.Vector3();if(!raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,0,1),-z),p))return;
  preview={...drag.original,x:Math.round((p.x-drag.offsetX)/10)*10,y:Math.round((p.y-drag.offsetY)/10)*10,z};
  $('status').textContent=previewError(previewParts())||`Verschieben${drag.members.length>1?` · ${drag.members.length} Teile`:''}: X ${preview.x}, Y ${preview.y}, Z ${preview.z} · Loslassen zum Setzen · Esc bricht ab`;updateGhost();
}
let rightDown=null;
renderer.domElement.addEventListener('wheel',e=>{if(mode!=='place'||!e.deltaY)return;e.preventDefault();e.stopImmediatePropagation();yaw=(yaw+(e.deltaY>0?1:3))%4;if(preview){preview.yaw=yaw;updateGhost();}},{capture:true,passive:false});
renderer.domElement.addEventListener('pointerdown',e=>{if(e.button===0){down={x:e.clientX,y:e.clientY};if(mode==='select'&&e.shiftKey){e.preventDefault();marquee={pointerId:e.pointerId,x:e.clientX,y:e.clientY,active:false};}else if(mode==='select'){const id=pickedPart(e),original=history.document.parts.find(p=>p.id===id);if(original){point(e);const p=new THREE.Vector3();if(raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,0,1),-original.z),p))drag={original,pointerId:e.pointerId,offsetX:p.x-original.x,offsetY:p.y-original.y,active:false};}else{point(e);const anchor=new THREE.Vector3(),plane=viewPreset==='side'?new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()),controls.target):new THREE.Plane(new THREE.Vector3(0,0,1),0);if(raycaster.ray.intersectPlane(plane,anchor))pan={pointerId:e.pointerId,anchor,plane,active:false};}}}else if(e.button===2)rightDown={x:e.clientX,y:e.clientY};});
renderer.domElement.addEventListener('pointermove',e=>{if(marquee&&e.pointerId===marquee.pointerId){if(!marquee.active&&Math.hypot(e.clientX-marquee.x,e.clientY-marquee.y)>(e.pointerType==='touch'?8:4)){marquee.active=true;setHover(null);marqueeBox.hidden=false;renderer.domElement.setPointerCapture(e.pointerId);}if(marquee.active){updateMarquee(e);return;}}if(pan&&e.pointerId===pan.pointerId&&down){if(!pan.active&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>(e.pointerType==='touch'?8:4)){pan.active=true;setHover(null);renderer.domElement.setPointerCapture(e.pointerId);renderer.domElement.style.cursor='grabbing';}if(pan.active){point(e);const current=new THREE.Vector3();if(raycaster.ray.intersectPlane(pan.plane,current)){const delta=pan.anchor.clone().sub(current);camera.position.add(delta);controls.target.add(delta);camera.updateMatrixWorld();controls.update();}return;}}if(drag&&e.pointerId===drag.pointerId&&down){if(!drag.active&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>(e.pointerType==='touch'?8:4)){drag.active=true;setHover(null);
      // Dragging a selected part moves the whole selection; otherwise the part and its saved group.
      const ids=selection.has(drag.original.id)?selection:withGroups([drag.original.id]);
      drag.members=history.document.parts.filter(p=>ids.has(p.id));drag.ids=new Set(drag.members.map(p=>p.id));drag.minZ=Math.min(...drag.members.map(p=>p.z));selection=new Set(drag.ids);
      for(const group of model.children)if(drag.ids.has(group.userData.partId))group.visible=false;renderer.domElement.setPointerCapture(e.pointerId);}if(drag.active){movePreview(e);return;}}if(blocked&&lastPointer&&Math.hypot(e.clientX-lastPointer.x,e.clientY-lastPointer.y)>=8)blocked=false;if(e.buttons||e.pointerType==='touch'){setHover(null);return;}if(mode==='place')project(e);else setHover(pickedPart(e));});
renderer.domElement.addEventListener('pointerup',e=>{if(e.button===2){if(rightDown&&Math.hypot(e.clientX-rightDown.x,e.clientY-rightDown.y)<=4)cancelSelection();rightDown=null;return;}if(marquee&&e.pointerId===marquee.pointerId){const m=marquee;cancelMarquee();down=null;if(m.active){const ids=partsInRect(m,{x:e.clientX,y:e.clientY});for(const id of withGroups(ids))selection.add(id);render();$('status').textContent=`${ids.length} Teile im Rahmen · ${selection.size} ausgewählt`;}else{const id=pickedPart(e);if(id){const ids=withGroups([id]),remove=selection.has(id);for(const i of ids)remove?selection.delete(i):selection.add(i);}render();}return;}if(pan?.active&&e.pointerId===pan.pointerId){cancelPan();return;}pan=null;if(drag?.active&&e.pointerId===drag.pointerId){const moved=previewParts(),first=drag.members[0],valid=!!preview&&!previewError(moved),changed=moved.length&&(moved[0].x!==first.x||moved[0].y!==first.y||moved[0].z!==first.z),many=moved.length>1;cancelDrag();if(valid&&changed){const byId=new Map(moved.map(p=>[p.id,p]));commit({...history.document,parts:history.document.parts.map(p=>byId.get(p.id)||p)});}else render();$('status').textContent=valid?(many?`${moved.length} Steine verschoben.`:'Stein positioniert.'):(many?'Position belegt – Steine bleiben an ihrem Platz.':'Position belegt – Stein bleibt an seinem Platz.');return;}drag=null;if(!down||e.button!==0||Math.hypot(e.clientX-down.x,e.clientY-down.y)>4){down=null;return;}down=null;if(mode==='place'){if(e.pointerType==='touch'){project(e);return;}const parts=previewParts();if(!preview||blocked||previewError(parts))return;
    const placed=parts.map(p=>({...p,id:crypto.randomUUID()}));let doc={...history.document,parts:[...history.document.parts,...placed]};
    // Copies of saved groups become new groups with the same name.
    for(const g of stamp?.groups||[])doc=createGroup(doc,g.members.map(i=>placed[i].id),crypto.randomUUID(),g.name);
    commit(doc);if(e.ctrlKey||repeatPlacement.checked){blocked=true;lastPointer={x:e.clientX,y:e.clientY};}else setMode('select');}else{const id=pickedPart(e);if(mode==='delete'){if(id){selection.delete(id);commit({...history.document,parts:history.document.parts.filter(p=>p.id!==id)});}}else{selection=withGroups(id?[id]:[]);render();if(e.pointerType!=='touch')setHover(id);}}});
renderer.domElement.addEventListener('pointerleave',()=>setHover(null));renderer.domElement.addEventListener('lostpointercapture',()=>{if(drag?.active)cancelDrag();if(pan?.active)cancelPan();if(marquee?.active)cancelMarquee();});renderer.domElement.addEventListener('pointercancel',()=>{cancelDrag();cancelPan();cancelMarquee();down=null;rightDown=null;setHover(null);});window.addEventListener('blur',()=>{cancelDrag();cancelPan();cancelMarquee();down=null;rightDown=null;setHover(null);});
function resize(){const w=viewport.clientWidth,h=viewport.clientHeight;renderer.setSize(w,h);const a=w/h;camera.left=-120*a;camera.right=120*a;camera.top=120;camera.bottom=-120;camera.updateProjectionMatrix();requestRender();}new ResizeObserver(resize).observe(viewport);resize();
// Catalog picker: type → length → depth → height. Every part is described by these
// four attributes, so the UI is derived from the catalog instead of listing each part.
const partKinds=[['brick','Stein'],['corner','Ecke'],['window','Fenster'],['door','Tür']];
const partAttrs=(id)=>{const d=catalog[id];return{kind:d.corner?'corner':d.assembly||'brick',length:Math.max(d.width,d.depth),depth:Math.min(d.width,d.depth),height:d.height};};
const heightLabel=(kind,h)=>h===4?'Flach':kind==='brick'||kind==='corner'?'Normal':`${h/12} hoch`;
// Pick the part that has the requested value and keeps as many current attributes as possible.
function pickPart(key,value){
  const current=partAttrs(partId),order=['kind','height','length','depth'];
  const score=a=>order.reduce((s,k,i)=>s+(a[k]===current[k]?2**(order.length-i):0),0);
  let best=null,bestScore=-1;
  for(const id of Object.keys(catalog)){const a=partAttrs(id);if(a[key]!==value)continue;if(key!=='kind'&&a.kind!==current.kind)continue;const s=score(a);if(s>bestScore){best=id;bestScore=s;}}
  return best;
}
function choosePart(id){
  partId=id;if(stamp){stamp=null;preview=null;}
  if(mode==='place'&&preview){preview.partId=id;updateGhost();}else setMode('place');
  drawCatalog();
}
function footprint({kind,length,depth}){
  const s=9,svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox',`0 0 ${length*s+2} ${depth*s+2}`);svg.setAttribute('aria-hidden','true');svg.classList.add('part-footprint');
  for(let x=0;x<length;x++)for(let y=0;y<depth;y++){
    if(kind==='corner'&&x===1&&y===1)continue;
    const c=document.createElementNS('http://www.w3.org/2000/svg','circle');c.setAttribute('cx',x*s+s/2+1);c.setAttribute('cy',y*s+s/2+1);c.setAttribute('r',s*.3);svg.append(c);
  }
  return svg;
}
function drawCatalog(){
  const current=partAttrs(partId),root=$('catalog');root.replaceChildren();
  const ofKind=Object.keys(catalog).map(partAttrs).filter(a=>a.kind===current.kind);
  const row=(label,key,values,text)=>{
    if(values.length<2&&key!=='kind')return;
    const wrap=document.createElement('div');wrap.className='part-option';wrap.setAttribute('role','group');wrap.setAttribute('aria-label',label);
    const caption=document.createElement('span');caption.textContent=label;
    const chips=document.createElement('div');chips.className=key==='kind'?'part-chips part-kinds':'part-chips';
    for(const v of values){
      const b=document.createElement('button');b.type='button';b.textContent=text(v);
      const active=current[key]===v,exact=key==='kind'||ofKind.some(a=>a[key]===v&&['length','depth','height'].every(k=>k===key||a[k]===current[k]));
      b.classList.toggle('active',active);b.classList.toggle('inexact',!exact);b.setAttribute('aria-pressed',String(active));
      b.onclick=()=>{const id=pickPart(key,v);if(id)choosePart(id);};chips.append(b);
    }
    wrap.append(caption,chips);root.append(wrap);
  };
  const values=key=>[...new Set(ofKind.map(a=>a[key]))].sort((a,b)=>a-b);
  row('Typ','kind',partKinds.map(([k])=>k),k=>partKinds.find(([v])=>v===k)[1]);
  row('Länge','length',values('length'),String);
  row('Tiefe','depth',values('depth'),String);
  row('Höhe','height',values('height'),h=>heightLabel(current.kind,h));
  const summary=document.createElement('button');summary.type='button';summary.className='part-summary';
  summary.title='Teil auf der Arbeitsfläche setzen';summary.onclick=()=>choosePart(partId);
  const name=document.createElement('strong');name.textContent=catalog[partId].label;
  summary.append(footprint(current),name);root.append(summary);
}
drawCatalog();
$('select').onclick=()=>setMode('select');$('place').onclick=()=>{stamp=null;setMode('place');};$('rotate').onclick=()=>{yaw=(yaw+1)%4;if(preview){preview.yaw=yaw;updateGhost();}};
deleteTool.onclick=()=>setMode('delete');deleteTool.setAttribute('aria-pressed','false');
$('delete').onclick=()=>{if(selection.size){const gone=selection;selection=new Set();commit({...history.document,parts:history.document.parts.filter(p=>!gone.has(p.id))});}};
$('undo').onclick=()=>{if(history.undo()){selection=new Set();persist();render();}};$('redo').onclick=()=>{if(history.redo()){selection=new Set();persist();render();}};
$('name').onchange=e=>commit({...history.document,name:e.target.value.trim()||'Mein Projekt'});$('height').onchange=()=>{blocked=false;$('placement').value='fixed';if(preview){preview.z=Number($('height').value)*4;updateGhost();}};$('placement').onchange=()=>{preview=null;blocked=false;updateGhost();};applyColor=()=>{const color=pickedColor;if(mode==='select'&&selection.size&&!drag){if(history.document.parts.some(p=>selection.has(p.id)&&p.color!==color))commit({...history.document,parts:history.document.parts.map(p=>selection.has(p.id)?{...p,color}:p)});}else if(mode==='place'&&preview){preview.color=color;updateGhost();}};
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
  if(key==='control'&&!e.repeat&&mode==='select'&&selection.size&&!drag&&!down){
    // Holding Ctrl copies: one loose part via the catalog, several parts or a group as a stamp.
    const parts=history.document.parts.filter(p=>selection.has(p.id));copySource=new Set(selection);
    if(parts.length===1){const part=parts[0];partId=part.partId;drawCatalog();yaw=part.yaw;selection=new Set();setMode('place');setColor(part.color);render();}
    else startStamp(parts);
    controlCopy=true;
  }else if((e.ctrlKey||e.metaKey)&&key==='g'){
    e.preventDefault();
    // Ctrl was pressed first and started a copy; return to the selection it came from.
    if(controlCopy&&copySource){setMode('select');selection=copySource;controlCopy=false;render();}
    if(mode==='select')groupSelection();
  }else if((e.ctrlKey||e.metaKey)&&(key==='z'||key==='y')){
    e.preventDefault();if(controlCopy){setMode('select');controlCopy=false;}(key==='y'||e.shiftKey?$('redo'):$('undo')).click();
  }else if(!e.ctrlKey&&!e.metaKey&&!e.altKey&&key==='x')setMode('delete');else if(key==='v')setMode('select');else if(key==='b')$('place').click();else if(key==='r')$('rotate').click();else if(!e.ctrlKey&&!e.metaKey&&!e.altKey&&(key==='q'||key==='e')){
    const turns=key==='q'?1:3;
    if(mode==='select'&&selection.size&&!drag&&!marquee)rotateSelection(turns);
    else if(mode==='place'){yaw=(yaw+turns)%4;if(preview){preview.yaw=yaw;updateGhost();}}
  }else if(key==='delete'||key==='backspace')$('delete').click();else if(key==='escape')cancelSelection();
});
window.addEventListener('keyup',e=>{if(e.key==='Control')controlCopy=false;});render();
if(startupError){$('save').textContent='Speicherstand nicht lesbar – Original bleibt erhalten';}else persist();

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
