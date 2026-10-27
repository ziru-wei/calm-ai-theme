'use strict';
const $=s=>document.querySelector(s);
const el=(tag,cls='',label)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(label!==undefined)n.textContent=label;return n;};
let catalog={labels:[],cards:[]}, notes=new Map(), figures={},view='gallery',filter='all',search='',cardWidth=210;
let dimensions=[],viewFields={};
const VIEW_FIELDS=['image','title','year','description','credit','keywords','label','links','video','note'];
const FIELD_NAMES={image:'Cover image',title:'Project name',year:'Year',description:'Description',credit:'Credit / venue',keywords:'Keywords',label:'Label',links:'Project / paper links',video:'Video link',note:'Note link'};
const FIELD_DEFAULTS={gallery:{image:true,title:true,year:true,description:true,credit:false,keywords:false,label:false,links:true,video:true,note:true},board:{image:true,title:true,year:true,description:true,credit:false,keywords:false,label:false,links:false,video:false,note:false},axis:{image:true,title:true,year:true,description:false,credit:false,keywords:false,label:false,links:false,video:false,note:false}};
function showField(field,which=view){return (viewFields[which]||FIELD_DEFAULTS[which]||{})[field]!==false;}
function clamp01(n){return Math.max(0,Math.min(1,Number(n)||0));}
let saveTimer=0,saveChain=Promise.resolve(),settingsTimer=0,activePage=null,activeNoteFlush=null,detailFromApp=false;
const MEDIA_TYPES=new Set(['image/jpeg','image/png','image/gif']);
const idRegex=/^[a-z0-9-]{1,48}$/;
let RO=false;
const dataJSON=async(url,opts={})=>{if(RO&&opts.method&&opts.method!=='GET')return {ok:true};const r=await fetch(url,{cache:'no-store',...opts});const data=await r.json();if(!r.ok)throw new Error(data.error||`Request failed: ${r.status}`);return data;};
function toast(message){const m=$('#message');m.textContent=message;m.classList.add('show');clearTimeout(toast._timer);toast._timer=setTimeout(()=>m.classList.remove('show'),2500);}
function labelFor(id){return catalog.labels.find(x=>x.id===id);}
function allLabels(){return [...catalog.labels,{id:'',name:'Unlabeled',color:'#d7dce2'}];}
function noteBlocks(id){return notes.get(id)||[];}
function noteImageUrl(id,name){return `images/notes/${encodeURIComponent(id)}/${encodeURIComponent(name)}`;}
function noteCover(id){for(const b of noteBlocks(id)){if(b.type==='image')return noteImageUrl(id,b.file);if(b.type==='text'&&b.value.trim())return '';}return '';}
function coverSrc(c){return noteCover(c.id)||c.img||'';}
function parseVideo(raw){
 if(!raw)return null;
 try{const url=new URL(raw);const host=url.hostname.toLowerCase();let match;
  if(host==='youtu.be'||host.endsWith('.youtu.be')){match=url.pathname.match(/^\/([\w-]{11})/);if(match)return {src:`https://www.youtube-nocookie.com/embed/${match[1]}?rel=0`,source:'YouTube'};}
  if(host==='youtube.com'||host==='www.youtube.com'||host==='m.youtube.com'||host==='youtube-nocookie.com'||host==='www.youtube-nocookie.com'){
    const id=url.searchParams.get('v')||url.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{11})/)?.[1];
    if(/^[\w-]{11}$/.test(id||''))return {src:`https://www.youtube-nocookie.com/embed/${id}?rel=0`,source:'YouTube'};
  }
  if(host==='vimeo.com'||host==='www.vimeo.com'||host==='player.vimeo.com'){
    match=url.pathname.match(/(?:^|\/)(\d{6,12})(?:\/|$)/);if(match)return {src:`https://player.vimeo.com/video/${match[1]}?title=0&byline=0&portrait=0`,source:'Vimeo'};
  }
 }catch{}return null;
}
function external(label,url){if(!url)return null;const a=el('a','',label);a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.addEventListener('click',e=>e.stopPropagation());return a;}
function saveCatalogSoon(){clearTimeout(saveTimer);saveTimer=setTimeout(saveCatalog,380);}
function saveCatalog(){clearTimeout(saveTimer);const snapshot=JSON.stringify({version:1,labels:catalog.labels,cards:catalog.cards});
 saveChain=saveChain.catch(()=>{}).then(()=>dataJSON('api/catalog',{method:'PUT',headers:{'Content-Type':'application/json'},body:snapshot}));
 saveChain.catch(err=>toast('Catalog save failed: '+err.message));return saveChain;
}
function saveSettings(){clearTimeout(settingsTimer);const snapshot=JSON.stringify({cardWidth,view,viewFields});settingsTimer=setTimeout(()=>dataJSON('api/settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:snapshot}).catch(e=>toast(e.message)),300);}
function setView(next){if(!['gallery','board','axis'].includes(next))return;view=next;for(const name of ['gallery','board','axis'])$('#view-'+name).classList.toggle('active',name===view);$('#filters').hidden=view==='axis';$('#card-fields-menu')?.remove();$('#size-dock').hidden=false;$('#card-properties').title='Card properties for '+view;saveSettings();render();}
function setSize(n){cardWidth=Math.max(150,Math.min(440,Number(n)||210));document.documentElement.style.setProperty('--card-width',cardWidth+'px');$('#size-slider').value=String(cardWidth);$('#size-value').textContent=String(cardWidth);saveSettings();}
function matches(c){if(filter!=='all'&&c.labelId!==filter)return false;const q=search.toLowerCase().trim();if(!q)return true;return [c.title,c.year,c.by,c.desc,c.tags,c.url,c.paper,c.videoLink,labelFor(c.labelId)?.name].some(x=>String(x||'').toLowerCase().includes(q));}
function labelNote(l){
 if(!l.id)return null;
 const editor=el('div','label-note rich-editor');editor.contentEditable='true';editor.dataset.placeholder='Add label note…';editor.setAttribute('role','textbox');editor.setAttribute('aria-label','Note for '+l.name);
 fillRichEditor(editor,Array.isArray(l.noteRich)?l.noteRich:[{type:'text',value:l.note||''}]);
 editor.addEventListener('input',()=>{l.noteRich=editorBlocks(editor).filter(b=>b.type==='text');l.note=l.noteRich.map(b=>b.value).join('');saveCatalogSoon();});
 editor.addEventListener('click',e=>e.stopPropagation());
 return editor;
}
function renderFilters(){const f=$('#filters');f.replaceChildren();const filters=[{id:'all',name:'All',color:''},...catalog.labels];for(const item of filters){const b=el('button','filter'+(filter===item.id?' active':''));b.type='button';if(item.id!=='all'){const dot=el('span','dot');dot.style.background=item.color;b.append(dot);}b.append(document.createTextNode(item.name));b.addEventListener('click',()=>{filter=item.id;render();});f.append(b);}}
function cover(c,cls='cover'){const box=el('div',cls);const url=coverSrc(c);if(url){const img=el('img',c.mode==='cover'||noteCover(c.id)?'fill':'');img.src=url;img.loading='lazy';img.alt=c.title+' visual';img.referrerPolicy='no-referrer';img.onerror=()=>{if(img.isConnected){img.replaceWith(el('div','fallback','Image unavailable'));}};box.append(img);}else box.append(el('div','fallback','No visual'));
 if(parseVideo(c.videoLink)){box.append(el('span','video-indicator','Video'));}return box;}
function cardBody(c,which){
 const body=el('div','card-body');
 if(showField('year',which))body.append(el('div','card-year',c.year||'—'));
 if(showField('title',which))body.append(el('h3','',c.title||'Untitled'));
 if(showField('description',which)&&c.desc)body.append(el('p','card-desc',c.desc));
 if(showField('credit',which)&&c.by)body.append(el('p','card-extra',c.by));
 if(showField('keywords',which)&&c.tags)body.append(el('p','card-extra',c.tags));
 if(showField('label',which)){const l=labelFor(c.labelId);if(l)body.append(el('span','card-tag',l.name));}
 const foot=el('div','card-foot');
 if(showField('links',which))for(const [title,link] of [['Project ↗',c.url],['Paper ↗',c.paper]]){const a=external(title,link);if(a)foot.append(a);}
 if(showField('video',which)&&c.videoLink){const a=external('Video ↗',c.videoLink);if(a)foot.append(a);}
 if(showField('note',which)){const note=el('button','note-button',noteBlocks(c.id).length?'Note •':'Note');note.type='button';note.addEventListener('click',e=>{e.stopPropagation();openDetail(c.id);});foot.append(note);}
 if(foot.childNodes.length)body.append(foot);
 return body;
}
function galleryCard(c){const card=el('article','card');card.tabIndex=0;card.setAttribute('aria-label','Open '+c.title);
 if(showField('image','gallery'))card.append(cover(c));card.append(cardBody(c,'gallery'));
 card.addEventListener('click',()=>openDetail(c.id));card.addEventListener('keydown',e=>{if(e.target===card&&(e.key==='Enter'||e.key===' ')){e.preventDefault();openDetail(c.id);}});return card;}
function gallery(){const m=$('#main');const matched=catalog.cards.filter(matches).sort((a,b)=>a.order-b.order);if(!matched.length){m.append(el('div','empty','No cards'));return;}
 for(const label of allLabels()){const records=matched.filter(c=>c.labelId===label.id);if(!records.length)continue;const section=el('section','group');const head=el('div','group-head');const dot=el('span','swatch');dot.style.background=label.color;head.append(dot,el('h2','',label.name),el('span','count',String(records.length)));if(label.id){const menu=el('button','label-more','···');menu.title='Edit labels';menu.type='button';menu.addEventListener('click',manageLabels);head.append(menu);}const grid=el('div','gallery-grid');for(const c of records)grid.append(galleryCard(c));section.append(head);const ln=labelNote(label);if(ln)section.append(ln);section.append(grid);m.append(section);}
}
function boardCard(c){const card=el('article','board-card');card.draggable=true;card.title='Drag to another label';card.dataset.id=c.id;
 if(showField('image','board')){const url=coverSrc(c);if(url){const img=el('img','board-thumb');img.src=url;img.loading='lazy';img.alt='';img.referrerPolicy='no-referrer';img.onerror=()=>{if(img.isConnected)img.replaceWith(el('div','board-thumb board-placeholder','Image unavailable'));};card.append(img);}else card.append(el('div','board-thumb board-placeholder','—'));}
 const copy=el('div','board-card-copy');
 if(showField('title','board'))copy.append(el('strong','',c.title||'Untitled'));
 if(showField('year','board'))copy.append(el('small','',c.year||''));
 if(showField('description','board')&&c.desc)copy.append(el('p','',c.desc));
 if(showField('credit','board')&&c.by)copy.append(el('p','',c.by));
 if(showField('keywords','board')&&c.tags)copy.append(el('p','',c.tags));
 if(showField('label','board'))copy.append(el('p','',labelFor(c.labelId)?.name||'Unlabeled'));
 const links=el('div','compact-links');
 if(showField('links','board'))for(const [text,url] of [['Project ↗',c.url],['Paper ↗',c.paper]]){const a=external(text,url);if(a)links.append(a);}
 if(showField('video','board')){const a=external('Video ↗',c.videoLink);if(a)links.append(a);}
 if(showField('note','board')){const btn=el('button','','Note');btn.type='button';btn.addEventListener('click',e=>{e.stopPropagation();openDetail(c.id);});links.append(btn);}
 if(links.childNodes.length)copy.append(links);
 card.append(copy);card.addEventListener('click',()=>openDetail(c.id));card.addEventListener('dragstart',event=>{event.dataTransfer.setData('text/plain',c.id);event.dataTransfer.effectAllowed='move';});return card;}
function board(){const m=$('#main'),root=el('div','board'),filtered=catalog.cards.filter(matches).sort((a,b)=>a.order-b.order);if(!filtered.length){m.append(el('div','empty','No cards'));return;}
 for(const l of allLabels()){
  if(filter!=='all'&&filter!==l.id)continue;
  const group=filtered.filter(c=>c.labelId===l.id),column=el('section','board-column');column.dataset.label=l.id;
  const head=el('div','board-column-head'),dot=el('span','dot');dot.style.background=l.color;
  const add=el('button','add-column-card','+');add.type='button';add.title='Add card here';add.addEventListener('click',()=>addCard(l.id));
  head.append(dot,el('strong','',l.name),el('span','count',String(group.length)));if(l.id){const menu=el('button','label-more','···');menu.title='Edit labels';menu.type='button';menu.addEventListener('click',manageLabels);head.append(menu);}head.append(add);const list=el('div','column-list');for(const c of group)list.append(boardCard(c));
  column.append(head);const ln=labelNote(l);if(ln)column.append(ln);column.append(list);
  column.addEventListener('dragover',e=>{if(e.dataTransfer.types.includes('text/plain')){e.preventDefault();column.classList.add('drop-target');}});
  column.addEventListener('dragleave',e=>{if(!column.contains(e.relatedTarget))column.classList.remove('drop-target');});
  column.addEventListener('drop',e=>{e.preventDefault();column.classList.remove('drop-target');const id=e.dataTransfer.getData('text/plain');const item=catalog.cards.find(x=>x.id===id);if(item&&item.labelId!==l.id){item.labelId=l.id;saveCatalogSoon();render();}});
  root.append(column);
 }
 m.append(root);
}
// Axis positions are independent for each dimension; a card may appear on more than one axis.
let axisSaveTimer=0,axisSaveChain=Promise.resolve();
function saveAxesSoon(){clearTimeout(axisSaveTimer);axisSaveTimer=setTimeout(()=>{const snapshot=JSON.stringify({dimensions});axisSaveChain=axisSaveChain.catch(()=>{}).then(()=>dataJSON('api/axes',{method:'PUT',headers:{'Content-Type':'application/json'},body:snapshot}));axisSaveChain.catch(e=>toast('Axis save failed: '+e.message));},270);}
function newId(prefix){return prefix+Math.random().toString(36).slice(2,10);}
function addDimension(){dimensions.push({id:newId('d'),title:'New dimension',start:'Low',end:'High',marks:[],placements:[]});saveAxesSoon();render();}
function axisMiniCard(c,placement=false){const card=el('div','axis-card'+(placement?' axis-card-plotted':''));card.dataset.cardId=c.id;card.setAttribute('aria-label',c.title);
 if(showField('image','axis')){const url=coverSrc(c);if(url){const image=el('img','axis-thumb');image.src=url;image.alt='';image.loading='lazy';image.onerror=()=>{image.hidden=true;};card.append(image);}}
 const body=el('div','axis-card-body');
 if(showField('title','axis'))body.append(el('strong','',c.title||'Untitled'));
 if(showField('year','axis'))body.append(el('span','axis-card-year',c.year||''));
 if(showField('description','axis')&&c.desc)body.append(el('p','',c.desc));
 if(showField('credit','axis')&&c.by)body.append(el('p','',c.by));
 if(showField('keywords','axis')&&c.tags)body.append(el('p','',c.tags));
 if(showField('label','axis'))body.append(el('span','axis-card-year',labelFor(c.labelId)?.name||'Unlabeled'));
 const links=el('div','axis-card-links');
 if(showField('links','axis'))for(const [t,u] of [['Project ↗',c.url],['Paper ↗',c.paper]]){const a=external(t,u);if(a)links.append(a);}
 if(showField('video','axis')){const a=external('Video ↗',c.videoLink);if(a)links.append(a);}
 if(showField('note','axis')){const a=el('button','','Note');a.type='button';a.addEventListener('click',e=>{e.stopPropagation();openDetail(c.id);});links.append(a);}
 if(links.childNodes.length)body.append(links);
 card.append(body);return card;}
function axisView(){const main=$('#main'),layout=el('div','axis-layout'),sidebar=el('aside','axis-sidebar'),sidehead=el('div','axis-sidebar-title');sidehead.append(el('strong','','Cards'),el('span','',String(catalog.cards.filter(matches).length)));sidebar.append(sidehead);
 const list=el('div','axis-source-list');for(const c of catalog.cards.filter(matches).sort((a,b)=>a.order-b.order)){
  const row=axisMiniCard(c);row.classList.add('axis-source');row.draggable=true;row.tabIndex=0;row.addEventListener('dragstart',e=>{e.dataTransfer.setData('application/x-axis-card',c.id);e.dataTransfer.setData('text/plain',c.id);e.dataTransfer.effectAllowed='copy';});
  row.addEventListener('click',()=>openDetail(c.id));row.addEventListener('keydown',e=>{if(e.key==='Enter')openDetail(c.id);});list.append(row);
 }sidebar.append(list);layout.append(sidebar);
 const space=el('div','axis-workspace'),top=el('div','axis-workspace-toolbar');top.append(el('span','','Dimensions'));
 const add=el('button','axis-add-dimension','+ Dimension');add.type='button';add.addEventListener('click',addDimension);top.append(add);space.append(top);
 if(!dimensions.length)space.append(el('div','axis-empty','Add a dimension, then drag cards from the left onto its axis.'));
 for(const dim of dimensions)space.append(axisDimension(dim));
 layout.append(space);main.append(layout);
 requestAnimationFrame(()=>{if(view==='axis')for(const stage of main.querySelectorAll('.axis-stage')){layoutAxisStage(stage);const ro=new ResizeObserver(()=>{if(stage.isConnected&&view==='axis')requestAnimationFrame(()=>layoutAxisStage(stage));else ro.disconnect();});for(const card of stage.querySelectorAll('.axis-placement .axis-card'))ro.observe(card);}});}
function axisDimension(dim){const root=el('section','axis-dimension'),header=el('div','axis-dim-header'),name=el('input','axis-dimension-name');name.value=dim.title;name.placeholder='Dimension';name.setAttribute('aria-label','Dimension name');name.addEventListener('input',()=>{dim.title=name.value;saveAxesSoon();});
 const addTick=el('button','axis-dim-action','+ Label');addTick.type='button';addTick.addEventListener('click',()=>{const used=dim.marks.map(x=>x.pos);let pos=.5;while(used.some(x=>Math.abs(x-pos)<.04)&&pos<.91)pos+=.1;dim.marks.push({id:newId('m'),label:'Middle',pos:clamp01(pos)});saveAxesSoon();render();});
 const del=el('button','axis-dim-action axis-dim-delete','×');del.type='button';del.title='Delete dimension';del.setAttribute('aria-label','Delete '+dim.title);del.addEventListener('click',()=>{if(!confirm('Delete dimension “'+dim.title+'”? All placements on this dimension will be removed.'))return;dimensions=dimensions.filter(d=>d.id!==dim.id);saveAxesSoon();render();});
 header.append(name,addTick,del);root.append(header);
 const stage=el('div','axis-stage');stage.dataset.dimId=dim.id;const track=el('div','axis-track');stage.append(track);
 function labelInput(text,cls,onEdit){const input=el('input',cls);input.value=text;input.setAttribute('aria-label',cls==='axis-end axis-left'?'Axis start label':cls==='axis-end axis-right'?'Axis end label':'Intermediate axis label');input.addEventListener('input',()=>{onEdit(input.value);saveAxesSoon();});return input;}
 stage.append(labelInput(dim.start,'axis-end axis-left',v=>dim.start=v),labelInput(dim.end,'axis-end axis-right',v=>dim.end=v));
 for(const mark of dim.marks){const tick=el('div','axis-tick');tick.dataset.markId=mark.id;tick.style.left=(clamp01(mark.pos)*100)+'%';tick.append(el('span','axis-tick-dot'));const input=labelInput(mark.label,'axis-tick-label',v=>mark.label=v);tick.append(input);
 const remove=el('button','axis-tick-remove','×');remove.type='button';remove.title='Remove label';remove.addEventListener('click',()=>{dim.marks=dim.marks.filter(x=>x!==mark);saveAxesSoon();render();});tick.append(remove);
 tick.querySelector('.axis-tick-dot').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();const dot=e.currentTarget;dot.setPointerCapture(e.pointerId);const move=ev=>{mark.pos=axisPosition(stage,ev.clientX);tick.style.left=(axisPadding(stage)+(stage.clientWidth-2*axisPadding(stage))*mark.pos)+'px';};dot.addEventListener('pointermove',move);dot.addEventListener('pointerup',()=>{dot.removeEventListener('pointermove',move);saveAxesSoon();},{once:true});});
 stage.append(tick);}
 for(const place of dim.placements){const c=catalog.cards.find(x=>x.id===place.cardId);if(!c)continue;const holder=el('div','axis-placement');holder.dataset.cardId=c.id;holder.dataset.pos=String(place.pos);
 const stem=el('span','axis-stem');holder.append(stem);const card=axisMiniCard(c,true);const remove=el('button','axis-remove','×');remove.type='button';remove.title='Remove from axis';remove.setAttribute('aria-label','Remove '+c.title+' from axis');remove.addEventListener('pointerdown',e=>e.stopPropagation());remove.addEventListener('click',e=>{e.stopPropagation();dim.placements=dim.placements.filter(p=>p.cardId!==c.id);saveAxesSoon();render();});card.append(remove);holder.append(card);
 let moved=false,startX=0,startY=0;card.addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('a,button,input'))return;startX=e.clientX;startY=e.clientY;moved=false;card.setPointerCapture(e.pointerId);card.classList.add('axis-dragging');});
 card.addEventListener('pointermove',e=>{if(!card.hasPointerCapture(e.pointerId))return;if(Math.hypot(e.clientX-startX,e.clientY-startY)>4)moved=true;if(moved){place.pos=axisPosition(stage,e.clientX);holder.dataset.pos=String(place.pos);holder.style.left=(axisPadding(stage)+(stage.clientWidth-2*axisPadding(stage))*place.pos)+'px';}});
 card.addEventListener('pointerup',e=>{if(!card.hasPointerCapture(e.pointerId))return;card.releasePointerCapture(e.pointerId);card.classList.remove('axis-dragging');if(moved){saveAxesSoon();layoutAxisStage(stage);setTimeout(()=>moved=false,50);}});
 card.addEventListener('click',e=>{if(moved){e.stopPropagation();return;}if(!e.target.closest('a,button'))openDetail(c.id);});stage.append(holder);}
 stage.addEventListener('dragover',e=>{if(e.dataTransfer.types.includes('application/x-axis-card')||e.dataTransfer.types.includes('text/plain')){e.preventDefault();stage.classList.add('axis-drop');e.dataTransfer.dropEffect='copy';}});
 stage.addEventListener('dragleave',e=>{if(!stage.contains(e.relatedTarget))stage.classList.remove('axis-drop');});
 stage.addEventListener('drop',e=>{e.preventDefault();stage.classList.remove('axis-drop');const id=e.dataTransfer.getData('application/x-axis-card')||e.dataTransfer.getData('text/plain');if(!catalog.cards.some(c=>c.id===id))return;const pos=axisPosition(stage,e.clientX),prior=dim.placements.find(p=>p.cardId===id);if(prior)prior.pos=pos;else dim.placements.push({cardId:id,pos});saveAxesSoon();render();});
 root.append(stage);return root;}
