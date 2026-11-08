import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { catalog, solids } from './catalog.js';
import { History, validate } from './domain.js';
import './style.css';

document.querySelector('#app').innerHTML = `<header><strong>▦ Klemmditor</strong><input id="name" aria-label="Projektname"><span id="save"></span><div class="spacer"></div><button id="undo">↶ Rückgängig</button><button id="redo">↷ Wiederholen</button><button id="export">JSON exportieren</button><label class="button">Importieren<input id="import" type="file" accept="application/json" hidden></label></header><main><aside><h2>Teilekatalog</h2><p>Teil auswählen und auf die Arbeitsfläche klicken.</p><div id="catalog"></div><h3>Farbe</h3><input type="color" id="color" value="#db4437" aria-label="Teilefarbe"><h3>Bauhöhe</h3><label>Modus <select id="placement"><option value="surface">Oberfläche</option><option value="fixed">Feste Höhe</option></select></label><label>Plattenhöhen <input type="number" id="height" value="0" min="0" step="1"></label><p>Bei fester Höhe gilt der Wert für die Unterkante des Teils.</p></aside><section class="workspace"><div class="tools"><button id="select" class="active">Auswählen · V</button><button id="place">Setzen · B</button><button id="rotate">Drehen · R</button><button id="delete">Löschen · Entf</button><span></span><button id="iso">Isometrisch</button><button id="top">Draufsicht</button></div><div id="viewport" tabindex="0" aria-label="3D-Arbeitsfläche"></div><div id="status" role="status">Teil im Katalog wählen, um mit dem Bauen zu beginnen.</div></section><aside class="right"><h2>Projekt</h2><div id="details"></div><h3>Materialliste</h3><div id="materials"></div><p>Früher Entwicklungsstand. Verbindungen, Gruppen und weitere Funktionen folgen.</p></aside></main>`;
const $ = id => document.getElementById(id);
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
let selected=null, mode='select', partId='brick-2x4', yaw=0, preview=null, blocked=false, lastPointer=null, down=null;
const viewport=$('viewport'), scene=new THREE.Scene(); scene.background=new THREE.Color('#e9edf0');
const camera=new THREE.OrthographicCamera(-160,160,120,-120,1,4000); camera.position.set(200,200,200); camera.up.set(0,0,1); camera.lookAt(0,0,0);
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true}); renderer.setPixelRatio(Math.min(devicePixelRatio,2)); viewport.appendChild(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement); controls.enableDamping=true; controls.mouseButtons={LEFT:null,MIDDLE:THREE.MOUSE.PAN,RIGHT:THREE.MOUSE.ROTATE}; controls.update();
scene.add(new THREE.HemisphereLight(0xffffff,0x718091,2)); const light=new THREE.DirectionalLight(0xffffff,2); light.position.set(100,-100,250); scene.add(light);
const grid=new THREE.GridHelper(2000,200,0xaab5bc,0xcdd5da); grid.rotation.x=Math.PI/2; scene.add(grid);
const model=new THREE.Group(), ghost=new THREE.Group(); scene.add(model,ghost); const raycaster=new THREE.Raycaster(), pointer=new THREE.Vector2();
function clear(group){ while(group.children.length){const child=group.children[0];group.remove(child);child.traverse(o=>{o.geometry?.dispose();if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());});} }
function makePart(p,isGhost=false){
  const d=catalog[p.partId],group=new THREE.Group(), color=isGhost?(validate(p,history.document.parts,catalog)?'#d34848':'#2ca87f'):(p.color||'#db4437');
  for(const box of solids(d)){
    const transparent=isGhost||(box.insert&&d.assembly==='window');
    const material=new THREE.MeshStandardMaterial({color:box.insert&&!isGhost?(d.assembly==='window'?'#9ccbdc':'#6c4735'):color,transparent,opacity:isGhost?.52:transparent?.5:1,depthWrite:!transparent});
    const body=new THREE.Mesh(new THREE.BoxGeometry(box.w-.1,box.d-.1,box.h-.1),material);body.position.set(box.x+box.w/2,box.y+box.d/2,box.z+box.h/2);group.add(body);
    if(p.id===selected&&!isGhost){const edges=new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry),new THREE.LineBasicMaterial({color:'#1169db'}));edges.position.copy(body.position);group.add(edges);}
  }
  for(let x=0;x<d.width;x++)for(let y=0;y<d.depth;y++){if(d.corner&&x===1&&y===1)continue;const stud=new THREE.Mesh(new THREE.CylinderGeometry(3,3,1.5,12),new THREE.MeshStandardMaterial({color,transparent:isGhost,opacity:isGhost?.52:1}));stud.rotation.x=Math.PI/2;stud.position.set(x*10,y*10,d.height+.75);group.add(stud);}
  group.position.set(p.x,p.y,p.z);group.rotation.z=p.yaw*Math.PI/2;group.userData.partId=p.id;return group;
}
function updateGhost(){clear(ghost);if(mode==='place'&&preview)ghost.add(makePart(preview,true));}
function persist(){try{localStorage.setItem('klemmditor-project',JSON.stringify(history.document));$('save').textContent='Lokal gespeichert';}catch{$('save').textContent='Speichern fehlgeschlagen – JSON exportieren';}}
function render(){clear(model);history.document.parts.forEach(p=>model.add(makePart(p)));$('name').value=history.document.name;$('details').textContent=`${history.document.parts.length} Teile${selected?' · 1 ausgewählt':''}`;const counts=new Map();for(const p of history.document.parts){const def=catalog[p.partId], keys=def.assembly?[`${def.label} – Rahmen · ${p.color}`,`${def.label} – ${def.assembly==='window'?'Scheibe':'Türblatt'}`]:[`${def.label} · ${p.color}`];for(const key of keys)counts.set(key,(counts.get(key)||0)+1);}$('materials').replaceChildren(...Array.from(counts,([name,count])=>{const row=document.createElement('div');row.className='material';row.textContent=`${name} × ${count}`;return row;}));$('undo').disabled=!history.undoStack.length;$('redo').disabled=!history.redoStack.length;updateGhost();}
function commit(doc){history.execute(doc);persist();render();}
function setMode(next){mode=next;preview=null;$('select').classList.toggle('active',mode==='select');$('place').classList.toggle('active',mode==='place');$('status').textContent=mode==='place'?'Setzen · Zeiger bewegen und klicken. R dreht das Teil.':'Auswählen · Teil anklicken.';updateGhost();}
function point(e){const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);}
function project(e){point(e);let z=Number($('height').value)*4;if($('placement').value==='surface'){const hit=raycaster.intersectObjects(model.children,true)[0];let obj=hit?.object;while(obj&&!obj.userData.partId)obj=obj.parent;const target=history.document.parts.find(p=>p.id===obj?.userData.partId);if(target)z=target.z+catalog[target.partId].height;else z=0;}const plane=new THREE.Plane(new THREE.Vector3(0,0,1),-z), p=new THREE.Vector3();if(!raycaster.ray.intersectPlane(plane,p))return;preview={id:'preview',partId,x:Math.round(p.x/10)*10,y:Math.round(p.y/10)*10,z,yaw,color:$('color').value};$('status').textContent=validate(preview,history.document.parts,catalog)||`Vorschau: X ${preview.x}, Y ${preview.y}, Z ${preview.z} · Klicken zum Setzen`;updateGhost();}
renderer.domElement.addEventListener('pointerdown',e=>{if(e.button===0)down={x:e.clientX,y:e.clientY};});
renderer.domElement.addEventListener('pointermove',e=>{if(blocked&&lastPointer&&Math.hypot(e.clientX-lastPointer.x,e.clientY-lastPointer.y)>=8)blocked=false;if(mode==='place'&&!e.buttons&&e.pointerType!=='touch')project(e);});
renderer.domElement.addEventListener('pointerup',e=>{if(!down||e.button!==0||Math.hypot(e.clientX-down.x,e.clientY-down.y)>4){down=null;return;}down=null;if(mode==='place'){if(e.pointerType==='touch'){project(e);return;}if(!preview||blocked||validate(preview,history.document.parts,catalog))return;commit({...history.document,parts:[...history.document.parts,{...preview,id:crypto.randomUUID()}]});blocked=true;lastPointer={x:e.clientX,y:e.clientY};}else{point(e);const hit=raycaster.intersectObjects(model.children,true)[0];let obj=hit?.object;while(obj&&!obj.userData.partId)obj=obj.parent;selected=obj?.userData.partId||null;render();}});
renderer.domElement.addEventListener('pointercancel',()=>down=null);window.addEventListener('blur',()=>down=null);
function resize(){const w=viewport.clientWidth,h=viewport.clientHeight;renderer.setSize(w,h);const a=w/h;camera.left=-120*a;camera.right=120*a;camera.top=120;camera.bottom=-120;camera.updateProjectionMatrix();}new ResizeObserver(resize).observe(viewport);resize();function frame(){controls.update();renderer.render(scene,camera);requestAnimationFrame(frame);}frame();
let brickHeight='normal';
const heightChoice=document.createElement('div'); heightChoice.className='height-choice'; heightChoice.setAttribute('role','group'); heightChoice.setAttribute('aria-label','Steinhöhe');
for(const [value,label] of [['normal','Normal'],['flat','Flach']]){const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.height=value;b.onclick=()=>{brickHeight=value;const prefix=value==='flat'?'plate-':'brick-';if(/^(brick|plate)-/.test(partId)){const variant=prefix+partId.replace(/^(brick|plate)-/,'');if(catalog[variant]){partId=variant;if(preview){preview.partId=variant;updateGhost();}}}drawCatalog();};heightChoice.append(b);}
$('catalog').before(heightChoice);
function drawCatalog(){
  for(const button of heightChoice.children){const active=button.dataset.height===brickHeight;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));}
  $('catalog').replaceChildren();
  for(const [id,def] of Object.entries(catalog)){if(!def.assembly&&!id.startsWith(brickHeight==='flat'?'plate-':'brick-'))continue;const b=document.createElement('button');b.className='catalog-item';b.textContent=def.label;b.onclick=()=>{partId=id;setMode('place');};$('catalog').append(b);}
}
drawCatalog();
$('select').onclick=()=>setMode('select');$('place').onclick=()=>setMode('place');$('rotate').onclick=()=>{yaw=(yaw+1)%4;if(preview){preview.yaw=yaw;updateGhost();}};
$('delete').onclick=()=>{if(selected){commit({...history.document,parts:history.document.parts.filter(p=>p.id!==selected)});selected=null;render();}};
$('undo').onclick=()=>{if(history.undo()){selected=null;persist();render();}};$('redo').onclick=()=>{if(history.redo()){selected=null;persist();render();}};
$('name').onchange=e=>commit({...history.document,name:e.target.value.trim()||'Mein Projekt'});$('height').onchange=()=>{blocked=false;$('placement').value='fixed';if(preview){preview.z=Number($('height').value)*4;updateGhost();}};$('placement').onchange=()=>{preview=null;blocked=false;updateGhost();};$('color').oninput=()=>{if(preview){preview.color=$('color').value;updateGhost();}};
$('iso').onclick=()=>{camera.position.copy(controls.target).add(new THREE.Vector3(200,200,200));camera.up.set(0,0,1);controls.update();};$('top').onclick=()=>{camera.position.copy(controls.target).add(new THREE.Vector3(0,0,300));camera.up.set(0,1,0);controls.update();};
$('export').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(history.document,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='klemmditor.json';a.click();URL.revokeObjectURL(url);};
$('import').onchange=async e=>{try{const doc=JSON.parse(await e.target.files[0].text());if(typeof doc.name!=='string'||!Array.isArray(doc.parts)||doc.parts.some(p=>!catalog[p.partId]||validate(p,[],catalog)||typeof p.id!=='string'||typeof p.color!=='string'))throw Error('Ungültiges oder nicht unterstütztes Projekt');if(!confirm('Aktuelles Projekt durch Import ersetzen?'))return;commit(doc);selected=null;render();}catch(err){alert(`Import fehlgeschlagen: ${err.message}`);}finally{e.target.value='';}};
window.addEventListener('keydown',e=>{if(/INPUT|TEXTAREA/.test(document.activeElement.tagName))return;const key=e.key.toLowerCase();if((e.ctrlKey||e.metaKey)&&key==='z'){e.preventDefault();(e.shiftKey?$('redo'):$('undo')).click();}else if((e.ctrlKey||e.metaKey)&&key==='y'){e.preventDefault();$('redo').click();}else if(key==='v')setMode('select');else if(key==='b')setMode('place');else if(key==='r')$('rotate').click();else if(key==='delete'||key==='backspace')$('delete').click();else if(key==='escape')setMode('select');});render();
