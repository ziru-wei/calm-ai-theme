'use strict';
// Local-only project-backed dashboard, no packages or browser databases.
const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const ROOT=__dirname, HOST='127.0.0.1', PORT=Number(process.env.PORT||4173);
const CATALOG=path.join(ROOT,'catalog.json'), DEFAULTS=path.join(ROOT,'catalog.defaults.json');
const NOTE_DIR=path.join(ROOT,'notes'), MEDIA_DIR=path.join(ROOT,'images','notes'), FIG_DIR=path.join(ROOT,'images','theory');
const SETTINGS=path.join(ROOT,'settings.json'), AXES=path.join(ROOT,'axes.json');
const ID=/^[a-z0-9-]{1,48}$/, IMG_FILE=/^[0-9]{13}-[a-f0-9]{12}\.(png|jpg|gif)$/;
const FIG_FILE=/^[0-9]{13}-[a-f0-9]{12}\.(png|jpg|gif|webp|avif)$/;
const FORMATS={'image/png':'.png','image/jpeg':'.jpg','image/gif':'.gif'};
const MIME={'.png':'image/png','.jpg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.avif':'image/avif'};
function send(res,status,content,mime='application/json; charset=utf-8'){
  res.writeHead(status,{'Content-Type':mime,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});
  res.end(Buffer.isBuffer(content)||typeof content==='string'?content:JSON.stringify(content));
}
function error(res,status,message){return send(res,status,{error:message});}
async function body(req,max){const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>max){const e=new Error('Payload too large');e.code=413;throw e;}chunks.push(c);}return Buffer.concat(chunks);}
async function jsonBody(req,max=2*1024*1024){try{return JSON.parse((await body(req,max)).toString('utf8'));}catch(e){if(e.code===413)throw e;const err=new Error('Invalid JSON');err.code=400;throw err;}}
async function writeAtomic(file,data){await fs.mkdir(path.dirname(file),{recursive:true});const tmp=file+'.'+crypto.randomBytes(6).toString('hex')+'.tmp';try{await fs.writeFile(tmp,JSON.stringify(data,null,2)+'\n');await fs.rename(tmp,file);}finally{await fs.unlink(tmp).catch(()=>{});}}
async function readJSON(file,fallback){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}}
const str=(s,n=2000)=>typeof s==='string'&&s.length<=n;
const url=s=>str(s,2000)&&(!s||/^https?:\/\//i.test(s));
function validCatalog(data){
 if(!data||!Array.isArray(data.labels)||!Array.isArray(data.cards)||data.labels.length>100||data.cards.length>5000)return false;
 const ids=new Set(), labels=new Set();
 for(const l of data.labels){if(!l||!ID.test(l.id)||labels.has(l.id)||!str(l.name,64)||!l.name.trim()||!/^#[a-fA-F0-9]{6}$/.test(l.color)||!(l.note===undefined||str(l.note,10000))||!(l.noteRich===undefined||validRichText(l.noteRich,10000)))return false;labels.add(l.id);}
 for(const c of data.cards){
  if(!c||!ID.test(c.id)||ids.has(c.id)||!str(c.title,250)||!str(c.year,80)||!str(c.by,300)||!str(c.desc,10000)||!str(c.tags,2000)||!['contain','cover'].includes(c.mode)||!url(c.url)||!url(c.paper)||!url(c.img)||!url(c.videoLink)||!labels.has(c.labelId)&&c.labelId!=='')return false;
  ids.add(c.id);
  if(!Number.isFinite(c.order)||c.order<0)return false;
 }
 return true;
}
const FIELD_KEYS=['image','title','year','description','credit','keywords','label','links','video','note'];
function validViewFields(value){if(value===undefined)return true;if(!value||typeof value!=='object'||Array.isArray(value))return false;for(const [view,fields] of Object.entries(value)){if(!['gallery','board','axis'].includes(view)||!fields||typeof fields!=='object'||Array.isArray(fields))return false;for(const [k,v] of Object.entries(fields))if(!FIELD_KEYS.includes(k)||typeof v!=='boolean')return false;}return true;}
function validAxes(data){if(!data||!Array.isArray(data.dimensions)||data.dimensions.length>40)return false;const ids=new Set();for(const d of data.dimensions){if(!d||!ID.test(d.id)||ids.has(d.id)||!str(d.title,140)||!str(d.start,80)||!str(d.end,80)||!Array.isArray(d.marks)||d.marks.length>40||!Array.isArray(d.placements)||d.placements.length>5000)return false;ids.add(d.id);const midIds=new Set(),cardIds=new Set();for(const m of d.marks){if(!m||!ID.test(m.id)||midIds.has(m.id)||!str(m.label,100)||!Number.isFinite(m.pos)||m.pos<0||m.pos>1)return false;midIds.add(m.id);}for(const p of d.placements){if(!p||!ID.test(p.cardId)||cardIds.has(p.cardId)||!Number.isFinite(p.pos)||p.pos<0||p.pos>1)return false;cardIds.add(p.cardId);}}return true;}
async function loadCatalog(){const value=await readJSON(CATALOG,null);return value||await readJSON(DEFAULTS,{version:1,labels:[],cards:[]});}
function validRichText(blocks,maxChars){if(!Array.isArray(blocks)||blocks.length>1200)return false;let total=0;for(const b of blocks){if(!b||b.type!=='text'||!str(b.value,100000)||!(b.bold===undefined||typeof b.bold==='boolean')||!(b.highlight===undefined||typeof b.highlight==='boolean'))return false;total+=b.value.length;if(total>maxChars)return false;}return true;}
function validBlocks(value){if(!value||!Array.isArray(value.blocks)||value.blocks.length>1200)return false;let chars=0;for(const x of value.blocks){if(!x||typeof x!=='object')return false;if(x.type==='text'&&str(x.value,100000)&&(x.bold===undefined||typeof x.bold==='boolean')&&(x.highlight===undefined||typeof x.highlight==='boolean')){chars+=x.value.length;}else if(x.type==='image'&&typeof x.file==='string'&&IMG_FILE.test(x.file)){}else return false;if(chars>100000)return false;}return true;}
async function readNotes(ids){const obj={};for(const id of ids){const data=await readJSON(path.join(NOTE_DIR,id+'.json'),{blocks:[]});obj[id]=validBlocks(data)?data.blocks:[];}return obj;}
function validImage(bytes,type){if(type==='image/png')return bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));if(type==='image/jpeg')return bytes.length>=4&&bytes[0]===255&&bytes[1]===216&&bytes.at(-2)===255&&bytes.at(-1)===217;if(type==='image/gif')return ['GIF87a','GIF89a'].includes(bytes.toString('ascii',0,6));return false;}
async function existsCard(id){const catalog=await loadCatalog();return catalog.cards.some(x=>x.id===id);}
async function fileOr404(res,file,mime){try{return send(res,200,await fs.readFile(file),mime);}catch(e){if(e.code==='ENOENT')return error(res,404,'File not found');throw e;}}
async function figures(){const obj={};try{for(const id of await fs.readdir(FIG_DIR)){if(!ID.test(id))continue;const entries=await fs.readdir(path.join(FIG_DIR,id),{withFileTypes:true}).catch(()=>[]);obj[id]=entries.filter(x=>x.isFile()&&FIG_FILE.test(x.name)).sort((a,b)=>a.name.localeCompare(b.name)).map(x=>({key:x.name,itemId:id,url:`/images/theory/${id}/${x.name}`}));}}catch(e){if(e.code!=='ENOENT')throw e;}return {items:obj};}
async function route(req,res){
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,`http://${HOST}:${PORT}`).pathname);}catch{return error(res,400,'Bad URL');}
 const method=req.method;
 const statics={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/app.css':'app.css'};
 if(method==='GET'&&statics[pathname]){const filename=statics[pathname];return fileOr404(res,path.join(ROOT,filename),filename.endsWith('js')?'application/javascript; charset=utf-8':filename.endsWith('css')?'text/css; charset=utf-8':'text/html; charset=utf-8');}
 if(method==='GET'&&/^\/card\/[a-z0-9-]+\/?$/.test(pathname))return fileOr404(res,path.join(ROOT,'index.html'),'text/html; charset=utf-8');
 if(method==='GET'&&pathname==='/favicon.ico')return send(res,204,'');
 if(method==='GET'&&pathname==='/api/catalog')return send(res,200,await loadCatalog());
 if(method==='PUT'&&pathname==='/api/catalog'){
  const data=await jsonBody(req);if(!validCatalog(data))return error(res,400,'Invalid catalog');
  await writeAtomic(CATALOG,{version:1,labels:data.labels,cards:data.cards});return send(res,200,{ok:true});
 }
 if(method==='GET'&&pathname==='/api/settings')return send(res,200,await readJSON(SETTINGS,{cardWidth:210,view:'gallery'}));
 if(method==='PUT'&&pathname==='/api/settings'){
  const data=await jsonBody(req,2048);
  if(!Number.isInteger(data.cardWidth)||data.cardWidth<150||data.cardWidth>440||!['gallery','board','axis'].includes(data.view)||!validViewFields(data.viewFields))return error(res,400,'Bad settings');
  await writeAtomic(SETTINGS,{cardWidth:data.cardWidth,view:data.view,viewFields:data.viewFields});return send(res,200,{ok:true});
 }
 if(method==='GET'&&pathname==='/api/notes')return send(res,200,{notes:await readNotes((await loadCatalog()).cards.map(x=>x.id))});
 if(method==='GET'&&pathname==='/api/axes')return send(res,200,await readJSON(AXES,{dimensions:[]}));
 if(method==='PUT'&&pathname==='/api/axes'){
  const data=await jsonBody(req,512*1024);if(!validAxes(data))return error(res,400,'Invalid axis data');
  await writeAtomic(AXES,{dimensions:data.dimensions});return send(res,200,{ok:true});
 }
 const note=pathname.match(/^\/api\/notes\/([a-z0-9-]+)$/);
 if(method==='PUT'&&note){const id=note[1];if(!ID.test(id)||!await existsCard(id))return error(res,404,'Unknown card');const data=await jsonBody(req,512*1024);if(!validBlocks(data))return error(res,400,'Bad note blocks');await writeAtomic(path.join(NOTE_DIR,id+'.json'),{blocks:data.blocks});return send(res,200,{ok:true});}
 const upload=pathname.match(/^\/api\/note-image\/([a-z0-9-]+)$/);
 if(method==='POST'&&upload){const id=upload[1];if(!ID.test(id)||!await existsCard(id))return error(res,404,'Unknown card');const mime=String(req.headers['content-type']||'').split(';')[0].trim().toLowerCase();if(!FORMATS[mime])return error(res,415,'Use PNG, JPEG or GIF');const bytes=await body(req,16*1024*1024);if(!validImage(bytes,mime))return error(res,415,'Invalid image');const name=Date.now()+'-'+crypto.randomBytes(6).toString('hex')+FORMATS[mime];const dir=path.join(MEDIA_DIR,id);await fs.mkdir(dir,{recursive:true});await fs.writeFile(path.join(dir,name),bytes,{flag:'wx'});return send(res,201,{file:name,url:`/images/notes/${id}/${name}`});}
 const media=pathname.match(/^\/images\/notes\/([a-z0-9-]+)\/([^/]+)$/);
 if(method==='GET'&&media){const [,id,name]=media;if(!ID.test(id)||!IMG_FILE.test(name))return error(res,404,'Not found');return fileOr404(res,path.join(MEDIA_DIR,id,name),MIME[path.extname(name)]);}
 if(method==='GET'&&pathname==='/api/figures')return send(res,200,await figures());
 const uploadFigure=pathname.match(/^\/api\/figures\/([a-z0-9-]+)$/);
 if(method==='POST'&&uploadFigure){const id=uploadFigure[1];if(!ID.test(id)||!await existsCard(id))return error(res,404,'Unknown card');const mime=String(req.headers['content-type']||'').split(';')[0].trim().toLowerCase();if(!FORMATS[mime])return error(res,415,'Use PNG, JPEG or GIF');const bytes=await body(req,16*1024*1024);if(!validImage(bytes,mime))return error(res,415,'Invalid image');const name=Date.now()+'-'+crypto.randomBytes(6).toString('hex')+FORMATS[mime];await fs.mkdir(path.join(FIG_DIR,id),{recursive:true});await fs.writeFile(path.join(FIG_DIR,id,name),bytes,{flag:'wx'});return send(res,201,{key:name,itemId:id,url:`/images/theory/${id}/${name}`});}
 const figure=pathname.match(/^\/images\/theory\/([a-z0-9-]+)\/([^/]+)$/);
 if(method==='GET'&&figure){const [,id,name]=figure;if(!ID.test(id)||!FIG_FILE.test(name))return error(res,404,'Not found');return fileOr404(res,path.join(FIG_DIR,id,name),MIME[path.extname(name)]);}
 const removeFigure=pathname.match(/^\/api\/figures\/([a-z0-9-]+)\/([^/]+)$/);
 if(method==='DELETE'&&removeFigure){const [,id,name]=removeFigure;if(!ID.test(id)||!FIG_FILE.test(name))return error(res,404,'Not found');await fs.unlink(path.join(FIG_DIR,id,name)).catch(e=>{if(e.code!=='ENOENT')throw e;});return send(res,200,{ok:true});}
 return error(res,404,'Not found');
}
const server=http.createServer((req,res)=>{
 const origin=req.headers.origin;if(origin&&origin!==`http://${HOST}:${PORT}`&&origin!==`http://localhost:${PORT}`)return error(res,403,'Origin forbidden');
 route(req,res).catch(e=>{console.error(e);if(!res.headersSent)error(res,e.code===413?413:e.code===400?400:500,e.code===413||e.code===400?e.message:'Local server error');else res.destroy();});
});
server.listen(PORT,HOST,()=>console.log(`Ambient Dashboard: http://${HOST}:${PORT}`));
server.on('error',e=>{console.error(e.message);process.exitCode=1;});
