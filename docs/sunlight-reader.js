'use strict';
/* Progressive enhancement: the complete article remains readable without JavaScript. */
(() => {
  const reader = document.getElementById('reader-page');
  if (!reader) return;
  let dispose = () => {}, queued = false;
  const onArticle = () => reader.dataset.topicId === 'sunlight-to-step' ||
    (typeof currentTopic !== 'undefined' && currentTopic?.id === 'sunlight-to-step') ||
    /\/topic\/sunlight-to-step\/?$/.test(location.pathname);
  const definitions = {
    'Quantum physics': ['quantum', '01'],
    'Mass & energy': ['mass', '02'],
    'Light & photons': ['photons', '03'],
    'Reading & sources': ['sources', '04']
  };
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };
  function enhance() {
    queued = false;
    if (!onArticle()) { dispose(); return; }
    const host = reader.querySelector('#narrative-content');
    if (!host || host.dataset.sunlightEnhanced || host.getAttribute('aria-busy') === 'true') return;
    const sections = [...host.querySelectorAll(':scope > .story-section')];
    if (!sections.length || !host.querySelector('.story-concepts')) return;
    dispose();
    host.dataset.sunlightEnhanced = 'true';
    const article = host.closest('article');
    article.classList.add('has-science-layout');
    const controller = new AbortController(), signal = controller.signal;
    const mobile = matchMedia('(max-width: 860px)');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const root = element('div', 'science-reader');
    const nav = element('nav', 'science-nav'); nav.setAttribute('aria-label', 'In this chapter');
    const labels = ['The Sun', 'Light', 'A leaf'];
    sections.forEach((section, index) => {
      const a = element('a', 'science-nav-link', labels[index] || section.querySelector('h2')?.textContent || 'Part ' + (index + 1));
      a.href = '#' + section.id; a.dataset.storyPart = section.id;
      nav.append(a);
    });
    const jump = element('a', 'science-jump', 'Science'); jump.href = '#science-quantum'; nav.append(jump);
    const columns = element('div', 'science-columns');
    const story = element('div', 'science-story');
    const aside = element('aside', 'science-aside'); aside.id = 'science-panel'; aside.setAttribute('aria-labelledby', 'science-panel-title');
    const asideHead = element('header', 'science-aside-head');
    const asideTitle = element('h2', '', 'Science'); asideTitle.id = 'science-panel-title';
    asideHead.append(asideTitle, element('p', '', 'The details behind the story.'));
    const noteList = element('div', 'science-note-list'); aside.append(asideHead, noteList);
    const notes = [];
    sections.forEach(section => {
      section.querySelectorAll('.story-concepts').forEach(original => {
        const label = original.querySelector('.story-concepts-label')?.textContent?.trim();
        const definition = definitions[label];
        if (!definition) return;
        const [key, number] = definition;
        const note = element('details', 'science-note'); note.id = 'science-' + key;
        const summary = element('summary', 'science-summary');
        summary.append(element('span', 'science-number', number), element('span', '', label), element('span', 'science-toggle', '+'));
        summary.lastElementChild.setAttribute('aria-hidden', 'true');
        const body = element('div', 'science-note-body');
        const items = [...original.querySelectorAll('.story-concept')];
        items.forEach(item => {
          const term = item.querySelector('strong')?.textContent || '';
          const text = item.querySelector('span')?.textContent || '';
          let url;
          try { url = new URL(text); } catch (_) { /* Prose, not a source URL. */ }
          if (url?.protocol === 'https:') {
            const p = element('p', 'science-source');
            const a = element('a', '', term); a.href = url.href; a.target = '_blank'; a.rel = 'noopener noreferrer';
            a.setAttribute('aria-label', term + ' (opens in a new tab)'); p.append(a); body.append(p);
          } else {
            body.append(element('h3', '', term));
            text.split(/\n\s*\n/).forEach(paragraph => body.append(element('p', '', paragraph)));
          }
        });
        const conclusion = original.querySelector('.story-concepts-conclusion');
        if (conclusion) {
          const p = element('p', 'science-takeaway', conclusion.textContent);
          const firstSource = body.querySelector('.science-source');
          if (firstSource) body.insertBefore(p, firstSource); else body.append(p);
        }
        const slot = element('div', 'science-inline-slot');
        const previous = original.previousElementSibling;
        let ref;
        if (key !== 'sources') {
          ref = element('a', 'science-ref', number + '  ' + label);
          ref.href = '#' + note.id; ref.setAttribute('aria-controls', note.id); ref.setAttribute('aria-expanded', 'false');
          slot.append(ref); original.replaceWith(slot);
          if (previous) { previous.id = 'story-' + key; previous.tabIndex = -1; }
          const back = element('a', 'science-return', 'Back to the story');
          back.href = '#story-' + key; back.dataset.returnNote = key; body.append(back);
        } else original.remove();
        note.append(summary, body); noteList.append(note);
        notes.push({key, note, summary, ref, slot, previous, section});
        note.addEventListener('toggle', () => {
          if (note.open && !mobile.matches) notes.forEach(item => {if (item.note !== note) item.note.open = false;});
          if (ref) ref.setAttribute('aria-expanded', String(note.open));
          summary.lastElementChild.textContent = note.open ? '−' : '+';
        }, {signal});
      });
      story.append(section);
    });
    columns.append(story, aside); root.append(nav, columns); host.replaceChildren(root);
    let firstLayout = true, frame = 0;
    const layout = () => {
      notes.forEach(item => {
        if (mobile.matches && item.key !== 'sources') item.slot.append(item.note);
        else noteList.append(item.note);
        if (firstLayout) item.note.open = !mobile.matches && item.key === 'quantum';
      });
      firstLayout = false;
      aside.classList.toggle('is-mobile-sources', mobile.matches);
    };
    const measure = () => {
      root.style.setProperty('--science-header', Math.ceil(document.querySelector('.site-header')?.getBoundingClientRect().height || 80) + 'px');
      root.style.setProperty('--science-nav', Math.ceil(nav.getBoundingClientRect().height) + 'px');
    };
    const activePart = () => {
      const threshold = (document.querySelector('.site-header')?.getBoundingClientRect().height || 80) + nav.getBoundingClientRect().height + 55;
      let active = sections[0];
      sections.forEach(section => {if (section.getBoundingClientRect().top <= threshold) active = section;});
      if (scrollY + innerHeight >= document.documentElement.scrollHeight - 3) active = sections[sections.length - 1];
      nav.querySelectorAll('[data-story-part]').forEach(a => {
        if (a.dataset.storyPart === active.id) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
      });
    };
    const moveTo = target => {
      const offset = (document.querySelector('.site-header')?.getBoundingClientRect().height || 80) + nav.getBoundingClientRect().height + 25;
      window.scrollTo({top:Math.max(0, target.getBoundingClientRect().top + scrollY - offset), behavior:reduced.matches ? 'instant' : 'smooth'});
      target.focus?.({preventScroll:true});
    };
    const openNote = item => {
      if (!mobile.matches) notes.forEach(entry => {if (entry !== item) entry.note.open = false;});
      item.note.open = true;
      if (mobile.matches) moveTo(item.summary);
      else {
        const scroll = item.note.getBoundingClientRect().top - aside.getBoundingClientRect().top + aside.scrollTop - 75;
        aside.scrollTo({top:Math.max(0, scroll), behavior:reduced.matches ? 'instant' : 'smooth'});
        item.summary.focus({preventScroll:true});
      }
    };
    const hashAction = () => {
      const id = location.hash.slice(1);
      const item = notes.find(entry => entry.note.id === id);
      if (item) openNote(item);
      else {const target = document.getElementById(id); if (target && story.contains(target)) moveTo(target);}
    };
    root.addEventListener('click', event => {
      const link = event.target.closest('a[href^="#"]');
      if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const id = link.hash.slice(1), target = document.getElementById(id);
      if (!target) return;
      event.preventDefault();
      const item = notes.find(entry => entry.note.id === id);
      if (item) openNote(item);
      else if (link.dataset.returnNote) {
        const current = notes.find(entry => entry.key === link.dataset.returnNote);
        if (mobile.matches && current) current.note.open = false;
        moveTo(target);
      } else { target.tabIndex = -1; moveTo(target); }
      if (location.hash !== link.hash) history.pushState(null, '', link.hash);
    }, {signal});
    const scroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => { frame = 0; activePart(); });
    };
    mobile.addEventListener('change', () => {layout(); measure(); activePart();}, {signal});
    window.addEventListener('scroll', scroll, {passive:true, signal});
    window.addEventListener('hashchange', hashAction, {signal});
    window.addEventListener('popstate', hashAction, {signal});
    const observer = new ResizeObserver(measure);
    const header = document.querySelector('.site-header'); if (header) observer.observe(header); observer.observe(nav);
    layout(); measure(); activePart(); hashAction();
    dispose = () => {controller.abort(); observer.disconnect(); cancelAnimationFrame(frame);};
  }
  const schedule = () => {if (!queued) {queued = true; queueMicrotask(enhance);}};
  new MutationObserver(schedule).observe(reader, {childList:true, subtree:true});
  window.addEventListener('ronu:navigate', schedule);
  schedule();
})();
