'use strict';
/* Same-page chapter binder. Photon uses the existing article renderer; Leaf uses
 * editable data. If that optional data cannot load, the ordinary article stays. */
(() => {
  const reader=document.getElementById('reader-page');
  if(!reader)return;
  const chapters=[
    {id:'photon',number:'01',title:'Photon.',label:'From the Sun to a leaf'},
    {id:'leaf',number:'02',title:'The leaf.',label:'From light to chemistry'},
    {id:'plant',number:'03',title:'The plant.',construction:true},
    {id:'pasta',number:'04',title:'Pasta.',construction:true},
    {id:'energy',number:'05',title:'Energy.',construction:true},
    {id:'muscle',number:'06',title:'Muscle.',construction:true}
  ];
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const lines=value=>escape(value).replace(/\n/g,'<br>');
  const element=(tag,className,text)=>{const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n;};
  const onArticle=()=>/\/topic\/sunlight-to-step\/?$/.test(location.pathname);
  let busyHost=null,mountedHost=null,release=()=>{},cache=null;
  const saved={active:'photon',scroll:{}};
  const sourceLink=(title,href)=>{const a=element('a','',title),url=new URL(href);if(url.protocol!=='https:')throw new Error('Invalid source');a.href=url.href;a.target='_blank';a.rel='noopener noreferrer';return a;};
  function note(title,index,open=false){
    const d=element('details');d.open=open;
    d.innerHTML=`<summary><span class="n">${String(index+1).padStart(2,'0')}</span><span>${escape(title)}</span><span class="toggle" aria-hidden="true">${open?'−':'+'}</span></summary><div class="note-body"></div>`;return d;
  }
  function chapterNavigation(key){
    const index=chapters.findIndex(c=>c.id===key),nav=element('nav','chapter-actions');
    nav.setAttribute('aria-label','Section navigation');
    const add=(target,forward)=>{
      const label=forward?'Next':'Previous',button=element('button','chapter-nav-button '+(forward?'is-next':'is-previous'));
      button.type='button';button.dataset.go=target.id;
      button.setAttribute('aria-label',label+' section: '+target.title);
      const arrow='<svg class="chapter-nav-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="'+(forward?'M5 12h14m-6-6 6 6-6 6':'M19 12H5m6-6-6 6 6 6')+'"/></svg>';
      button.innerHTML=forward?'<span>Next</span>'+arrow:arrow+'<span>Previous</span>';
      nav.append(button);
    };
    if(index>0)add(chapters[index-1],false);
    if(index<chapters.length-1)add(chapters[index+1],true);
    return nav;
  }
  function introductionMarkup(data){
    if(!data||typeof data.heading!=='string'||!Array.isArray(data.columns)||!Array.isArray(data.closing))return null;
    const intro=element('section','story-prologue');intro.setAttribute('aria-labelledby','race-eve-heading');
    const heading=element('h2','',data.heading);heading.id='race-eve-heading';intro.append(heading);
    const columns=element('div','prologue-columns');
    data.columns.forEach(paragraphs=>{
      const column=element('div','prologue-column');
      paragraphs.forEach(text=>{
        const p=element('p');p.innerHTML=lines(text).replace('But I can already feel it.','<span class="prologue-feeling">But I can already feel it.</span>');column.append(p);
      });columns.append(column);
    });intro.append(columns);
    const bottom=element('div','prologue-bottom'),closing=element('p');
    data.closing.forEach((text,index)=>{if(index)closing.append(document.createElement('br'));closing.append(index===data.closing.length-1?element('strong','',text):document.createTextNode(text));});
    const start=element('a','prologue-start');start.href='#photon';start.dataset.startStory='';start.append(document.createTextNode('Start the story'),element('span','','01 / Photon.'));
    bottom.append(closing,start);intro.append(bottom);return intro;
  }
  function panelMarkup(c,i){
    const key=c.id,building=c.construction;
    const scienceButton=`<button type="button" class="science-control" aria-controls="sunlight-science-dialog" aria-haspopup="dialog" aria-expanded="false" aria-label="Science for ${escape(c.title.replace(/\.$/,''))}"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="1.4"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(-35 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(35 12 12)"/></svg><span>Science</span></button>`;
    const toolbar=`<div class="sheet-toolbar"><span class="chapter-label">${c.number} / ${escape(c.label||c.title.replace(/\.$/,''))}</span><div class="toolbar-right">${building?'<span class="construction-toolbar-status">Under construction</span>':'<span class="reading-counter">0%</span>'}${scienceButton}</div></div>`;
    const nav=building?chapterNavigation(key).outerHTML:'';
    return `<section class="page-sheet ${i?'front-sheet':'base-sheet'}${building?' construction-sheet':''}" id="panel-${key}" role="tabpanel" aria-labelledby="tab-${key}" aria-hidden="true" inert>${toolbar}${building?'':'<div class="reading-line" aria-hidden="true"><span></span></div>'}<div class="sheet-scroll${building?' placeholder-scroll':''}" tabindex="0" role="region" aria-label="${escape(c.title)} chapter text"><header class="chapter-heading"><h2>${escape(c.title)}</h2></header>${building?'<div class="construction-content"><p class="construction-state"><span class="construction-dot" aria-hidden="true"></span>Under construction.</p></div>'+nav:`<div class="sheet-content"><div class="narrative" aria-label="${escape(c.title)} narrative"></div></div>`}</div></section>`;
  }
  function scienceModalMarkup(){
    // A native modal sits above the entire page, not inside an inert binder sheet.
    return `<dialog class="science-modal" id="sunlight-science-dialog" aria-labelledby="science-dialog-title" aria-describedby="science-dialog-context">
      <header class="science-modal-header"><div><p class="science-modal-kicker" id="science-dialog-kicker">Science / 01</p><h2 id="science-dialog-title">Photon.</h2></div><button type="button" class="science-close" aria-label="Close science and return to the story" autofocus><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 6 12 12M18 6 6 18"/></svg><span>Close</span></button></header>
      <div class="science-modal-scroll" tabindex="0" role="region" aria-label="Science notes"><p id="science-dialog-context" class="science-modal-context">The details behind this part of the story.</p>${chapters.map(c=>`<section id="science-${c.id}" class="science-chapter" aria-label="${escape(c.title)} science notes" hidden>${c.construction?'<p class="science-empty">Under construction.</p>':''}</section>`).join('')}</div>
      <footer class="science-modal-footer"><span>Notes &amp; sources</span><span class="science-modal-return">Close to return to your place in the story.</span></footer>
    </dialog>`;
  }
  function mountScienceModal(root,panels,scrollers,getActive,listen){
    const dialog=root.querySelector('#sunlight-science-dialog');
    const content=dialog.querySelector('.science-modal-scroll');
    const closeButton=dialog.querySelector('.science-close');
    const positions={};
    let pageState=null,trigger=null,chapter=null,outsidePointer=false;
    const inside=(event)=>{const r=dialog.getBoundingClientRect();return event.clientX>=r.left&&event.clientX<=r.right&&event.clientY>=r.top&&event.clientY<=r.bottom;};
    function lockPage(){
      const body=document.body,html=document.documentElement;
      const properties=['position','top','left','right','width','padding-right'];
      const gap=Math.max(0,innerWidth-html.clientWidth);
      pageState={x:scrollX,y:scrollY,key:chapter,storyTop:scrollers[chapter].scrollTop,
        body:properties.map(name=>[name,body.style.getPropertyValue(name),body.style.getPropertyPriority(name)]),
        overflow:[html.style.getPropertyValue('overflow'),html.style.getPropertyPriority('overflow')]};
      const padding=parseFloat(getComputedStyle(body).paddingRight)||0;
      body.style.position='fixed';body.style.top=-pageState.y+'px';body.style.left=-pageState.x+'px';body.style.right='0';body.style.width='100%';
      if(gap)body.style.paddingRight=padding+gap+'px';
      html.style.overflow='hidden';
    }
    function unlockPage(restore){
      if(!pageState)return;
      const state=pageState;pageState=null;
      for(const [name,value,priority] of state.body){if(value)document.body.style.setProperty(name,value,priority);else document.body.style.removeProperty(name);}
      if(state.overflow[0])document.documentElement.style.setProperty('overflow',...state.overflow);else document.documentElement.style.removeProperty('overflow');
      if(restore&&onArticle()){
        window.scrollTo({left:state.x,top:state.y,behavior:'instant'});
        scrollers[state.key]?.scrollTo({top:state.storyTop,behavior:'instant'});
      }
    }
    function close(restore=true){
      if(!dialog.open&&!pageState)return;
      if(chapter)positions[chapter]=content.scrollTop;
      if(dialog.open)dialog.close();
      trigger?.setAttribute('aria-expanded','false');
      unlockPage(restore);
      if(restore&&trigger?.isConnected&&onArticle())trigger.focus({preventScroll:true});
    }
    function open(key,button){
      if(dialog.open||key!==getActive())return;
      const c=chapters.find(item=>item.id===key);if(!c)return;
      chapter=key;trigger=button;
      dialog.querySelector('#science-dialog-kicker').textContent='Science / '+c.number;
      dialog.querySelector('#science-dialog-title').textContent=c.title;
      dialog.querySelectorAll('.science-chapter').forEach(group=>{group.hidden=group.id!=='science-'+key;});
      dialog.querySelector('.science-modal-footer > span').textContent=c.construction?'Under construction':'Notes & sources';
      lockPage();
      try{dialog.showModal();}catch(error){unlockPage(true);throw error;}
      button.setAttribute('aria-expanded','true');
      content.scrollTop=positions[key]||0;closeButton.focus({preventScroll:true});
    }
    Object.entries(panels).forEach(([key,panel])=>{
      const button=panel.querySelector('.science-control');
      listen(button,'click',()=>open(key,button));
    });
    dialog.querySelectorAll('details').forEach(d=>listen(d,'toggle',()=>{d.querySelector('.toggle').textContent=d.open?'−':'+';}));
    listen(closeButton,'click',()=>close());
    listen(dialog,'cancel',event=>{event.preventDefault();close();});
    listen(dialog,'close',()=>{if(!dialog.open&&pageState)close();});
    listen(dialog,'pointerdown',event=>{outsidePointer=event.target===dialog&&!inside(event);});
    listen(dialog,'click',event=>{if(outsidePointer&&event.target===dialog&&!inside(event))close();outsidePointer=false;});
    listen(dialog,'keydown',event=>{
      // Keep page shortcuts (including Search and binder Escape) out of the modal.
      event.stopPropagation();
      if(event.key==='Escape'){event.preventDefault();close();return;}
      if(event.key!=='Tab')return;
      const items=[...dialog.querySelectorAll('button:not([disabled]),a[href],summary,[tabindex="0"]')].filter(item=>{const closed=item.closest('details:not([open])');return item.getClientRects().length&&!item.closest('[hidden]')&&(!closed||item===closed.querySelector(':scope > summary'));});
      const first=items[0],last=items[items.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    });
    return {close,destroy:()=>close(false)};
  }
  function build(host,data){
    const root=element('div','sunlight-binder');
    root.innerHTML=`<div class="binder" data-active="photon" data-background="false"><div class="binder-tabbar"><div class="binder-tabs" role="tablist" aria-label="Story chapters" aria-orientation="horizontal">${chapters.map(c=>`<button type="button" class="chapter-tab${c.construction?' is-upcoming':''}" id="tab-${c.id}" role="tab" aria-controls="panel-${c.id}" aria-selected="false" tabindex="-1" data-chapter="${c.id}"><span class="tab-num">${c.number}</span><span class="tab-copy"><span>${escape(c.title)}</span>${c.construction?'<small class="tab-status">Under construction</small>':''}</span><span class="tab-dot" aria-hidden="true"></span></button>`).join('')}</div><span class="binder-meta" aria-hidden="true"><b id="chapter-number">01</b> / 06</span></div><div class="binder-stage">${chapters.map(panelMarkup).join('')}<div class="base-shade" aria-hidden="true"></div></div><footer class="binder-bottom"><span class="stack-label"><span class="stack-mark" aria-hidden="true"></span><span id="stack-text">The journey begins here.</span></span><span class="keyboard-hint">Six parts. One journey.</span><span id="reading-value" aria-label="Current chapter reading progress">0%</span></footer></div><p id="chapter-status" class="sr-only" role="status" aria-live="polite"></p>`;
    root.insertAdjacentHTML('beforeend',scienceModalMarkup());
    const prose=root.querySelector('#panel-photon .narrative'),science=root.querySelector('#science-photon');let noteIndex=0;
    // Reuse rendered Photon content, keeping the editable master authoritative.
    host.querySelectorAll(':scope > .story-section').forEach((original,index)=>{
      const section=element('section','binder-section');section.id=original.id;const heading=original.querySelector('h2');
      if(index&&heading){const h=element('h3','section-title',heading.textContent);h.id=heading.id;section.append(h);}
      for(const child of original.children){
        if(child.matches('.story-section-head'))continue;
        if(!child.matches('.story-concepts')){section.append(child.cloneNode(true));continue;}
        const d=note(child.querySelector('.story-concepts-label')?.textContent||'Science',noteIndex,noteIndex===0),body=d.querySelector('.note-body');
        child.querySelectorAll('.story-concept').forEach(item=>{
          const title=item.querySelector('strong')?.textContent||'',value=item.querySelector('span')?.textContent||'';
          if(/^https:\/\/\S+$/.test(value.trim())){const p=element('p');p.append(sourceLink(title,value.trim()));body.append(p);}
          else{body.append(element('h4','',title));value.split(/\n\s*\n/).forEach(t=>body.append(element('p','',t)));}
        });
        const conclusion=child.querySelector('.story-concepts-conclusion');if(conclusion)body.append(element('p','note-conclusion',conclusion.textContent));science.append(d);noteIndex++;
      }
      prose.append(section);
    });
    prose.append(chapterNavigation('photon'));
    const leaf=root.querySelector('#panel-leaf .narrative'),allowed=new Set(['personal','question','handover']);
    for(const block of data.leaf.blocks){const p=element(block.style==='handover'?'div':'p',allowed.has(block.style)?block.style:'');p.innerHTML=lines(block.text);if(block.strong)p.append(element('strong','',block.strong));leaf.append(p);}
    leaf.append(chapterNavigation('leaf'));
    data.leaf.notes.forEach((item,index)=>{const d=note(item.title,index,index===0),body=d.querySelector('.note-body');item.paragraphs.forEach(t=>body.append(element('p','',t)));item.sources.forEach(s=>body.append(sourceLink(s.title,s.url)));root.querySelector('#science-leaf').append(d);});
    return root;
  }
  function activate(root){
    const controller=new AbortController(),signal=controller.signal;
    const listen=(target,type,handler,options={})=>target.addEventListener(type,handler,{...options,signal});
    const binder=root.querySelector('.binder'),rail=root.querySelector('[role="tablist"]'),tabs=[...rail.querySelectorAll('[role="tab"]')];
    const panels=Object.fromEntries(chapters.map(c=>[c.id,root.querySelector('#panel-'+c.id)]));
    const scrollers=Object.fromEntries(chapters.map(c=>[c.id,panels[c.id].querySelector('.sheet-scroll')]));
    const reduce=matchMedia('(prefers-reduced-motion:reduce)');
    const shade=root.querySelector('.base-shade'),stage=root.querySelector('.binder-stage');let active='photon',frame=0;
    const scienceModal=mountScienceModal(root,panels,scrollers,()=>active,listen);
    const chapterFor=key=>chapters.find(c=>c.id===key);
    const refresh=key=>{
      if(chapterFor(key).construction){if(key===active)root.querySelector('#reading-value').textContent='Under construction';return;}
      const el=scrollers[key],max=el.scrollHeight-el.clientHeight,n=max<=0?100:Math.round(Math.min(100,Math.max(0,el.scrollTop/max*100)));
      panels[key].querySelector('.reading-line span').style.width=n+'%';panels[key].querySelector('.reading-counter').textContent=n+'%';if(key===active)root.querySelector('#reading-value').textContent=n+'%';
    };
    const revealTab=(tab,instant=false)=>{const r=rail.getBoundingClientRect(),t=tab.getBoundingClientRect();let left=rail.scrollLeft;if(t.left<r.left+2)left+=t.left-r.left-2;else if(t.right>r.right-2)left+=t.right-r.right+2;rail.scrollTo({left:Math.max(0,left),behavior:instant||reduce.matches?'instant':'smooth'});};
    function change(key,{historyMode='push',focus=false,initial=false}={}){
      const c=chapterFor(key);if(!c)return;const old=active,index=chapters.indexOf(c),background=index?chapters[index-1]:null;
      if(old!==key)scienceModal.close();
      active=key;saved.active=key;binder.dataset.active=key;binder.dataset.background=String(Boolean(background));const selected=tabs[index];
      if(!initial&&(focus||Object.values(panels).some(p=>p!==panels[key]&&p.contains(document.activeElement))))selected.focus({preventScroll:true});
      tabs.forEach(t=>{const yes=t.dataset.chapter===key;t.setAttribute('aria-selected',String(yes));t.tabIndex=yes?0:-1;});
      Object.entries(panels).forEach(([id,p])=>{p.classList.toggle('is-current',id===key);p.classList.toggle('is-underlay',id===background?.id);p.inert=id!==key;p.setAttribute('aria-hidden',String(id!==key));});
      root.querySelector('#chapter-number').textContent=c.number;root.querySelector('#stack-text').textContent=background?background.title.replace(/\.$/,'')+' is underneath.':'The journey begins here.';shade.dataset.go=background?.id||'photon';
      if(historyMode&&location.hash!=='#'+key)history[historyMode==='replace'?'replaceState':'pushState'](null,'','#'+key);
      if(focus)scrollers[key].focus({preventScroll:true});if(!initial&&old!==key)root.querySelector('#chapter-status').textContent=c.title+(c.construction?' Under construction.':' Selected.');revealTab(selected,initial);refresh(key);
    }
    function routeHash(){
      if(!onArticle())return;const id=location.hash.slice(1);
      if(chapterFor(id))change(id,{historyMode:null,initial:true});
      else{change('photon',{historyMode:null,initial:true});const target=id?root.querySelector('[id="'+CSS.escape(id)+'"]'):null;if(target&&panels.photon.contains(target))target.scrollIntoView({block:'start',behavior:'instant'});}
    }
    tabs.forEach((tab,index)=>{
      listen(tab,'click',()=>change(tab.dataset.chapter));
      listen(tab,'keydown',e=>{const next=e.key==='ArrowRight'?(index+1)%tabs.length:e.key==='ArrowLeft'?(index+tabs.length-1)%tabs.length:e.key==='Home'?0:e.key==='End'?tabs.length-1:null;if(next===null)return;e.preventDefault();tabs[next].focus({preventScroll:true});change(tabs[next].dataset.chapter);});
    });
    root.querySelectorAll('[data-go]').forEach(b=>listen(b,'click',()=>change(b.dataset.go,{focus:true})));
    const start=reader.querySelector('[data-start-story]');
    if(start)listen(start,'click',event=>{
      event.preventDefault();change('photon');
      const headerHeight=document.querySelector('.site-header')?.getBoundingClientRect().height||80;
      window.scrollTo({top:Math.max(0,root.getBoundingClientRect().top+scrollY-headerHeight-16),behavior:reduce.matches?'instant':'smooth'});
      tabs[0].focus({preventScroll:true});
    });
    listen(shade,'click',()=>change(shade.dataset.go));
    listen(document,'keydown',e=>{if(e.defaultPrevented||e.key!=='Escape'||active==='photon'||document.querySelector('dialog[open]')||!onArticle())return;e.preventDefault();const previous=chapters[chapters.findIndex(c=>c.id===active)-1];change(previous.id);tabs[chapters.indexOf(previous)].focus({preventScroll:true});});
    listen(window,'popstate',routeHash);listen(window,'hashchange',routeHash);
    Object.entries(panels).forEach(([key,panel])=>{
      const scroller=scrollers[key];scroller.scrollTop=saved.scroll[key]||0;
      listen(scroller,'scroll',()=>{saved.scroll[key]=scroller.scrollTop;refresh(key);},{passive:true});
    });
    function responsive(){
      const headerHeight=document.querySelector('.site-header')?.getBoundingClientRect().height||80;
      const tabsHeight=root.querySelector('.binder-tabbar').getBoundingClientRect().height;
      const height=Math.max(240,Math.min(780,innerHeight-headerHeight-tabsHeight-64));
      root.style.setProperty('--stage-height',height+'px');refresh(active);revealTab(tabs[chapters.findIndex(c=>c.id===active)],true);
    }
    const resize=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(responsive);};listen(window,'resize',resize);
    const observer=new ResizeObserver(resize);observer.observe(document.querySelector('.site-header'));responsive();routeHash();
    return()=>{scienceModal.destroy();controller.abort();observer.disconnect();cancelAnimationFrame(frame);};
  }
  async function enhance(){
    if(!onArticle()){release();release=()=>{};mountedHost=null;reader.classList.remove('has-binder','has-intro');return;}
    const host=reader.querySelector('#narrative-content');if(!host||host===mountedHost||host===busyHost||host.getAttribute('aria-busy')==='true'||!host.querySelector(':scope > .story-section'))return;busyHost=host;
    try{
      if(!cache){const r=await fetch('/articles/sunlight-leaf.json?v=20261021-buttons1',{credentials:'same-origin',signal:AbortSignal.timeout(12000)});if(!r.ok)throw new Error('Leaf data unavailable');cache=await r.json();}
      if(!onArticle()||!host.isConnected||reader.querySelector('#narrative-content')!==host)return;
      if(!Array.isArray(cache.leaf?.blocks)||!Array.isArray(cache.leaf?.notes))throw new Error('Invalid Leaf content');
      const root=build(host,cache);release();mountedHost=host;
      reader.querySelector('.story-prologue')?.remove();
      const intro=introductionMarkup(cache.introduction);
      if(intro)reader.querySelector('.story-header').after(intro);
      reader.classList.toggle('has-intro',Boolean(intro));
      host.replaceChildren(root);reader.classList.add('has-binder');const progress=document.getElementById('reading-progress');if(progress)progress.hidden=true;release=activate(root);
    }catch(error){console.warn('Chapter binder unavailable; keeping the article.',error.message);}finally{if(busyHost===host)busyHost=null;}
  }
  let queued=false;const schedule=()=>{if(!queued){queued=true;queueMicrotask(()=>{queued=false;enhance();});}};
  new MutationObserver(schedule).observe(reader,{childList:true,subtree:true});window.addEventListener('ronu:navigate',schedule);schedule();
})();
