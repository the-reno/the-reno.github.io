'use strict';
const $ = (selector,root=document) => root.querySelector(selector);
const $$ = (selector,root=document) => Array.from(root.querySelectorAll(selector));
const esc = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const arrow = '<svg class="icon" aria-hidden="true"><use href="#i-arrow"/></svg>';
let storedView='grid';
try{storedView=localStorage.getItem('ronu-layout-view')==='list'?'list':'grid';}catch{/* Storage is optional. */}
let state={section:'all',type:'all',query:'',view:storedView};
let currentTopic=null,lastBrowseHash='#explore',observer=null,scrollTick=false;
const searchDialog=$('#search-dialog'),aboutDialog=$('#about-dialog');
function browseHash(){
 if(state.section==='all')return '#explore';
 const p=new URLSearchParams();
 if(state.type!=='all')p.set('format',state.type);
 if(state.query)p.set('q',state.query);
 if(state.view==='list')p.set('view','list');
 return '#section/'+state.section+(p.size?'?'+p.toString():'');
}
function updateBrowseUrl(){
 lastBrowseHash=browseHash();
 try{history.replaceState(null,'',lastBrowseHash);}catch{/* Filtering works without history access. */}
}
function matchTopics(topics,query){
 const words=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
 return topics.filter(t=>words.every(w=>(t.title+' '+t.description+' '+SECTIONS[t.section].name+' '+t.type+' '+(t.tags||'')).toLocaleLowerCase().includes(w)));
}
function renderPerspective(){
 const panel=$('#section-perspective'),section=SECTIONS[state.section];
 panel.hidden=state.section==='all';
 if(panel.hidden){panel.replaceChildren();return;}
 panel.innerHTML=`<div class="perspective-heading"><p class="eyebrow">Why I explore it</p><h2 id="perspective-title">${esc(section.question)}</h2></div><div class="perspective-copy">${section.perspective.map(text=>`<p>${esc(text)}</p>`).join('')}</div>`;
}
function card(topic){
 const s=SECTIONS[topic.section];
 return `<a class="topic-card" href="#topic/${topic.id}" aria-labelledby="title-${topic.id}"><div class="card-art">${artSvg(topic.art)}<span class="card-section-number">${s.number} / EXPLORE</span></div><div class="card-content"><div class="card-meta"><span class="eyebrow">${s.name}</span><span class="card-type">${topic.type}</span></div><h3 class="card-title" id="title-${topic.id}">${esc(topic.title)}</h3><p class="card-description">${esc(topic.description)}</p><div class="card-bottom"><span>${esc(topic.status||(topic.type==='Interactive'?'Open experiment':'Read article'))}</span>${arrow}</div></div></a>`;
}
function renderLibrary(){
 FeaturedCarousel.sync(state);
 const library=$('#library'),grid=$('#topic-grid');
 library.hidden=state.section==='all';
 // The homepage contains only section introductions, never an all-article feed.
 if(library.hidden){grid.replaceChildren();$('#topic-count').textContent='';return;}
 const sectionTopics=TOPICS.filter(t=>t.section===state.section);
 const topics=matchTopics(sectionTopics.filter(t=>state.type==='all'||t.type===state.type),state.query);
 grid.innerHTML=topics.map(card).join('');
 grid.classList.toggle('is-list',state.view==='list');
 $('#empty-state').hidden=topics.length!==0;
 $('#topic-count').textContent=topics.length+' '+(topics.length===1?'topic':'topics');
 $$('.filter-button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.type===state.type)));
 $('#grid-view').setAttribute('aria-pressed',String(state.view==='grid'));
 $('#list-view').setAttribute('aria-pressed',String(state.view==='list'));
 $('#topic-filter').value=state.query;
 const sectionEmpty=sectionTopics.length===0;
 $('.browse-tools').hidden=sectionEmpty;
 $('#library-intro').hidden=sectionEmpty;
 $('#empty-state').innerHTML=sectionEmpty
  ?`<div class="no-content"><h3>Nothing published here yet.</h3><p>${esc(SECTIONS[state.section].empty||'No articles or experiments are listed here yet.')}</p><a href="#explore">Back to the sections →</a></div>`
  :'<h3>No topics found.</h3><p>Try another word or reset the filters.</p><button class="small-cta" type="button" id="clear-filters">Clear filters</button>';
 if(!sectionEmpty)$('#clear-filters').addEventListener('click',clearFilters);
}
function renderBrowse(){
 stopArticle();
 // Unmount models when leaving a reader so they cannot continue running unseen.
 $('#reader-page').replaceChildren();
 if(observer){observer.disconnect();observer=null;}
 currentTopic=null;
 const s=SECTIONS[state.section];
 $('#browse-page').hidden=false;
 $('#browse-page').dataset.view=state.section==='all'?'explore':'section';
 $('#reader-page').hidden=true;
 $('#reading-progress').hidden=true;
 $('#page-title').innerHTML=s.headline;
 $('#intro-description').innerHTML=s.description;
 $('#intro-note').textContent=s.note;
 $('#intro-eyebrow').innerHTML='<span class="tiny-dot"></span>'+s.eyebrow;
 $('#library-title').textContent='Articles & experiments';
 $('#library-intro').textContent='Explore the questions further through the work below.';
 $$('.nav a').forEach(a=>a.dataset.section===state.section?a.setAttribute('aria-current','page'):a.removeAttribute('aria-current'));
 document.title='Ronu.one — '+s.name;
 renderPerspective();renderLibrary();lastBrowseHash=browseHash();
}
function navigate(){
 if(searchDialog.open)searchDialog.close();
 if(aboutDialog.open)aboutDialog.close();
 const hash=location.hash||'#explore';
 if(hash==='#main'){$('#main').focus();return;}
 const parts=hash.slice(1).split('?'),path=parts[0],params=new URLSearchParams(parts[1]||'');
 if(path.startsWith('topic/')){
  const [,id,anchor]=path.split('/'),topic=TOPICS.find(t=>t.id===id);
  if(topic){
   FeaturedCarousel.suspend();
   if(!currentTopic||currentTopic.id!==id){
    // Deep links and global search still return readers to the relevant section.
    if(lastBrowseHash.split('?')[0]!=='#section/'+topic.section)lastBrowseHash='#section/'+topic.section;
    renderReader(topic);
    const back=$('.reader-top .quiet-link');
    back.innerHTML='<svg class="icon" aria-hidden="true"><use href="#i-back"/></svg>Back to '+esc(SECTIONS[topic.section].name);
    window.scrollTo({top:0,behavior:'instant'});
    $('#reader-title').focus({preventScroll:true});
   }
   if(anchor&&/^(part-\d+|article-start|experiment)$/.test(anchor))goAnchor(anchor);
   return;
  }
 }
 const proposed=path.startsWith('section/')?path.split('/')[1]:'all';
 state.section=Object.hasOwn(SECTIONS,proposed)?proposed:'all';
 state.type=state.section!=='all'&&['Article','Interactive','Project'].includes(params.get('format'))?params.get('format'):'all';
 state.query=state.section==='all'?'':params.get('q')||'';
 state.view=params.get('view')==='list'?'list':storedView;
 renderBrowse();
 window.scrollTo({top:0,behavior:'instant'});
 // Keep keyboard focus on the new page rather than an inactive carousel slide.
 $('#page-title').focus({preventScroll:true});
}
function updateProgress(){
 if(!currentTopic)return;
 const max=document.documentElement.scrollHeight-window.innerHeight;
 $('#reading-progress span').style.width=(max>0?Math.min(100,Math.max(0,window.scrollY/max*100)):100)+'%';
}
function renderSearch(){
 const q=$('#global-search').value.trim(),words=q.toLocaleLowerCase().split(/\s+/).filter(Boolean);
 const sections=FEATURED_SECTIONS.filter(s=>words.every(w=>(s.title+' '+s.description+' '+SECTIONS[s.section].note).toLocaleLowerCase().includes(w)));
 const topics=q?matchTopics(TOPICS,q):[];
 const sectionResults=sections.map(s=>`<a class="search-result" href="#section/${s.section}"><span class="result-symbol"><svg class="icon" aria-hidden="true"><use href="#i-${s.section}"/></svg></span><span class="result-copy"><strong>${esc(s.title)}</strong><span>Perspective · Articles · Experiments</span></span>${arrow}</a>`).join('');
 const articleResults=topics.map(t=>`<a class="search-result" href="#topic/${t.id}"><span class="result-symbol"><svg class="icon" aria-hidden="true"><use href="#i-${t.section}"/></svg></span><span class="result-copy"><strong>${esc(t.title)}</strong><span>${SECTIONS[t.section].name} · ${t.type}</span></span>${arrow}</a>`).join('');
 $('#search-results').innerHTML=(sectionResults?'<p class="search-group-title">Sections</p>'+sectionResults:'')+(articleResults?'<p class="search-group-title">Articles & experiments</p>'+articleResults:'')||'<div class="search-no-results">No results found. Try a different word.</div>';
 $('#search-result-count').textContent=q?(sections.length+topics.length)+' results':'Choose a section or search for a topic';
}
function openSearch(){if(aboutDialog.open)aboutDialog.close();$('#global-search').value='';renderSearch();searchDialog.showModal();$('#global-search').focus();}
function openAbout(){if(searchDialog.open)searchDialog.close();aboutDialog.showModal();}
$('#search-open').addEventListener('click',openSearch);
$('#search-close').addEventListener('click',()=>searchDialog.close());
$('#global-search').addEventListener('input',renderSearch);
$('#search-results').addEventListener('click',e=>{if(e.target.closest('a'))searchDialog.close();});
$('#about-open').addEventListener('click',openAbout);
$('#design-notes-open').addEventListener('click',openAbout);
$('#about-close').addEventListener('click',()=>aboutDialog.close());
[searchDialog,aboutDialog].forEach(d=>d.addEventListener('click',e=>{
 const r=d.getBoundingClientRect();
 if(e.target===d&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))d.close();
}));
document.addEventListener('keydown',e=>{
 if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!document.activeElement.isContentEditable){e.preventDefault();if(!searchDialog.open)openSearch();}
 if(e.key==='Escape'){
  if(searchDialog.open){e.preventDefault();searchDialog.close();}
  if(aboutDialog.open){e.preventDefault();aboutDialog.close();}
  if($('#original-app')?.classList.contains('is-expanded')){
   $('#original-app').classList.remove('is-expanded');
   $('#expand-app').textContent='Expand';$('#expand-app').setAttribute('aria-pressed','false');$('#expand-app').focus();
  }
 }
});
$('#topic-filter').addEventListener('input',e=>{state.query=e.target.value;renderLibrary();updateBrowseUrl();});
$$('.filter-button').forEach(b=>b.addEventListener('click',()=>{state.type=b.dataset.type;renderLibrary();updateBrowseUrl();}));
function clearFilters(){state.type='all';state.query='';renderLibrary();updateBrowseUrl();$('#topic-filter').focus();}
function changeView(view){state.view=view;storedView=view;try{localStorage.setItem('ronu-layout-view',view);}catch{}renderLibrary();updateBrowseUrl();}
$('#grid-view').addEventListener('click',()=>changeView('grid'));
$('#list-view').addEventListener('click',()=>changeView('list'));
window.addEventListener('hashchange',navigate);
window.addEventListener('scroll',()=>{if(!scrollTick){requestAnimationFrame(()=>{updateProgress();scrollTick=false;});scrollTick=true;}},{passive:true});
window.addEventListener('resize',updateProgress);
navigate();
