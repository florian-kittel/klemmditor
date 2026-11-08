import { catalog } from './catalog.js';
import { validate } from './domain.js';

const PREFIX='klemmditor:project:';
const ACTIVE='klemmditor:active-project';

export function isProjectDocument(doc){
  if(!doc||typeof doc.name!=='string'||!Array.isArray(doc.parts))return false;
  const ids=new Set();
  return doc.parts.every(p=>{
    if(!p||typeof p.id!=='string'||ids.has(p.id)||typeof p.color!=='string'||!catalog[p.partId]||validate(p,[],catalog))return false;
    ids.add(p.id);return true;
  });
}

export class ProjectStore {
  constructor(storage){this.storage=storage;}
  read(id){
    const raw=this.storage.getItem(PREFIX+id);
    if(!raw)throw Error('Das Projekt wurde nicht gefunden.');
    const record=JSON.parse(raw);
    if(record.version!==1||record.id!==id||!isProjectDocument(record.document))throw Error('Das gespeicherte Projekt ist ungültig.');
    return record;
  }
  save(id,document){
    const record={version:1,id,updatedAt:new Date().toISOString(),document};
    this.storage.setItem(PREFIX+id,JSON.stringify(record));
    return record;
  }
  activate(id){this.storage.setItem(ACTIVE,id);}
  list(){
    const records=[];
    for(let i=0;i<this.storage.length;i++){
      const key=this.storage.key(i);
      if(key?.startsWith(PREFIX))records.push(this.read(key.slice(PREFIX.length)));
    }
    return records.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
  }
  startup(){
    // Keep the original single-project save intact as a migration backup.
    const legacy=this.storage.getItem('klemmditor-project');
    if(legacy&&!this.storage.getItem(PREFIX+'legacy')){
      const doc=JSON.parse(legacy);
      if(!isProjectDocument(doc))throw Error('Der bisherige Speicherstand konnte nicht übernommen werden.');
      this.save('legacy',doc);
    }
    const active=this.storage.getItem(ACTIVE);
    if(active&&this.storage.getItem(PREFIX+active))return this.read(active);
    return this.list()[0]||null;
  }
}
