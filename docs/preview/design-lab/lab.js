'use strict';
(() => {
  const data = window.RONU_LAB;
  const $ = (selector, node=document) => node.querySelector(selector);
  const $$ = (selector, node=document) => [...node.querySelectorAll(selector)];
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const defaultState = {layout:'01',color:'G1',page:'triathlon',view:'preview',screen:'fit',mode:'lab'};
  let state = {...defaultState}, homeSlide = 0, gallerySlide = 0, playback = false, timer = null, visible = true;
  const canonical = 'https://ronu.one/preview/design-lab/';
  const allowed = {
    layout:data.layouts.map(x=>x.id), color:data.colors.map(x=>x.id),
    page:['explore',...data.sections.map(x=>x.id)], view:['preview','compare'], screen:['fit','phone'],mode:['lab','present']
  };
  function readState() {
    const params = new URLSearchParams(location.search);
    state = {...defaultState};
    Object.keys(allowed).forEach(key => { if (allowed[key].includes(params.get(key))) state[key] = params.get(key); });
    if (state.mode==='present') {state.view='preview';state.screen='fit';}
    playback = false;
  }
  function urlFor(choice=state) {
    const u = new URL(canonical);
    Object.keys(defaultState).forEach(key => {if(choice[key]!==defaultState[key]) u.searchParams.set(key,choice[key]);});
    return u.href;
  }
  function updateURL() {
    const u = new URL(urlFor());
    try {history.replaceState(null,'',location.pathname+u.search);} catch (_) {/* Comparison is usable without history access. */}
  }
  function luminance(hex) {
    const rgb = hex.replace('#','').match(/../g).map(h=>parseInt(h,16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);
    return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
  }
  function ratio(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
  function currentSection(){return data.sections.find(s=>s.id===state.page)||data.sections[homeSlide];}
  function currentLayout(){return data.layouts.find(x=>x.id===state.layout);}
  function currentColor(){return data.colors.find(x=>x.id===state.color);}
  function reference(){return `L${state.layout} / ${state.color} / ${state.page==='explore'?'Explore':currentSection().name}`;}
  function change(patch) {
    state = {...state,...patch};playback=false;
    if (state.mode==='present') {state.view='preview';state.screen='fit';}
    updateURL();render();
  }
  function iconArt(section) {
    return `<div class="hero-art" data-art="${section.id}" aria-hidden="true"><span class="orbit"></span><span class="orbit"></span><span class="orbit"></span><span class="orbit-core"></span><span class="orbit-mark"></span><span class="art-caption">AN IDEA IN MOTION / ABSTRACT STUDY</span></div>`;
  }
  function hero(section,layout,{home=false,compact=false}={}) {
    const statement = layout==='02'||layout==='04';
    const tag = home||compact?'h2':'h1';
    const title = statement ? `${escape(section.start)}<em>${escape(section.end)}</em>` : `${escape(section.name)}<span class="period">.</span>`;
    const label = statement ? section.name : 'A personal perspective';
    const tagline = statement ? '' : `<p class="hero-tagline">${escape(section.tagline)}</p>`;
    const cta = home ? `Explore ${section.name.toLowerCase()}` : section.id==='maker' ? 'See the images' : section.id==='markets' ? 'Explore the perspective' : 'Browse articles';
    const action = home ? `data-page="${section.id}"` : 'data-jump="section-work"';
    return `<section class="page-hero"><div class="hero-copy"><p class="hero-eyebrow">${escape(label)}</p><${tag} class="hero-title">${title}</${tag}>${tagline}${section.intro&&!compact?`<p class="hero-intro">${escape(section.intro)}</p>`:''}<div class="hero-actions"><button type="button" class="hero-cta" ${action}>${escape(cta)}<span class="arr" aria-hidden="true">→</span></button><span class="hero-themes">${escape(section.themes)}</span></div></div>${iconArt(section)}</section>`;
  }
  function nav() {
    return `<header class="mock-top"><button class="mock-logo" type="button" data-page="explore" aria-label="Explore the sections">ronu<b>.</b>one</button><nav class="mock-nav" aria-label="Navigation inside the page preview">${['explore',...data.sections.map(x=>x.id)].map(id=>`<button type="button" data-page="${id}" ${state.page===id?'aria-current="page"':''}>${id==='explore'?'Explore':escape(data.sections.find(s=>s.id===id).name)}</button>`).join('')}</nav></header>`;
  }
  function slideControls(kind,length,current) {
    const names = kind==='home'?data.sections.map(s=>s.name):data.images.map(i=>i.title);
    return `<div class="slide-controls" aria-label="${kind==='home'?'Section':'Image'} carousel controls">${kind==='home'?`<button type="button" data-play aria-label="${playback?'Pause automatic rotation':'Start automatic rotation'}">${playback?'Ⅱ Pause':'▷ Play'}</button>`:'<span class="micro" aria-hidden="true">IMAGES</span>'}<div class="dots" role="group" aria-label="Choose a ${kind==='home'?'section':'picture'}">${names.map((name,i)=>`<button type="button" data-slide="${kind}" data-index="${i}" aria-label="${escape(name)}" ${i===current?'aria-current="true"':''}><span aria-hidden="true"></span></button>`).join('')}</div><div class="prev-next"><button type="button" data-step="${kind}" data-direction="-1" aria-label="Previous ${kind==='home'?'section':'image'}">←</button><button type="button" data-step="${kind}" data-direction="1" aria-label="Next ${kind==='home'?'section':'image'}">→</button></div></div>`;
  }
  function gallery() {
    const image = data.images[gallerySlide];
    return `<div class="lab-gallery"><p class="gallery-note">Scenes, memories and movement.</p><figure><img src="${image.src}" alt="${escape(image.alt)}" decoding="async" width="900" height="450"><figcaption><span>${escape(image.title)}</span><a href="${image.src}" target="_blank" rel="noopener noreferrer">View image ↗</a></figcaption></figure>${slideControls('gallery',data.images.length,gallerySlide)}</div>`;
  }
  function sectionWork(section) {
    const topics = data.topics.filter(t=>t.section===section.id);
    return `<div class="mock-content" id="section-work">${section.body?`<div class="perspective-row"><div><p class="micro">WHY I EXPLORE IT</p><h2>${escape(section.question)}</h2></div><p>${escape(section.body)}</p></div>`:''}${section.id==='maker'?gallery():`<div class="work-head"><h2>Articles & experiments</h2><span>${topics.length} topics</span></div>${topics.length?`<div class="work-grid">${topics.map(t=>`<a class="work-item" href="/preview/#topic/${t.id}" target="_blank" rel="noopener noreferrer"><div><small>${escape(t.type)}</small><strong>${escape(t.title)}</strong><p>${escape(t.description)}</p></div><span class="arr" aria-hidden="true">↗</span></a>`).join('')}</div>`:'<p class="work-empty">No articles or experiments are listed in this section yet.</p>'}`}</div>`;
  }
  function homeBody() {
    const s=data.sections[homeSlide];
    return `<section class="home-intro"><h1>Stay <em>curious.</em></h1><p>Welcome to my lab.<br>Ideas to explore. Models to test.<br>Things to build.</p></section><div class="home-feature layout-${state.layout}" role="region" aria-roledescription="carousel" aria-label="Explore the sections"><div id="home-slide">${hero(s,state.layout,{home:true})}</div><div id="home-controls">${slideControls('home',4,homeSlide)}</div></div><p class="home-hint">Each section opens with a perspective, followed by its related work. Rotation starts only when you press Play.</p><div class="home-labels" aria-label="Section shortcuts">${data.sections.map(s=>`<button type="button" data-page="${s.id}">${s.name} <span aria-hidden="true">↗</span></button>`).join('')}</div>`;
  }
  function renderCanvas() {
    $('#canvas').innerHTML=`<div class="site-mock layout-${state.layout}">${nav()}<div class="mock-inner">${state.page==='explore'?homeBody():hero(currentSection(),state.layout)+sectionWork(currentSection())}<footer class="mock-foot"><span>Rafael Renó / A personal lab</span><a href="/preview/" target="_blank" rel="noopener noreferrer">Current prototype ↗</a></footer></div></div>`;
  }
  function renderComparison() {
    const section = state.page==='explore'?data.sections[0]:currentSection();
    $('#comparison-grid').innerHTML=data.layouts.map(l=>`<article class="compare-card" data-selected="${state.layout===l.id}"><div class="compare-card-head"><p><span>${l.id}</span>${l.name}</p><button type="button" data-try="${l.id}" aria-label="Try layout ${l.id}, ${l.name}">Try ${l.id} ↗</button></div><div class="compare-canvas" inert aria-hidden="true"><div class="site-mock layout-${l.id}"><div class="mock-inner">${hero(section,l.id,{compact:true})}</div></div></div><p class="compare-caption">${escape(l.note)} Same sentence. Same color.</p></article>`).join('');
  }
  function render() {
    clearTimeout(timer);timer=null;
    const color=currentColor(),layout=currentLayout();
    document.documentElement.style.setProperty('--accent',color.hex);
    document.documentElement.dataset.color=color.id;
    document.body.classList.toggle('presentation',state.mode==='present');
    $('#exit-presentation').hidden=state.mode!=='present';
    $$('#layout-options button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.layout===state.layout)));
    $$('#color-options button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.color===state.color)));
    $$('#page-options button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.page===state.page)));
    $$('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===state.view)));
    $$('[data-screen]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.screen===state.screen)));
    $('#color-spec').textContent=`${color.id} · ${color.name} · ${color.hex}`;
    $('#contrast-note').textContent=`${ratio(color.hex,'#0C0E11').toFixed(1)}:1 contrast on #0C0E11. White remains the reading color.`;
    $('#selection-code').textContent=reference();
    $('#inspector-summary').textContent=`${state.layout} ${layout.name} · ${color.id}`;
    $('#stage-title').textContent=`${state.layout} / ${layout.name}`;
    $('#stage-subtitle').textContent=state.view==='compare'?`${state.page==='explore'?'Triathlon':currentSection().name} · Same color / ${color.id}`:`${state.page==='explore'?'Explore':currentSection().name} · ${color.id}`;
    $('#design-caption').textContent=state.view==='compare'?'Compare the same sentence in four compositions. Choose “Try” to open one at full size.':layout.detail;
    $('#preview-stage').hidden=state.view==='compare';
    $('#preview-stage').dataset.screen=state.screen;
    $('#comparison-grid').hidden=state.view!=='compare';
    $$('.screen-tools button').forEach(b=>b.disabled=state.view==='compare');
    if(state.view==='compare') {$('#canvas').replaceChildren();renderComparison();} else {$('#comparison-grid').replaceChildren();renderCanvas();}
    document.title=`Ronu lab — L${state.layout} / ${color.id} / ${state.page==='explore'?'Explore':currentSection().name}`;
    schedule();
  }
  function showSlide(kind,index,manual=true) {
    if(manual)playback=false;
    if(kind==='home') {
      homeSlide=(index+data.sections.length)%data.sections.length;
      const panel=$('#home-slide');
      if(panel){panel.innerHTML=hero(data.sections[homeSlide],state.layout,{home:true});updateHomeControls();}
    } else {
      gallerySlide=(index+data.images.length)%data.images.length;
      const galleryEl=$('.lab-gallery');
      if(galleryEl){const box=document.createElement('div');box.innerHTML=gallery();galleryEl.replaceWith(box.firstElementChild);}
    }
    schedule();
  }
  function updateHomeControls() {
    const root=$('#home-controls');if(!root)return;
    const focused=document.activeElement;
    const token=focused?.dataset?.play!==undefined?'play':focused?.dataset?.index!==undefined?'index-'+focused.dataset.index:focused?.dataset?.direction!==undefined?'direction-'+focused.dataset.direction:null;
    root.innerHTML=slideControls('home',4,homeSlide);
    if(token){const target=token==='play'?$('[data-play]',root):token.startsWith('index-')?$(`[data-index="${token.slice(6)}"]`,root):$(`[data-direction="${token.slice(10)}"]`,root);target?.focus({preventScroll:true});}
  }
  function schedule() {
    clearTimeout(timer);timer=null;
    if(playback&&state.page==='explore'&&state.view==='preview'&&!document.hidden&&visible&&!$('dialog[open]')){
      timer=setTimeout(()=>showSlide('home',homeSlide+1,false),8000);
    }
  }
  function choiceText() {
    const l=currentLayout(),c=currentColor();
    return `Ronu design choice: ${reference()}\nLayout: ${l.id} — ${l.name}\nColor: ${c.id} — ${c.name} (${c.hex})\nPage: ${state.page==='explore'?'Explore':currentSection().name}\n${urlFor({...state,mode:'lab'})}`;
  }
  async function copyChoice() {
    const text=choiceText();
    try {if(!navigator.clipboard?.writeText)throw new Error('Clipboard unavailable');await navigator.clipboard.writeText(text);$('#copy-status').textContent='Choice copied';setTimeout(()=>$('#copy-status').textContent='',2600);}
    catch (_) {$('#choice-text').value=text;$('#copy-dialog').showModal();$('#choice-text').focus();$('#choice-text').select();}
  }
  $('#layout-options').innerHTML=data.layouts.map(l=>`<button class="layout-option" type="button" data-layout="${l.id}" aria-pressed="false"><span>${l.id}</span><div><strong>${l.name}</strong><small>${l.note}</small></div></button>`).join('');
  $('#color-options').innerHTML=data.colors.map(c=>`<button class="color-option" type="button" data-color="${c.id}" style="--swatch:${c.hex}" aria-label="${c.id}, ${c.name}, ${c.hex}" aria-pressed="false" title="${c.name} · ${c.hex}"><span class="swatch" aria-hidden="true"></span><span>${c.id}</span></button>`).join('');
  $('#page-options').innerHTML=[{id:'explore',name:'Explore'},...data.sections].map(s=>`<button class="page-option" type="button" data-page="${s.id}" aria-pressed="false">${s.name}</button>`).join('');
  document.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.layout)change({layout:b.dataset.layout});
    else if(b.dataset.color)change({color:b.dataset.color});
    else if(b.dataset.page){change({page:b.dataset.page});}
    else if(b.dataset.view)change({view:b.dataset.view});
    else if(b.dataset.screen)change({screen:b.dataset.screen});
    else if(b.dataset.try){change({layout:b.dataset.try,view:'preview'});$('#preview-area').scrollIntoView({block:'start'});}
    else if(b.dataset.slide){showSlide(b.dataset.slide,Number(b.dataset.index));const selector=`[data-slide="${b.dataset.slide}"][data-index="${b.dataset.index}"]`;$(selector)?.focus({preventScroll:true});}
    else if(b.dataset.step){const k=b.dataset.step;showSlide(k,(k==='home'?homeSlide:gallerySlide)+Number(b.dataset.direction));$(`[data-step="${k}"][data-direction="${b.dataset.direction}"]`)?.focus({preventScroll:true});}
    else if(b.hasAttribute('data-play')){playback=!playback;updateHomeControls();schedule();}
    else if(b.dataset.jump){$('#'+b.dataset.jump)?.scrollIntoView({block:'start',behavior:reduced.matches?'instant':'smooth'});}
  });
  $('#full-preview').addEventListener('click',()=>{change({mode:'present',screen:'fit',view:'preview'});window.scrollTo(0,0);});
  $('#exit-presentation').addEventListener('click',()=>change({mode:'lab'}));
  $('#reset-options').addEventListener('click',()=>{homeSlide=0;gallerySlide=0;change({...defaultState});});
  $('#copy-choice').addEventListener('click',copyChoice);
  $('#close-copy').addEventListener('click',()=>$('#copy-dialog').close());
  $('#select-choice').addEventListener('click',()=>{$('#choice-text').focus();$('#choice-text').select();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.mode==='present')change({mode:'lab'});});
  // Never auto-start during comparison. Interaction with the featured text stops playback.
  $('#canvas').addEventListener('focusin',e=>{if(e.target.closest('#home-slide')&&playback){playback=false;updateHomeControls();schedule();}});
  $('#canvas').addEventListener('pointerdown',e=>{if(e.target.closest('#home-slide')&&playback){playback=false;updateHomeControls();schedule();}});
  document.addEventListener('visibilitychange',schedule);
  window.addEventListener('pagehide',()=>clearTimeout(timer));
  window.addEventListener('pageshow',schedule);
  window.addEventListener('popstate',()=>{readState();render();});
  reduced.addEventListener('change',()=>{if(reduced.matches){playback=false;updateHomeControls();schedule();}});
  if('IntersectionObserver' in window)new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;schedule();},{threshold:0}).observe($('#preview-stage'));
  new MutationObserver(schedule).observe($('#copy-dialog'),{attributes:true,attributeFilter:['open']});
  if(matchMedia('(max-width:800px)').matches)$('.inspector-details').open=false;
  readState();render();
})();