function axisPosition(stage,clientX){const r=stage.getBoundingClientRect(),pad=axisPadding(stage);return clamp01((clientX-r.left-pad)/Math.max(1,r.width-pad*2));}
function axisPadding(stage){return Math.max(64,Math.min(110,cardWidth*.295+16));}
function layoutAxisStage(stage){if(!stage.isConnected)return;const nodes=[...stage.querySelectorAll('.axis-placement')],w=stage.clientWidth;if(!w)return;const lanes=[];
 const pad=axisPadding(stage),track=stage.querySelector('.axis-track');track.style.left=pad+'px';track.style.right=pad+'px';
 for(const tick of stage.querySelectorAll('.axis-tick')){const id=tick.dataset.markId,dim=dimensions.find(d=>d.id===stage.dataset.dimId),mark=dim?.marks.find(m=>m.id===id);if(mark)tick.style.left=(pad+(w-2*pad)*clamp01(mark.pos))+'px';}
 const items=nodes.map(node=>{const p=clamp01(node.dataset.pos),card=node.querySelector('.axis-card'),width=card.getBoundingClientRect().width||164,height=card.getBoundingClientRect().height||84;
 return {node,p,width,height,x:pad+clamp01(p)*(w-2*pad)};}).sort((a,b)=>a.x-b.x);
 for(const item of items){let k=lanes.findIndex(l=>l.every(x=>Math.abs(x.x-item.x) >= (x.width+item.width)/2+9));if(k<0){k=lanes.length;lanes.push([]);}lanes[k].push(item);item.lane=k;}
 const offsets=[];let height=0;for(const lane of lanes){offsets.push(height);height+=Math.max(...lane.map(i=>i.height))+20;}
 stage.style.height=Math.max(190,height+104)+'px';
 for(const it of items){const bottom=64+offsets[it.lane];it.node.style.left=it.x+'px';it.node.style.bottom=bottom+'px';it.node.querySelector('.axis-stem').style.height=(bottom-40)+'px';}}
