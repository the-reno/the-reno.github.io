'use strict';
/** Maker-only image gallery. Reuses existing public assets; does not edit articles. */
(() => {
  const items = [
    {id:'football', title:'Football at night', src:'/assets/young-memory.svg', alt:'A night-time football scene viewed through a fence.'},
    {id:'manhattan', title:'Manhattan reflections', src:'/assets/present-reflection.webp', alt:'A reflective night-time view toward the Manhattan skyline.'},
    {id:'runner', title:'Night runner', src:'/assets/runner-card.jpg', alt:'A runner beside the waterfront at night.'}
  ];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let root, frame, stage, toggle, tabs, panels, status, timer;
  let active = false, visible = false, hovered = false, current = 0;
  let requested = !reduced.matches, pointerIntent = null, gesture = null, suppressClick = false;
  const icon = id => `<svg class="icon" aria-hidden="true"><use href="#i-${id}"/></svg>`;

  function schedule() {
    clearTimeout(timer);
    if (!root) return;
    const running = active && visible && requested && !hovered && !document.hidden && !document.querySelector('dialog[open]');
    frame.dataset.playing = String(running);
    toggle.setAttribute('aria-label', requested ? 'Pause image rotation' : 'Start image rotation');
    toggle.title = requested ? 'Pause' : 'Play';
    toggle.querySelector('use').setAttribute('href', requested ? '#i-pause' : '#i-play');
    toggle.querySelector('span').textContent = requested ? 'Pause' : 'Play';
    if (running) timer = setTimeout(() => { show(current + 1); schedule(); }, 8000);
  }
  function show(index, announce = false) {
    current = (index + items.length) % items.length;
    panels.forEach((panel, i) => {
      const selected = i === current;
      panel.classList.toggle('is-active', selected);
      panel.inert = !selected;
      panel.setAttribute('aria-hidden', String(!selected));
      panel.querySelector('a').tabIndex = selected ? 0 : -1;
      tabs[i].setAttribute('aria-selected', String(selected));
      tabs[i].tabIndex = selected ? 0 : -1;
    });
    if (announce) status.textContent = items[current].title;
  }
  function select(index, focus = false) {
    requested = false;
    show(index, true);
    schedule();
    if (focus) tabs[current].focus();
  }
  function initialize() {
    root = document.createElement('section');
    root.id = 'maker-gallery';
    root.className = 'maker-gallery';
    root.setAttribute('aria-labelledby', 'maker-gallery-title');
    root.innerHTML = `<div class="maker-gallery-heading"><h2 id="maker-gallery-title">Visual experiments</h2><p>Scenes, memories and movement.</p></div>
      <div class="maker-gallery-frame" role="region" aria-roledescription="carousel" aria-label="Maker images">
        <div class="maker-gallery-controls">
          <button type="button" class="maker-gallery-toggle" aria-label="Pause image rotation">${icon('pause')}<span>Pause</span></button>
          <div class="maker-gallery-dots" role="tablist" aria-label="Choose an image">${items.map(s => `<button type="button" role="tab" id="maker-tab-${s.id}" aria-controls="maker-panel-${s.id}" aria-selected="false" aria-label="${s.title}" title="${s.title}" tabindex="-1"><span aria-hidden="true"></span></button>`).join('')}</div>
          <div class="maker-gallery-arrows"><button type="button" data-step="-1" aria-label="Previous image" title="Previous image">${icon('back')}</button><button type="button" data-step="1" aria-label="Next image" title="Next image">${icon('arrow')}</button></div>
        </div>
        <div class="maker-gallery-stage">${items.map(s => `<div class="maker-gallery-panel" role="tabpanel" id="maker-panel-${s.id}" aria-labelledby="maker-tab-${s.id}" aria-hidden="true" inert><figure><a class="maker-gallery-open" href="${s.src}" target="_blank" rel="noopener noreferrer" tabindex="-1" aria-label="Open ${s.title} at full size in a new tab"><div class="maker-gallery-image"><img src="${s.src}" alt="${s.alt}" loading="eager" decoding="async" draggable="false"><span class="maker-gallery-error" hidden>This image could not load. Tap to open the original.</span></div><figcaption><span>${s.title}</span><span class="maker-gallery-full">View image ↗</span></figcaption></a></figure></div>`).join('')}</div>
      </div><p class="sr-only" role="status" aria-live="polite" aria-atomic="true"></p>`;
    document.getElementById('section-perspective').after(root);
    frame = root.querySelector('.maker-gallery-frame');
    stage = root.querySelector('.maker-gallery-stage');
    toggle = root.querySelector('.maker-gallery-toggle');
    tabs = Array.from(root.querySelectorAll('[role="tab"]'));
    panels = Array.from(root.querySelectorAll('[role="tabpanel"]'));
    status = root.querySelector('[role="status"]');
    show(0);
    tabs.forEach((tab, i) => tab.addEventListener('click', () => select(i)));
    root.querySelectorAll('[data-step]').forEach(button => button.addEventListener('click', () => select(current + Number(button.dataset.step))));
    root.querySelector('.maker-gallery-dots').addEventListener('keydown', event => {
      const targets = {ArrowLeft:current - 1, ArrowRight:current + 1, Home:0, End:items.length - 1};
      if (Object.hasOwn(targets, event.key)) { event.preventDefault(); select(targets[event.key], true); }
    });
    // Capture pointer intent before focus pauses playback.
    toggle.addEventListener('pointerdown', () => { pointerIntent = !requested; });
    toggle.addEventListener('pointercancel', () => { pointerIntent = null; });
    toggle.addEventListener('click', event => {
      requested = event.detail > 0 && pointerIntent !== null ? pointerIntent : !requested;
      pointerIntent = null;
      schedule();
    });
    frame.addEventListener('focusin', () => { requested = false; schedule(); });
    stage.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') { hovered = true; schedule(); } });
    stage.addEventListener('pointerleave', event => { if (event.pointerType === 'mouse') { hovered = false; schedule(); } });
    stage.addEventListener('pointerdown', event => {
      if (event.pointerType !== 'touch') return;
      requested = false; schedule(); suppressClick = false;
      gesture = {x:event.clientX, y:event.clientY, id:event.pointerId};
    }, {passive:true});
    stage.addEventListener('pointerup', event => {
      if (!gesture || gesture.id !== event.pointerId) return;
      const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
      gesture = null;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        suppressClick = true;
        select(current + (dx < 0 ? 1 : -1));
        setTimeout(() => { suppressClick = false; }, 500);
      }
    }, {passive:true});
    stage.addEventListener('pointercancel', () => { gesture = null; });
    stage.addEventListener('click', event => {
      if (suppressClick) { event.preventDefault(); event.stopPropagation(); suppressClick = false; }
    }, true);
    panels.forEach(panel => {
      const image = panel.querySelector('img');
      const failed = () => { panel.classList.add('has-error'); panel.querySelector('.maker-gallery-error').hidden = false; };
      image.addEventListener('error', failed);
      if (image.complete && image.naturalWidth === 0) failed();
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(entries => {
        visible = entries[0].isIntersecting && entries[0].intersectionRatio >= 0.25;
        schedule();
      }, {threshold:[0,0.25]}).observe(frame);
    } else { visible = true; }
    const modalObserver = new MutationObserver(schedule);
    document.querySelectorAll('dialog').forEach(d => modalObserver.observe(d, {attributes:true, attributeFilter:['open']}));
  }
  function sync() {
    const browse = document.getElementById('browse-page');
    active = !!browse && !browse.hidden && !!document.querySelector('.nav a[data-section="maker"][aria-current="page"]');
    if (active && !root) initialize();
    if (!root) return;
    root.hidden = !active;
    if (active) {
      // Replace only Maker's empty catalogue; retain any future real articles below.
      if (!TOPICS.some(topic => topic.section === 'maker')) document.getElementById('library').hidden = true;
      const params = new URLSearchParams(location.hash.split('?')[1] || '');
      if (params.get('gallery') === 'images') requestAnimationFrame(() => root.scrollIntoView({block:'start', behavior:'instant'}));
    } else { hovered = false; }
    schedule();
  }
  // Loaded after app.js so route changes are rendered before the gallery is synced.
  window.addEventListener('hashchange', sync);
  window.addEventListener('pageshow', sync);
  window.addEventListener('pagehide', () => clearTimeout(timer));
  document.addEventListener('visibilitychange', schedule);
  reduced.addEventListener('change', () => { if (reduced.matches) requested = false; schedule(); });
  sync();
})();
