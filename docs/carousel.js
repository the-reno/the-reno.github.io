'use strict';
/** Shared carousel controller for Explore and Maker. No page-specific copy or markup. */
class RonuCarousel {
  constructor(root, options = {}) {
    this.root = root;
    this.options = options;
    this.slides = [...root.querySelectorAll('[data-slide]')];
    this.tabs = [...root.querySelectorAll('[data-dot]')];
    this.toggle = root.querySelector('[data-toggle]');
    this.stage = root.querySelector('.carousel-slides');
    this.status = root.querySelector('[data-status]');
    this.motion = matchMedia('(prefers-reduced-motion: reduce)');
    this.events = new AbortController();
    this.current = 0;
    this.requested = options.requested ?? (SITE.carousel.autoplay && !this.motion.matches);
    this.visible = false;
    this.hovered = false;
    this.timer = null;
    this.gesture = null;
    this.pointerIntent = null;
    this.suppressClick = false;
    this.destroyed = false;
    const on = (target, event, handler, settings = {}) => target.addEventListener(event, handler, {...settings, signal: this.events.signal});
    this.tabs.forEach((tab, i) => on(tab, 'click', () => this.select(i)));
    root.querySelectorAll('[data-step]').forEach(button => on(button, 'click', () => this.select(this.current + Number(button.dataset.step))));
    on(root.querySelector('[role="tablist"]'), 'keydown', event => {
      const targets = {ArrowLeft: this.current - 1, ArrowRight: this.current + 1, Home: 0, End: this.slides.length - 1};
      if (Object.hasOwn(targets, event.key)) {event.preventDefault(); this.select(targets[event.key]); this.tabs[this.current].focus();}
    });
    on(root, 'focusin', () => {this.requested = false; this.schedule();});
    on(root, 'pointerenter', event => {if (event.pointerType === 'mouse') {this.hovered = true; this.schedule();}});
    on(root, 'pointerleave', event => {if (event.pointerType === 'mouse') {this.hovered = false; this.schedule();}});
    // Preserve the intended toggle action when pointer focus pauses playback first.
    on(this.toggle, 'pointerdown', () => {this.pointerIntent = !this.requested;});
    on(this.toggle, 'pointercancel', () => {this.pointerIntent = null;});
    on(this.toggle, 'click', event => {
      this.requested = event.detail > 0 && this.pointerIntent !== null ? this.pointerIntent : !this.requested;
      this.pointerIntent = null;
      this.schedule();
    });
    on(this.stage, 'pointerdown', event => {
      if (event.pointerType !== 'touch') return;
      this.requested = false; this.schedule(); this.suppressClick = false;
      this.gesture = {x: event.clientX, y: event.clientY, id: event.pointerId};
    }, {passive: true});
    on(this.stage, 'pointerup', event => {
      if (!this.gesture || this.gesture.id !== event.pointerId) return;
      const dx = event.clientX - this.gesture.x, dy = event.clientY - this.gesture.y;
      this.gesture = null;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        this.suppressClick = true;
        this.select(this.current + (dx < 0 ? 1 : -1));
      }
    }, {passive: true});
    on(this.stage, 'pointercancel', () => {this.gesture = null;});
    on(this.stage, 'click', event => {
      if (this.suppressClick) {event.preventDefault(); event.stopPropagation(); this.suppressClick = false;}
    }, {capture: true});
    root.querySelectorAll('img').forEach(image => {
      const failed = () => {image.hidden = true; image.parentElement.querySelector('.gallery-error').hidden = false;};
      on(image, 'error', failed);
      if (image.complete && !image.naturalWidth) failed();
    });
    this.intersection = new IntersectionObserver(entries => {
      this.visible = entries[0].isIntersecting;
      this.schedule();
    });
    this.intersection.observe(root);
    this.dialogs = new MutationObserver(() => this.schedule());
    document.querySelectorAll('dialog').forEach(dialog => this.dialogs.observe(dialog, {attributes: true, attributeFilter: ['open']}));
    on(document, 'visibilitychange', () => this.schedule());
    on(window, 'pagehide', () => clearTimeout(this.timer));
    on(window, 'pageshow', () => this.schedule());
    on(this.motion, 'change', () => {if (this.motion.matches) this.requested = false; this.schedule();});
    this.show(options.index || 0);
    this.schedule();
  }
  show(index, announce = false) {
    if (!this.slides.length) return;
    this.current = ((index % this.slides.length) + this.slides.length) % this.slides.length;
    this.slides.forEach((slide, i) => {
      const selected = i === this.current;
      slide.classList.toggle('is-active', selected);
      slide.inert = !selected;
      slide.setAttribute('aria-hidden', String(!selected));
      slide.querySelectorAll('a,button').forEach(link => link.tabIndex = selected ? 0 : -1);
      this.tabs[i].setAttribute('aria-selected', String(selected));
      this.tabs[i].tabIndex = selected ? 0 : -1;
    });
    if (announce) this.status.textContent = this.tabs[this.current].getAttribute('aria-label');
  }
  select(index) {this.requested = false; this.show(index, true); this.schedule();}
  schedule() {
    clearTimeout(this.timer);
    if (this.destroyed) return;
    const running = this.slides.length > 1 && this.requested && this.visible && !this.hovered && !document.hidden && !document.querySelector('dialog[open]');
    this.root.dataset.playing = String(running);
    const label = this.requested ? SITE.labels.pause : SITE.labels.play;
    this.toggle.setAttribute('aria-label', label + ' automatic rotation');
    const text = this.toggle.querySelector('span');
    if (text.textContent !== label) text.textContent = label;
    const use = this.toggle.querySelector('use'), symbol = this.requested ? '#i-pause' : '#i-play';
    if (use.getAttribute('href') !== symbol) use.setAttribute('href', symbol);
    if (running) this.timer = setTimeout(() => {this.show(this.current + 1); this.schedule();}, SITE.carousel.intervalMs);
  }
  destroy() {
    const snapshot = {index: this.current, requested: this.requested};
    this.destroyed = true;
    clearTimeout(this.timer);
    this.events.abort();
    this.intersection.disconnect();
    this.dialogs.disconnect();
    return snapshot;
  }
}