function cardProperties(){const old=$('#card-fields-menu');if(old){old.remove();return;}const menu=el('div','card-fields-menu');menu.id='card-fields-menu';menu.setAttribute('role','dialog');menu.setAttribute('aria-label','Visible card properties');const top=el('div','fields-title');top.append(el('strong','','Card properties'),el('span','',view.charAt(0).toUpperCase()+view.slice(1)));menu.append(top);
 for(const field of VIEW_FIELDS){const row=el('label','field-toggle');const check=el('input');check.type='checkbox';check.checked=showField(field);check.addEventListener('change',()=>{viewFields[view][field]=check.checked;saveSettings();const focused=document.activeElement;render();if(focused)check.focus();});row.append(check,el('span','',FIELD_NAMES[field]));menu.append(row);}
 document.body.append(menu);const anchor=$('#card-properties').getBoundingClientRect(),left=Math.min(innerWidth-menu.offsetWidth-10,Math.max(10,anchor.right-menu.offsetWidth));menu.style.left=left+'px';menu.style.top=Math.min(innerHeight-menu.offsetHeight-10,anchor.bottom+7)+'px';
 setTimeout(()=>{const close=e=>{if(!menu.isConnected){document.removeEventListener('pointerdown',close);return;}if(!menu.contains(e.target)&&!e.target.closest('#card-properties')){menu.remove();document.removeEventListener('pointerdown',close);}};document.addEventListener('pointerdown',close);},0);
}
function render(){renderFilters();$('#total').textContent=`${catalog.cards.length} cards`;$('#main').replaceChildren();if(view==='axis')axisView();else if(view==='board')board();else gallery();}
// A card opens as a document page. Properties are editable above video and notes.
function videoRegion(holder,c){
 holder.replaceChildren();
 if(!c.videoLink.trim())return;
 const parsed=parseVideo(c.videoLink);
 if(parsed){const zone=el('div','page-video');const iframe=el('iframe');
  iframe.src=parsed.src;iframe.title=c.title+' video';
  iframe.allow='autoplay; fullscreen; picture-in-picture; encrypted-media';iframe.allowFullscreen=true;
  iframe.loading='lazy';iframe.referrerPolicy='strict-origin-when-cross-origin';zone.append(iframe);holder.append(zone);
 }else{const row=el('div','video-fallback','This video cannot be embedded. '),link=external('Open video ↗',c.videoLink);if(link)row.append(link);holder.append(row);}
}
function propertyRow(container,name,initial,kind,onEdit){
 const row=el('div','property-row'),label=el('label','property-name',name),slot=el('div','property-value');
 const input=kind==='textarea'?el('textarea','property-input property-textarea'):kind==='select'?el('select','property-input'):el('input','property-input');
 if(kind!=='select'&&kind!=='textarea')input.type='text';
 input.id='property-'+name.toLowerCase().replace(/[^a-z0-9]+/g,'-');label.htmlFor=input.id;
 input.value=initial||'';
 input.addEventListener(kind==='select'?'change':'input',()=>onEdit(input.value));
 slot.append(input);row.append(label,slot);container.append(row);return input;
}
function editProperties(c,content,videoHolder,pageTitle){
 const props=el('div','page-properties');
 const year=propertyRow(props,'Year',c.year,'text',v=>{c.year=v;saveCatalogSoon();});year.placeholder='—';
 const label=propertyRow(props,'Label',c.labelId,'select',v=>{c.labelId=v;saveCatalogSoon();});
 for(const l of allLabels()){const option=el('option','',l.name);option.value=l.id;label.append(option);}label.value=c.labelId;
 const credit=propertyRow(props,'Credit / venue',c.by,'text',v=>{c.by=v;saveCatalogSoon();});credit.placeholder='—';
 const desc=propertyRow(props,'Description',c.desc,'textarea',v=>{c.desc=v;saveCatalogSoon();});desc.placeholder='Project description';
 const tags=propertyRow(props,'Keywords',c.tags,'text',v=>{c.tags=v;saveCatalogSoon();});tags.placeholder='—';
 for(const [name,key] of [['Project link','url'],['Paper link','paper'],['Video link','videoLink'],['Image URL','img']]){
  const input=propertyRow(props,name,c[key],'url',v=>{c[key]=v;saveCatalogSoon();if(key==='videoLink')videoRegion(videoHolder,c);});
  input.placeholder='Empty';input.spellcheck=false;
  input.addEventListener('change',()=>{if(key==='videoLink')videoRegion(videoHolder,c);});
 }
 content.append(props);
}
function showCollection(){
 if(activeNoteFlush){activeNoteFlush();activeNoteFlush=null;}
 if(saveTimer)saveCatalog();
 activePage=null;document.body.classList.remove('detail-mode');
 $('#detail-page').replaceChildren();render();
}
function closePage(){
 if(detailFromApp&&location.hash.startsWith('#card/'))history.back();
 else{history.replaceState({},'',location.pathname+location.search);detailFromApp=false;showCollection();}
}
function openDetail(id,navigate=true){
 const c=catalog.cards.find(x=>x.id===id);if(!c)return;
 if(activePage&&activePage!==id&&activeNoteFlush){activeNoteFlush();activeNoteFlush=null;}
 activePage=id;
 if(navigate){history.pushState({ambientPage:id},'',`#card/${encodeURIComponent(id)}`);detailFromApp=true;}
 const page=$('#detail-page');page.replaceChildren();
 const top=el('div','page-toolbar'),back=el('button','page-back','×'),crumb=el('span','page-breadcrumb','Ambient Interfaces  /  '+(c.title||'Untitled')),saveState=el('span','page-save-state','Saved');
 back.type='button';back.title='Close peek';back.setAttribute('aria-label','Close peek');back.addEventListener('click',closePage);
 const del=el('button','page-delete','Delete');del.type='button';del.title='Delete this card';
 del.addEventListener('click',async()=>{if(!confirm(`Delete "${c.title}"? Its note and images will remain in the project folder.`))return;
  if(activeNoteFlush){activeNoteFlush();activeNoteFlush=null;}
  catalog.cards=catalog.cards.filter(x=>x.id!==id);for(const d of dimensions)d.placements=d.placements.filter(x=>x.cardId!==id);saveAxesSoon();await saveCatalog();detailFromApp=false;history.replaceState({},'',location.pathname+location.search);showCollection();});
 top.append(back,crumb,saveState,del);
 const scroller=el('div','page-scroll'),content=el('div','page-content');
 const title=el('input','page-title');title.type='text';title.value=c.title;title.placeholder='Untitled project';title.setAttribute('aria-label','Project name');
 title.addEventListener('input',()=>{c.title=title.value;crumb.textContent='Ambient Interfaces  /  '+(c.title||'Untitled');saveCatalogSoon();});
 const videoHolder=el('section','page-video-section');
 const attributes=el('div','page-attribute-section');editProperties(c,attributes,videoHolder,title);
 content.append(title,attributes,videoHolder);
 videoRegion(videoHolder,c);
 activeNoteFlush=noteSectionWithHolder(c,content,saveState);
 legacyFigures(c,content);
 scroller.append(content);page.append(top,scroller);
 document.body.classList.add('detail-mode');scroller.scrollTop=0;back.focus({preventScroll:true});
}
// Preserve light inline formatting as safe structured text runs (never raw HTML).
function editorBlocks(editor){
 const blocks=[];
 function txt(value,fmt){
  if(!value)return;
  const bold=!!fmt.bold,highlight=!!fmt.highlight;
  const prev=blocks[blocks.length-1];
  if(prev?.type==='text'&&!!prev.bold===bold&&!!prev.highlight===highlight)prev.value+=value;
  else blocks.push({type:'text',value,bold,highlight});
 }
 function visit(node,fmt={bold:false,highlight:false}){
  if(node.nodeType===Node.TEXT_NODE){txt(node.textContent,fmt);return;}
  if(node.nodeType!==Node.ELEMENT_NODE||node.classList?.contains('pending-upload'))return;
  if(node.tagName==='IMG'){
   if(/^[0-9]{13}-[a-f0-9]{12}\.(png|jpg|gif)$/.test(node.dataset.file||''))blocks.push({type:'image',file:node.dataset.file});return;
  }
  if(node.tagName==='BR'){txt('\n',fmt);return;}
  const f={...fmt};
  if(['B','STRONG'].includes(node.tagName)||node.style?.fontWeight==='bold'||Number(node.style?.fontWeight)>=600)f.bold=true;
  if(node.tagName==='MARK'||node.style?.backgroundColor&&node.style.backgroundColor!=='transparent')f.highlight=true;
  if(['DIV','P'].includes(node.tagName)&&blocks.length)txt('\n',fmt);
  for(const child of node.childNodes)visit(child,f);
 }
 for(const child of editor.childNodes)visit(child);
 return blocks;
}
function fillRichEditor(editor,blocks,id){
 editor.replaceChildren();
 for(const b of blocks){
  if(b.type==='text'){
   let node=document.createTextNode(b.value||'');
   if(b.bold){const strong=el('strong');strong.append(node);node=strong;}
   if(b.highlight){const mark=el('mark');mark.append(node);node=mark;}
   editor.append(node);
  }else if(b.type==='image'&&id){const image=el('img');image.src=noteImageUrl(id,b.file);image.dataset.file=b.file;image.alt='Note image';image.contentEditable='false';editor.append(image);}
 }
}
function fillEditor(editor,id){fillRichEditor(editor,noteBlocks(id),id);}
function selectedRichEditor(){
 const selection=window.getSelection();if(!selection||!selection.rangeCount||selection.isCollapsed)return null;
 let node=selection.getRangeAt(0).commonAncestorContainer;
 if(node.nodeType!==Node.ELEMENT_NODE)node=node.parentElement;
 const editor=node?.closest?.('.rich-editor');
 return editor?.isContentEditable?editor:null;
}
function formatSelection(kind){
 const editor=selectedRichEditor();if(!editor)return;
 if(kind==='bold')document.execCommand('bold',false,null);
 else{
  const sel=window.getSelection(),range=sel.getRangeAt(0);
  const ancestor=range.commonAncestorContainer.nodeType===Node.ELEMENT_NODE?range.commonAncestorContainer:range.commonAncestorContainer.parentElement;
  const existing=ancestor?.closest?.('mark');
  if(existing&&editor.contains(existing)&&existing.textContent===sel.toString()){
   while(existing.firstChild)existing.parentNode.insertBefore(existing.firstChild,existing);existing.remove();
  }else{
   const mark=el('mark');mark.append(range.extractContents());range.insertNode(mark);
   const r=document.createRange();r.selectNodeContents(mark);sel.removeAllRanges();sel.addRange(r);
  }
 }
 editor.dispatchEvent(new Event('input',{bubbles:true}));positionSelectionToolbar();
}
function positionSelectionToolbar(){
 const bar=$('#selection-toolbar');if(!bar)return;
 const editor=selectedRichEditor(),sel=window.getSelection();if(!editor||!sel?.toString().trim()) {bar.hidden=true;return;}
 const rect=sel.getRangeAt(0).getBoundingClientRect();if(!rect.width&&!rect.height){bar.hidden=true;return;}
 bar.hidden=false;
 const w=bar.offsetWidth||112;
 bar.style.left=Math.max(8,Math.min(window.innerWidth-w-8,rect.left+rect.width/2-w/2))+'px';
 bar.style.top=Math.max(8,rect.top-46)+'px';
}
function initializeRichToolbar(){
 const bar=$('#selection-toolbar');bar.replaceChildren();
 for(const [label,kind,title] of [['B','bold','Bold'],['▰','highlight','Highlight']]){
  const b=el('button','rich-button '+kind,label);b.type='button';b.title=title;
  b.addEventListener('mousedown',e=>e.preventDefault());
  b.addEventListener('click',()=>formatSelection(kind));bar.append(b);
 }
 document.addEventListener('selectionchange',positionSelectionToolbar);
 window.addEventListener('scroll',positionSelectionToolbar,true);
 window.addEventListener('resize',positionSelectionToolbar);
}
function insertAtCursor(editor,node){editor.focus();const selection=window.getSelection();const range=document.createRange();if(selection.rangeCount&&editor.contains(selection.anchorNode)){const s=selection.getRangeAt(0);range.setStart(s.startContainer,s.startOffset);range.collapse(true);}else{range.selectNodeContents(editor);range.collapse(false);}range.deleteContents();range.insertNode(node);range.setStartAfter(node);range.collapse(true);selection.removeAllRanges();selection.addRange(range);}
const noteQueues=new Map();function saveNote(id,blocks,status){status.textContent='Saving...';const previous=noteQueues.get(id)||Promise.resolve();const task=previous.catch(()=>{}).then(()=>dataJSON('api/notes/'+id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({blocks})}));noteQueues.set(id,task);task.then(()=>{if(noteQueues.get(id)===task)status.textContent='Saved';}).catch(e=>{status.textContent='Save failed';toast(e.message);});return task;}
function legacyFigures(c,body){
 const list=figures[c.id]||[];if(!list.length)return;
 const sec=el('div','section-divider'),heading=el('h3','note-title','Previously uploaded figures'),grid=el('div','legacy-figures');
 for(const image of list){const im=el('img');im.src=image.url;im.title='Open image';im.addEventListener('click',()=>window.open(image.url,'_blank','noopener'));grid.append(im);}
 body.append(sec,heading,grid);
}
function noteSectionWithHolder(c,body,saveState){
 const section=el('section','page-note-section'),head=el('div','page-note-head'),heading=el('h2','page-note-title','Note');head.append(heading);
 const editor=el('div','page-note-editor rich-editor');editor.contentEditable='true';editor.setAttribute('role','textbox');
 editor.dataset.placeholder='Write notes or paste PNG / JPEG / GIF…';editor.setAttribute('aria-label','Note for '+c.title);
 fillEditor(editor,c.id);
 const foot=el('div','note-bottom'),status=el('span','status','Saved');
 foot.append(status);section.append(head,editor,foot);body.append(section);
 let timer=0;
 const persist=()=>{clearTimeout(timer);timer=0;const blocks=editorBlocks(editor);notes.set(c.id,blocks);saveState.textContent='Saving…';
  const pending=saveNote(c.id,blocks,status);pending.then(()=>{if(activePage===c.id)saveState.textContent='Saved';}).catch(()=>{if(activePage===c.id)saveState.textContent='Save failed';});
 };
 const sync=()=>{const blocks=editorBlocks(editor);notes.set(c.id,blocks);saveState.textContent='Unsaved';clearTimeout(timer);timer=setTimeout(persist,400);};
 editor.addEventListener('input',sync);editor.addEventListener('blur',()=>{if(timer)persist();});
 // Images remain normal inline editor nodes; this covers browsers that do not
 // delete a contenteditable=false IMG with Backspace/Delete at the adjacent caret.
 editor.addEventListener('keydown',event=>{
  if(event.key!=='Backspace'&&event.key!=='Delete')return;
  const selection=window.getSelection();if(!selection||!selection.rangeCount||!selection.isCollapsed||!editor.contains(selection.anchorNode))return;
  const r=selection.getRangeAt(0),node=r.startContainer,offset=r.startOffset;
  let adjacent=null;
  if(node.nodeType===Node.ELEMENT_NODE){adjacent=event.key==='Backspace'?node.childNodes[offset-1]:node.childNodes[offset];}
  else if(node.nodeType===Node.TEXT_NODE){
   if(event.key==='Backspace'&&offset===0)adjacent=node.previousSibling;
   if(event.key==='Delete'&&offset===node.textContent.length)adjacent=node.nextSibling;
  }
  if(adjacent?.tagName==='IMG'&&adjacent.dataset.file){
   event.preventDefault();const parent=adjacent.parentNode,at=[...parent.childNodes].indexOf(adjacent);
   adjacent.remove();const after=document.createRange();after.setStart(parent,Math.min(at,parent.childNodes.length));after.collapse(true);
   selection.removeAllRanges();selection.addRange(after);sync();
  }
 });
 async function uploadImage(blob){
  if(!blob||!MEDIA_TYPES.has(blob.type)){toast('PNG / JPEG / GIF only');return;}
  const pending=el('span','pending-upload','Uploading…');pending.contentEditable='false';insertAtCursor(editor,pending);
  try{const r=await dataJSON('api/note-image/'+c.id,{method:'POST',headers:{'Content-Type':blob.type},body:blob});
   const image=el('img');image.src=r.url;image.dataset.file=r.file;image.alt='Pasted note image';image.contentEditable='false';
   pending.replaceWith(image);sync();
  }catch(e){pending.remove();toast(e.message);}
 }
 editor.addEventListener('paste',event=>{
  const imgs=[...(event.clipboardData?.items||[])].filter(x=>x.kind==='file').map(x=>x.getAsFile()).filter(Boolean);
  event.preventDefault();
  if(imgs.some(x=>MEDIA_TYPES.has(x.type))){imgs.filter(x=>MEDIA_TYPES.has(x.type)).forEach(uploadImage);return;}
  const text=event.clipboardData?.getData('text/plain')||'';if(text){insertAtCursor(editor,document.createTextNode(text));sync();}
 });
 editor.addEventListener('dragover',event=>{if(event.dataTransfer.types.includes('Files'))event.preventDefault();});
 editor.addEventListener('drop',event=>{if(event.dataTransfer.files.length){event.preventDefault();[...event.dataTransfer.files].forEach(uploadImage);}});
 return()=>{if(timer)persist();};
}
// Offline agent workflow: copy a schema-rich prompt, paste JSON, preview and import.
function agentPrompt(){
 const names=catalog.labels.map(l=>l.name).join(', ');
 return `Research projects or papers relevant to this ambient interfaces dashboard and return ONLY valid JSON (no commentary, no Markdown fences). Format:
{"cards":[{"title":"Project name","year":"2024","label":"${catalog.labels[0]?.name||'Origins'}","desc":"One or two concise, grounded sentences in Chinese or English","by":"Authors / venue","url":"https://project.example","paper":"https://paper.example","videoLink":"https://youtube.com/watch?v=...","img":"https://original-project-image.example/file.jpg","tags":"keywords","note":"Optional research note"}]}
Existing labels: ${names}. Use one of these labels if applicable, or a concise new label name. Include only actual verifiable links, otherwise use empty strings. Do not hallucinate image or video URLs. Return 1 or more cards, with these exact keys. No extra wrappers.`;
}
function parseAgentCards(raw){
 let value=raw.trim();const fenced=value.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);if(fenced)value=fenced[1];
 const input=JSON.parse(value);const batch=Array.isArray(input)?input:Array.isArray(input?.cards)?input.cards:input&&typeof input==='object'&&input.title?[input]:null;
 if(!batch||!batch.length||batch.length>100)throw new Error('Expected a JSON object with a cards array (1–100 entries).');
 const safe=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
 const safeLink=v=>{const candidate=safe(v,2000);try{if(candidate&& !['http:','https:'].includes(new URL(candidate).protocol))return '';}catch{return '';}return candidate;};
 return batch.map((item,i)=>{
  if(!item||typeof item!=='object'||Array.isArray(item)||!safe(item.title,250))throw new Error('Card '+(i+1)+' needs a project title.');
  const label=safe(item.label||item.labelId||'',64);
  const links=['url','paper','videoLink','img'];const c={title:safe(item.title,250),year:safe(item.year,80),by:safe(item.by,300),desc:safe(item.desc||item.description,10000),tags:safe(item.tags,2000),url:'',paper:'',videoLink:'',img:'',label,note:safe(item.note,100000)};
  for(const k of links)c[k]=safeLink(item[k]);
  return c;
 });
}
function agentAdd(){
 const dialog=el('dialog','dialog agent-dialog'),head=el('div','dialog-head'),h=el('h2','','Agent Add'),close=el('button','dialog-close','×');close.type='button';head.append(h,close);
 const body=el('div','dialog-body'),instruction=el('p','agent-help','Copy the prompt into your coding / research agent. Paste its JSON response below to create one or more cards.');
 const copy=el('button','subtle','Copy agent prompt');copy.type='button';copy.addEventListener('click',async()=>{const prompt=agentPrompt();try{await navigator.clipboard.writeText(prompt);toast('Prompt copied');}catch{promptBox.hidden=false;promptBox.value=prompt;promptBox.select();toast('Select and copy the prompt');}});
 const promptBox=el('textarea','agent-prompt');promptBox.readOnly=true;promptBox.hidden=true;promptBox.value=agentPrompt();
 const textarea=el('textarea','agent-json');textarea.placeholder='Paste agent JSON here…';textarea.setAttribute('aria-label','Agent JSON response');textarea.spellcheck=false;
 const status=el('div','agent-preview','Paste JSON to preview the import.');const actions=el('div','agent-actions'),importButton=el('button','primary','Import cards');importButton.type='button';importButton.disabled=true;
 let parsed=[];
 const preview=()=>{parsed=[];importButton.disabled=true;const raw=textarea.value.trim();if(!raw){status.textContent='Paste JSON to preview the import.';return;}
  try{parsed=parseAgentCards(raw);const duplicates=parsed.filter(x=>catalog.cards.some(c=>c.title.trim().toLowerCase()===x.title.toLowerCase()&&String(c.year)===String(x.year)));
   status.textContent=`${parsed.length} card(s) ready. ${duplicates.length} possible duplicate(s) (matching name and year).`;
   importButton.disabled=false;
  }catch(e){status.textContent='Invalid JSON: '+e.message;}
 };
 textarea.addEventListener('input',preview);
 importButton.addEventListener('click',async()=>{
  if(!parsed.length)return;
  const duplicates=parsed.filter(x=>catalog.cards.some(c=>c.title.trim().toLowerCase()===x.title.toLowerCase()&&String(c.year)===String(x.year)));
  if(duplicates.length&&!confirm(`${duplicates.length} card(s) have an existing title and year. Import anyway?`))return;
  importButton.disabled=true;const used=new Set(catalog.cards.map(c=>c.id));let order=Math.max(0,...catalog.cards.map(c=>c.order));const added=[];
  for(const item of parsed){let lab=catalog.labels.find(l=>l.id===item.label||l.name.toLowerCase()===item.label.toLowerCase());
   if(!lab&&item.label){let lid;do{lid='l'+Math.random().toString(36).slice(2,11);}while(catalog.labels.some(l=>l.id===lid));lab={id:lid,name:item.label,color:'#d6dce4',note:''};catalog.labels.push(lab);}
   let id;do{id='c'+Date.now().toString(36)+Math.random().toString(36).slice(2,9);}while(used.has(id));used.add(id);
   const card={id,title:item.title,year:item.year,by:item.by,desc:item.desc,tags:item.tags,url:item.url,paper:item.paper,videoLink:item.videoLink,img:item.img,labelId:lab?.id||'',mode:'contain',order:++order};
   catalog.cards.push(card);added.push({card,note:item.note});
  }
  try{await saveCatalog();for(const item of added){if(!item.note)continue;const blocks=[{type:'text',value:item.note}];await dataJSON('api/notes/'+item.card.id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({blocks})});notes.set(item.card.id,blocks);}
   dialog.close();render();toast(`Imported ${added.length} cards`);
  }catch(e){render();status.textContent='Save failed: '+e.message;importButton.disabled=false;}
 });
 actions.append(importButton);body.append(instruction,copy,promptBox,textarea,status,actions);dialog.append(head,body);document.body.append(dialog);
 close.addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>dialog.remove());dialog.showModal();
}
function addCard(labelId){let id;do{id='c'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);}while(catalog.cards.some(x=>x.id===id));const c={id,title:'Untitled project',year:'',by:'',desc:'',tags:'',img:'',mode:'contain',url:'',paper:'',videoLink:'',labelId:labelId??(filter==='all'?catalog.labels[0]?.id||'':filter),order:Math.max(0,...catalog.cards.map(x=>x.order))+1};catalog.cards.push(c);saveCatalog();render();openDetail(id);}
const LABEL_PALETTE=['#9caac1','#6b8da6','#83a6a1','#85a17b','#d1a96c','#c48e88','#b392ae','#9a9da6'];
let dismissLabelMenu=null;
function manageLabels(event){
 // Click toggles one popover; the rest of the page stays usable.
 if(dismissLabelMenu){dismissLabelMenu();return;}
 const anchor=event?.currentTarget instanceof Element?event.currentTarget:$('#manage-labels');
 const menu=el('div','label-menu');menu.id='label-menu';menu.setAttribute('role','dialog');menu.setAttribute('aria-label','Manage labels');
 document.body.append(menu);
 let editing=null,focusNew=false;
 const position=()=>{
  const rect=anchor.getBoundingClientRect();
  const width=menu.offsetWidth||328, height=menu.offsetHeight||260;
  const left=Math.max(10,Math.min(window.innerWidth-width-10,rect.left));
  let top=rect.bottom+7;
  if(top+height>window.innerHeight-10&&rect.top>=height+8)top=rect.top-height-7;
  else top=Math.max(10,Math.min(window.innerHeight-height-10,top));
  menu.style.left=left+'px';menu.style.top=top+'px';
 };
 function dismiss(){menu.remove();document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',onKey,true);window.removeEventListener('resize',position);window.removeEventListener('scroll',onScroll,true);dismissLabelMenu=null;}
 dismissLabelMenu=dismiss;
 const outside=e=>{if(!menu.contains(e.target)&&e.target!==anchor&&!anchor.contains(e.target))dismiss();};
 const onKey=e=>{if(e.key==='Escape'){e.stopPropagation();if(editing){editing=null;draw();}else dismiss();}};
 const onScroll=e=>{if(!menu.contains(e.target))dismiss();};
 document.addEventListener('pointerdown',outside,true);document.addEventListener('keydown',onKey,true);
 window.addEventListener('resize',position);window.addEventListener('scroll',onScroll,true);
 function updated(){saveCatalogSoon();render();}
 function rename(label,name,error){const next=name.trim();if(!next){error.textContent='Name cannot be empty';return false;}
  if(catalog.labels.some(l=>l!==label&&l.name.toLowerCase()===next.toLowerCase())){error.textContent='Label already exists';return false;}
  label.name=next;error.textContent='';updated();return true;
 }
 function draw(){
  menu.replaceChildren();const top=el('div','label-menu-header');
  if(editing){const back=el('button','label-menu-icon','‹');back.type='button';back.title='All labels';back.addEventListener('click',()=>{editing=null;draw();});top.append(back);}
  top.append(el('strong','',editing?'Edit label':'Labels'));
  const close=el('button','label-menu-icon','×');close.type='button';close.title='Close';close.addEventListener('click',dismiss);top.append(close);menu.append(top);
  if(!editing){
   const list=el('div','label-menu-list');
   for(const label of catalog.labels){const btn=el('button','label-menu-item');btn.type='button';btn.title='Edit '+label.name;
    const dot=el('span','label-menu-dot');dot.style.background=label.color;
    btn.append(dot,el('span','label-menu-label',label.name),el('span','label-menu-count',String(catalog.cards.filter(c=>c.labelId===label.id).length)),el('span','label-menu-chevron','›'));
    btn.addEventListener('click',()=>{editing=label;draw();});list.append(btn);
   }
   menu.append(list);const create=el('button','label-menu-create','+ New label');create.type='button';create.addEventListener('click',()=>{
    const label={id:'',name:'New label',color:LABEL_PALETTE[catalog.labels.length%LABEL_PALETTE.length],note:'',noteRich:[]};
    do{label.id='l'+Math.random().toString(36).slice(2,11);}while(catalog.labels.some(l=>l.id===label.id));
    let n=1;while(catalog.labels.some(l=>l.name.toLowerCase()===label.name.toLowerCase()))label.name='New label '+(++n);
    catalog.labels.push(label);updated();editing=label;focusNew=true;draw();
   });menu.append(create);
  }else{
   const label=editing,editor=el('div','label-menu-edit');
   const field=el('label','label-menu-field');field.append(el('span','','Name'));
   const name=el('input');name.type='text';name.value=label.name;name.maxLength=64;field.append(name);editor.append(field);
   const error=el('div','label-menu-error');
   name.addEventListener('change',()=>rename(label,name.value,error));
   name.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();if(rename(label,name.value,error))name.blur();}});
   const palette=el('div','label-menu-palette');palette.setAttribute('aria-label','Label color');
   for(const c of LABEL_PALETTE){const swatch=el('button','label-color-swatch');swatch.type='button';swatch.style.setProperty('--swatch-color',c);swatch.title=c;swatch.setAttribute('aria-label','Set color '+c);swatch.setAttribute('aria-pressed',label.color.toLowerCase()===c);
    swatch.addEventListener('click',()=>{label.color=c;updated();draw();});palette.append(swatch);}
   editor.append(el('span','', 'Color'),palette);
   const custom=el('label','label-menu-custom','Custom color');const picker=el('input');picker.type='color';picker.value=label.color;picker.addEventListener('input',()=>{label.color=picker.value;updated();palette.querySelectorAll('button').forEach(btn=>btn.setAttribute('aria-pressed',btn.title===picker.value));});custom.append(picker);editor.append(custom);
   const controls=el('div','label-menu-controls');
   for(const [labelText,dir] of [['↑ Move up',-1],['↓ Move down',1]]){const btn=el('button','',labelText);btn.type='button';const index=catalog.labels.indexOf(label);btn.disabled=index+dir<0||index+dir>=catalog.labels.length;
    btn.addEventListener('click',()=>{const at=catalog.labels.indexOf(label);if(at<0||at+dir<0||at+dir>=catalog.labels.length)return;catalog.labels.splice(at,1);catalog.labels.splice(at+dir,0,label);updated();draw();});controls.append(btn);}
   editor.append(controls,error);
   const actions=el('div','label-menu-actions');const del=el('button','label-menu-danger','Delete label');del.type='button';del.addEventListener('click',()=>{
    const count=catalog.cards.filter(c=>c.labelId===label.id).length;
    if(!confirm(`Delete “${label.name}”? ${count} card(s) will move to Unlabeled.`))return;
    catalog.labels=catalog.labels.filter(l=>l!==label);for(const c of catalog.cards)if(c.labelId===label.id)c.labelId='';if(filter===label.id)filter='all';updated();editing=null;draw();
   });
   const done=el('button','label-menu-done','Done');done.type='button';done.addEventListener('click',()=>{if(!rename(label,name.value,error))return;editing=null;draw();});actions.append(del,done);editor.append(actions);menu.append(editor);
   if(focusNew){focusNew=false;name.focus();name.select();}
  }
  position();
 }
 draw();
}
async function staticJSON(url,fallback){try{const r=await fetch(url,{cache:'no-store'});if(!r.ok)return fallback;return await r.json();}catch{return fallback;}}
// Live mode: node server.js provides /api. Static mode (GitHub Pages or any plain file server): read the JSON files, read-only.
async function loadData(){
 try{
  const probe=await fetch('api/settings',{cache:'no-store'});
  if(probe.ok&&(probe.headers.get('content-type')||'').includes('json')){
   const settings=await probe.json();
   const [data,allNotes,figData,axisData]=await Promise.all([dataJSON('api/catalog'),dataJSON('api/notes'),dataJSON('api/figures'),dataJSON('api/axes')]);
   return {data,settings,allNotes,figData,axisData};
  }
 }catch{}
 RO=true;document.body.classList.add('readonly');lockEditing();
 const saved=await staticJSON('catalog.json',null);
 const data=saved||await staticJSON('catalog.defaults.json',{version:1,labels:[],cards:[]});
 const [settings,axisData]=await Promise.all([staticJSON('settings.json',{}),staticJSON('axes.json',{dimensions:[]})]);
 const notesObj={};
 if(saved)await Promise.all(data.cards.map(async c=>{const v=await staticJSON('notes/'+encodeURIComponent(c.id)+'.json',null);if(v&&Array.isArray(v.blocks))notesObj[c.id]=v.blocks;}));
 return {data,settings,allNotes:{notes:notesObj},figData:{items:{}},axisData};
}
function lockEditing(){
 const lock=()=>{
  document.querySelectorAll('#main [contenteditable="true"],#detail-page [contenteditable="true"]').forEach(n=>n.setAttribute('contenteditable','false'));
  document.querySelectorAll('#main input,#main textarea,#main select,#detail-page input,#detail-page textarea,#detail-page select').forEach(n=>{if(n.type==='checkbox')return;n.readOnly=true;if(n.tagName==='SELECT')n.disabled=true;});
  document.querySelectorAll('#main [draggable="true"]').forEach(n=>{n.draggable=false;});
 };
 new MutationObserver(lock).observe(document.body,{childList:true,subtree:true});lock();
}
async function init(){try{
 const {data,settings,allNotes,figData,axisData}=await loadData();catalog=data;dimensions=axisData.dimensions||[];viewFields={};for(const kind of ['gallery','board','axis'])viewFields[kind]={...FIELD_DEFAULTS[kind],...(settings.viewFields?.[kind]||{})};for(const [id,blocks] of Object.entries(allNotes.notes||{}))notes.set(id,blocks);figures=figData.items||{};
 view=['gallery','board','axis'].includes(settings.view)?settings.view:'gallery';cardWidth=Number.isInteger(settings.cardWidth)?settings.cardWidth:210;
 $('#view-gallery').classList.toggle('active',view==='gallery');$('#view-board').classList.toggle('active',view==='board');$('#view-axis').classList.toggle('active',view==='axis');$('#filters').hidden=view==='axis';
 document.documentElement.style.setProperty('--card-width',cardWidth+'px');$('#size-slider').value=cardWidth;$('#size-value').textContent=cardWidth;
 $('#view-gallery').addEventListener('click',()=>setView('gallery'));$('#view-board').addEventListener('click',()=>setView('board'));$('#view-axis').addEventListener('click',()=>setView('axis'));$('#card-properties').addEventListener('click',cardProperties);
 $('#search').addEventListener('input',e=>{search=e.target.value;render();});initializeRichToolbar();$('#peek-backdrop').addEventListener('click',closePage);document.addEventListener('keydown',e=>{if(e.key==='Escape'&&activePage&&!$('#label-menu'))closePage();});$('#manage-labels').addEventListener('click',manageLabels);$('#agent-add').addEventListener('click',agentAdd);$('#add-card').addEventListener('click',()=>addCard());$('#size-slider').addEventListener('input',e=>{setSize(e.target.value);if(view==='axis')render();});window.addEventListener('resize',()=>{if(view==='axis')for(const stage of document.querySelectorAll('.axis-stage'))layoutAxisStage(stage);});
 render();
 const route=()=>{const match=location.hash.match(/^#card\/([a-z0-9-]+)$/);
  if(match&&catalog.cards.some(c=>c.id===match[1]))openDetail(match[1],false);
  else if(activePage)showCollection();
 };
 window.addEventListener('popstate',()=>{detailFromApp=false;route();});route();
 }catch(e){console.error(e);$('#main').replaceChildren(el('div','empty','Could not load local project. '+e.message));}}
init();
