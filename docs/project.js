'use strict';
/** Structured Maker content, shared by static generation and client navigation. */
const projectBlockTypes = new Set(['project-intro', 'project-model', 'project-list', 'project-steps', 'project-gallery', 'project-links']);
const projectAsset = value => typeof value === 'string' && /^\/assets\/garage-door\/[a-z0-9/_.-]+(?:\?embed=1)?$/.test(value) && !value.includes('..');
const projectText = value => typeof value === 'string' && value.trim().length > 0;
function projectLink(value) {
  if (projectAsset(value) || /^#(?:part-[1-9][0-9]*|article-opening)$/.test(value)) return true;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; }
}
function validateProjectBlock(block) {
  const strings = values => Array.isArray(values) && values.length > 0 && values.length <= 40 && values.every(projectText);
  const links = values => Array.isArray(values) && values.length > 0 && values.length <= 20 && values.every(item => item && projectText(item.label) && projectLink(item.href) && (item.note === undefined || projectText(item.note)) && (item.meta === undefined || projectText(item.meta)) && (item.download === undefined || typeof item.download === 'boolean'));
  const picture = item => item && projectAsset(item.src) && projectText(item.alt) && projectText(item.caption) && Number.isInteger(item.width) && item.width > 0 && Number.isInteger(item.height) && item.height > 0;
  if (block.type === 'project-intro') {
    if (!strings(block.paragraphs) || !picture(block) || !links(block.links) || !projectText(block.unitNote) || !projectText(block.status) || !Array.isArray(block.facts) || block.facts.length > 6 || !block.facts.every(item => projectText(item.label) && projectText(item.value)) || !links(block.contents)) throw new Error('Invalid project introduction');
  } else if (block.type === 'project-model') {
    if (block.src !== '/assets/garage-door/viewer/index.html?embed=1' || !projectText(block.label) || !projectText(block.note)) throw new Error('Invalid project model');
  } else if (block.type === 'project-list') {
    if (!strings(block.items)) throw new Error('Invalid project list');
  } else if (block.type === 'project-steps') {
    if (!Array.isArray(block.items) || !block.items.length || block.items.length > 30 || !block.items.every(item => projectText(item.title) && projectText(item.summary) && strings(item.actions) && projectText(item.check) && picture(item) && projectText(item.manual) && Number.isInteger(item.manualPage) && item.manualPage >= 1 && item.manualPage <= 27 && (item.cuts === undefined || strings(item.cuts)))) throw new Error('Invalid project steps');
  } else if (block.type === 'project-gallery') {
    if (!Array.isArray(block.items) || !block.items.length || block.items.length > 8 || !block.items.every(item => picture(item) && projectText(item.title))) throw new Error('Invalid project drawings');
  } else if (block.type === 'project-links') {
    if (!links(block.items)) throw new Error('Invalid project links');
  } else throw new Error('Unknown project block');
}
function projectImage(item, className = '') {
  return `<figure class="project-figure ${className}"><a href="${esc(item.src)}" target="_blank" rel="noopener" aria-label="Open full-size drawing: ${esc(item.alt)}"><img src="${esc(item.src)}" alt="${esc(item.alt)}" width="${item.width}" height="${item.height}" loading="lazy" decoding="async"></a><figcaption>${esc(item.caption)} <a href="${esc(item.src)}" target="_blank" rel="noopener">Open full size ${arrow}</a></figcaption></figure>`;
}
function projectBlockMarkup(block) {
  if (block.type === 'project-intro') return `<div class="project-intro"><div class="project-intro-copy">${block.paragraphs.map(text => `<p>${esc(text)}</p>`).join('')}<div class="project-actions">${block.links.map((item, i) => `<a class="project-button${i ? ' is-secondary' : ''}" href="${esc(item.href)}">${esc(item.label)} ${arrow}</a>`).join('')}</div></div><figure class="project-hero"><img src="${esc(block.src)}" alt="${esc(block.alt)}" width="1600" height="1100" fetchpriority="high"><figcaption>${esc(block.caption)}</figcaption></figure></div><dl class="project-facts">${block.facts.map(item => `<div><dt>${esc(item.label)}</dt><dd>${esc(item.value)}</dd></div>`).join('')}</dl><aside class="project-status"><strong>Before cutting</strong><p>${esc(block.status)}</p><p>${esc(block.unitNote)}</p></aside><nav class="project-contents" aria-label="On this project page"><span>On this page</span>${block.contents.map(item => `<a href="${esc(item.href)}">${esc(item.label)}</a>`).join('')}</nav>`;
  if (block.type === 'project-model') return `<div class="project-model"><div class="project-model-top"><p>${esc(block.note)}</p><a href="/assets/garage-door/viewer/index.html" target="_blank" rel="noopener">Open viewer ${arrow}</a></div><iframe class="project-model-frame" src="${esc(block.src)}" title="${esc(block.label)}" loading="lazy" referrerpolicy="no-referrer" allow="fullscreen" data-project-model></iframe><noscript><p>The model needs JavaScript. The cut list, drawings and all assembly instructions remain available below.</p></noscript></div>`;
  if (block.type === 'project-list') return `<ul class="project-list">${block.items.map(item => `<li>${esc(item)}</li>`).join('')}</ul>`;
  if (block.type === 'project-steps') return `<div class="project-steps"><div class="project-step-tools"><p>Open a step for its instructions and drawing.</p><button type="button" data-project-expand hidden>Expand all steps</button></div>${block.items.map((item, i) => `<details class="project-step"${i === 0 ? ' open' : ''}><summary><span class="project-step-number">${String(i + 1).padStart(2, '0')}</span><span><strong>${esc(item.title)}</strong><span class="project-step-summary">${esc(item.summary)}</span></span><span class="project-step-toggle" aria-hidden="true">+</span></summary><div class="project-step-body"><div class="project-step-copy">${item.cuts ? `<div class="project-step-cuts"><h3>Cuts and layout · cm</h3><ul>${item.cuts.map(text => `<li>${esc(text)}</li>`).join('')}</ul></div>` : ''}<ol>${item.actions.map(text => `<li>${esc(text)}</li>`).join('')}</ol><p class="project-step-check"><strong>Check</strong> ${esc(item.check)}</p><a class="project-manual-link" href="/assets/garage-door/garage-door-assembly-manual.pdf#page=${esc(item.manualPage)}" target="_blank" rel="noopener">${esc(item.manual)} ${arrow}</a></div>${projectImage(item, 'is-step')}</div></details>`).join('')}</div>`;
  if (block.type === 'project-gallery') return `<div class="project-gallery${block.items.length === 1 ? ' is-single' : ''}">${block.items.map(item => `<div class="project-drawing"><h3>${esc(item.title)}</h3>${projectImage(item)}</div>`).join('')}</div>`;
  if (block.type === 'project-links') return `<div class="project-link-list">${block.items.map(item => `<a href="${esc(item.href)}"${item.download ? ' download' : item.href.startsWith('https:') || item.href.includes('/viewer/') ? ' target="_blank" rel="noopener"' : ''}><span><strong>${esc(item.label)}</strong>${item.note ? `<span class="project-link-note">${esc(item.note)}</span>` : ''}</span><span class="project-link-end">${item.meta ? `<span>${esc(item.meta)}</span>` : ''}${arrow}</span></a>`).join('')}</div>`;
  throw new Error('Unrendered project block');
}

let projectController = null;
function stopProjectPage() {
  if (projectController) { projectController.abort(); projectController = null; }
}
function initProjectPage() {
  stopProjectPage();
  const article = document.querySelector('.project-article');
  if (!article) return;
  const controller = new AbortController(); projectController = controller;
  const {signal} = controller;
  const frame = article.querySelector('[data-project-model]');
  if (frame) {
    window.addEventListener('message', event => {
      if (event.origin !== location.origin || event.source !== frame.contentWindow || !event.data || event.data.type !== 'ronu:garage-door:resize' || event.data.version !== 1) return;
      const height = event.data.height;
      if (!Number.isFinite(height) || height < 400 || height > 5000) return;
      frame.style.height = Math.ceil(height) + 'px';
    }, {signal});
    // The iframe can finish before the parent reuses its prerendered page.
    const resize = () => {
      try { const main = frame.contentDocument?.querySelector('main'); if (main) frame.style.height = Math.ceil(main.getBoundingClientRect().height) + 'px'; } catch { /* Ordinary viewer link remains available. */ }
    };
    frame.addEventListener('load', resize, {signal}); resize();
  }
  const button = article.querySelector('[data-project-expand]');
  if (button) {
    const steps = [...article.querySelectorAll('.project-step')];
    const syncLabel = () => {button.textContent = steps.every(step => step.open) ? 'Collapse all steps' : 'Expand all steps';};
    button.hidden = false;
    steps.forEach(step => step.addEventListener('toggle', syncLabel, {signal}));
    syncLabel();
    button.addEventListener('click', () => {
      const open = steps.some(step => !step.open);
      steps.forEach(step => {step.open = open;});
      syncLabel();
    }, {signal});
  }
}
