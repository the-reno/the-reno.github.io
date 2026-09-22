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
function renderLibrary(){
 FeaturedCarousel.sync(state);
 const library=$('#library');
 library.hidden=state.section==='all'||state.section==='maker';
 $('#topic-grid').innerHTML=library.hidden?'':mainArticleCard(state.section);
 $('#topic-count').textContent=state.section==='markets'?'Layout sample':'01 article';
}
function renderBrowse(){
 stopArticle();
 // Unmount models when leaving a reader so they cannot continue running unseen.
 $('#reader-page').replaceChildren();
 if(observer){observer.disconnect();observer=null;}
 currentTopic=null;
 const s=SECTIONS[state.section],home=state.section==='all';
 document.body.dataset.pageMode='landing';
 $('#browse-page').hidden=false;
 $('#browse-page').dataset.view=home?'explore':'section';
 $('#reader-page').hidden=true;
 $('#reading-progress').hidden=true;
 const intro=$('#page-intro');
 intro.className=home?'explore-intro':'index-hero';
 intro.innerHTML=home?'<div><p class="eyebrow">A personal lab</p><h1 class="explore-title" id="page-title" tabindex="-1">Stay <em>curious.</em></h1></div><p class="explore-description">Welcome to my lab.<br>Ideas to explore. Models to test. Things to build.</p>':mainHero(state.section);
 $('#library-title').textContent='Articles & experiments';
 $$('.nav a').forEach(a=>a.dataset.section===state.section?a.setAttribute('aria-current','page'):a.removeAttribute('aria-current'));
 document.title='Ronu.one — '+s.name;
 renderLibrary();lastBrowseHash=browseHash();
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
   document.body.dataset.pageMode='reader';
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
 // Main pages intentionally show one representative card; older filter URLs remain safe.
 state.type='all';state.query='';state.view='grid';
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
 const sections=FEATURED_SECTIONS.filter(s=>words.every(w=>(s.title+' '+MAIN_PAGES[s.section].start+MAIN_PAGES[s.section].end+' '+MAIN_PAGES[s.section].intro).toLocaleLowerCase().includes(w)));
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
window.addEventListener('hashchange',navigate);
window.addEventListener('scroll',()=>{if(!scrollTick){requestAnimationFrame(()=>{updateProgress();scrollTick=false;});scrollTick=true;}},{passive:true});
window.addEventListener('resize',updateProgress);
navigate();
