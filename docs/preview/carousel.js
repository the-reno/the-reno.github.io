'use strict';
/** Explore-only section carousel. No dependencies; never changes article/model content. */
const FeaturedCarousel = (() => {
  const intervalMs = 8000;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let root, viewport, toggle, tabs, panels, timer = null;
  let current = 0, enabled = false, inView = false, hovered = false;
  let requested = !reduceMotion.matches, pointerIntent = null, gesture = null, suppressClick = false;

  function canRotate() {
    return enabled && requested && inView && !hovered && !document.hidden && !document.querySelector('dialog[open]');
  }
  function schedule() {
    clearTimeout(timer); timer = null;
    if (!root) return;
    const running = canRotate();
    root.dataset.playing = String(running);
    toggle.setAttribute('aria-label', requested ? 'Pause automatic rotation' : 'Start automatic rotation');
    toggle.title = requested ? 'Pause' : 'Play';
    toggle.querySelector('use').setAttribute('href', requested ? '#i-pause' : '#i-play');
    toggle.querySelector('span').textContent = requested ? 'Pause' : 'Play';
    viewport.setAttribute('aria-live', running ? 'off' : 'polite');
    if (running) timer = setTimeout(() => { show(current + 1); schedule(); }, intervalMs);
  }
  function show(index) {
    current = (index + panels.length) % panels.length;
    panels.forEach((panel, i) => {
      const selected = i === current;
      panel.classList.toggle('is-active', selected);
      panel.inert = !selected;
      panel.setAttribute('aria-hidden', String(!selected));
      panel.querySelector('a').tabIndex = selected ? 0 : -1;
      tabs[i].setAttribute('aria-selected', String(selected));
      tabs[i].tabIndex = selected ? 0 : -1;
    });
    root.dataset.section = FEATURED_SECTIONS[current].section;
  }
  function select(index, focusTab = false) {
    requested = false; schedule();
    show(index);
    if (focusTab) tabs[current].focus();
  }
  function initialize() {
    if (root) return;
    root = document.getElementById('section-carousel');
    const slideData = FEATURED_SECTIONS.map(item => ({...item, name:SECTIONS[item.section].name}));
    // Controls precede rotating content for keyboard access, but sit below it visually.
    root.innerHTML = `<div class="carousel-controls">
      <button type="button" class="carousel-toggle" id="carousel-toggle" aria-label="Pause automatic rotation"><svg class="icon" aria-hidden="true"><use href="#i-pause"/></svg><span>Pause</span></button>
      <div class="carousel-dots" role="tablist" aria-label="Choose a section">${slideData.map(s => `<button type="button" role="tab" id="carousel-tab-${s.section}" aria-label="${esc(s.name)}" aria-controls="carousel-panel-${s.section}" aria-selected="false" tabindex="-1" title="${esc(s.name)}"><span aria-hidden="true"></span></button>`).join('')}</div>
      <div class="carousel-arrows"><button type="button" id="carousel-previous" aria-label="Previous section" title="Previous section"><svg class="icon" aria-hidden="true"><use href="#i-back"/></svg></button><button type="button" id="carousel-next" aria-label="Next section" title="Next section"><svg class="icon" aria-hidden="true"><use href="#i-arrow"/></svg></button></div>
    </div><div class="carousel-slides" aria-live="off" aria-atomic="false">${slideData.map(s => `<div class="carousel-slide" role="tabpanel" id="carousel-panel-${s.section}" aria-labelledby="carousel-tab-${s.section}" aria-hidden="true" inert><a class="carousel-link" href="#section/${s.section}" tabindex="-1" aria-label="Explore ${esc(s.name)}">${mainHero(s.section,{slide:true})}</a></div>`).join('')}</div>`;
    viewport = root.querySelector('.carousel-slides');
    toggle = root.querySelector('#carousel-toggle');
    tabs = Array.from(root.querySelectorAll('[role="tab"]'));
    panels = Array.from(root.querySelectorAll('[role="tabpanel"]'));
    show(0);
    tabs.forEach((tab, i) => tab.addEventListener('click', () => select(i)));
    root.querySelector('#carousel-previous').addEventListener('click', () => select(current - 1));
    root.querySelector('#carousel-next').addEventListener('click', () => select(current + 1));
    root.querySelector('.carousel-dots').addEventListener('keydown', event => {
      const targets = {ArrowLeft: current - 1, ArrowRight: current + 1, Home: 0, End: panels.length - 1};
      if (Object.hasOwn(targets, event.key)) { event.preventDefault(); select(targets[event.key], true); }
    });
    // Remember a pointer's intent before focus automatically pauses rotation.
    toggle.addEventListener('pointerdown', () => { pointerIntent = !requested; });
    toggle.addEventListener('pointercancel', () => { pointerIntent = null; });
    toggle.addEventListener('click', event => {
      requested = event.detail > 0 && pointerIntent !== null ? pointerIntent : !requested;
      pointerIntent = null; schedule();
    });
    root.addEventListener('focusin', () => { requested = false; schedule(); });
    root.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') { hovered = true; schedule(); } });
    root.addEventListener('pointerleave', event => { if (event.pointerType === 'mouse') { hovered = false; schedule(); } });
    // Touch swipes navigate, but a vertical gesture still scrolls the page.
    viewport.addEventListener('pointerdown', event => {
      if (event.pointerType !== 'touch') return;
      requested = false; schedule(); suppressClick = false;
      gesture = {x: event.clientX, y: event.clientY, id: event.pointerId};
    }, {passive: true});
    viewport.addEventListener('pointerup', event => {
      if (!gesture || gesture.id !== event.pointerId) return;
      const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
      gesture = null;
      if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        suppressClick = true; select(current + (dx < 0 ? 1 : -1));
        setTimeout(() => { suppressClick = false; }, 500);
      }
    }, {passive: true});
    viewport.addEventListener('pointercancel', () => { gesture = null; });
    viewport.addEventListener('click', event => {
      if (suppressClick) { event.preventDefault(); event.stopPropagation(); suppressClick = false; }
    }, true);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(entries => { inView = entries[0].isIntersecting && entries[0].intersectionRatio >= 0.25; schedule(); }, {threshold: [0, 0.25]}).observe(root);
    } else { inView = true; }
    document.addEventListener('visibilitychange', schedule);
    window.addEventListener('pagehide', () => { clearTimeout(timer); timer = null; });
    window.addEventListener('pageshow', schedule);
    const modalObserver = new MutationObserver(schedule);
    document.querySelectorAll('dialog').forEach(d => modalObserver.observe(d, {attributes: true, attributeFilter: ['open']}));
    reduceMotion.addEventListener('change', () => { if (reduceMotion.matches) requested = false; schedule(); });
  }
  return {
    sync(browseState) {
      initialize();
      enabled = browseState.section === 'all' && browseState.type === 'all' && !browseState.query.trim();
      root.hidden = !enabled;
      schedule();
    },
    suspend() { enabled = false; schedule(); }
  };
})();
