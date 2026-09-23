'use strict';
/** Routing and lifecycle. No landing-page wording or page-specific HTML here. */
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const icon = id => `<svg class="icon" aria-hidden="true"><use href="#i-${id}"/></svg>`;
const arrow = icon('arrow');
// Reader compatibility: these are consumed by the existing reader.js implementation.
let currentTopic = null, lastBrowseHash = '#explore', observer = null;
let pageCarousel = null, scrollTick = false;
const carouselStates = new Map();
const searchDialog = $('#search-dialog');
function routeFor(id) {return id === 'all' ? '#explore' : '#section/' + id;}
function destroyCarousel() {
  if (pageCarousel) {carouselStates.set(pageCarousel.root.id, pageCarousel.destroy()); pageCarousel = null;}
}
function renderNavigation(active) {
  $$('.nav a').forEach(link => link.dataset.section === active ? link.setAttribute('aria-current', 'page') : link.removeAttribute('aria-current'));
}
function renderBrowse(pageId) {
  destroyCarousel();
  stopArticle();
  $('#reader-page').replaceChildren();
  if (observer) {observer.disconnect(); observer = null;}
  currentTopic = null;
  document.body.dataset.pageMode = 'landing';
  $('#browse-page').hidden = false;
  $('#reader-page').hidden = true;
  $('#reading-progress').hidden = true;
  $('#browse-page').dataset.page = pageId;
  // Every landing page uses this exact structure; only the data and collection vary.
  $('#page-intro').innerHTML = mainHero(pageId);
  const collection = pageCollection(pageId);
  $('#page-collection').innerHTML = collection;
  $('#page-collection').hidden = !collection;
  const root = $('#page-collection [data-carousel]');
  if (root) pageCarousel = new RonuCarousel(root, carouselStates.get(root.id));
  renderNavigation(pageId);
  lastBrowseHash = routeFor(pageId);
  document.title = SITE.name + ' — ' + MAIN_PAGES[pageId].name;
}
function navigate() {
  if (searchDialog.open) searchDialog.close();
  const hash = location.hash || '#explore';
  if (hash === '#main') {$('#main').focus(); return;}
  const [path, query = ''] = hash.slice(1).split('?');
  const [kind, id, anchor] = path.split('/');
  const topic = kind === 'topic' && TOPICS.find(item => item.id === id);
  if (topic) {
    destroyCarousel();
    document.body.dataset.pageMode = 'reader';
    if (currentTopic?.id !== topic.id) {
      lastBrowseHash = routeFor(topic.section);
      renderReader(topic);
      $('.reader-top .quiet-link').innerHTML = icon('back') + 'Back to ' + esc(SECTIONS[topic.section].name);
      window.scrollTo({top: 0, behavior: 'instant'});
      $('#reader-title').focus({preventScroll: true});
    }
    if (anchor && /^(part-\d+|article-start|experiment)$/.test(anchor)) goAnchor(anchor);
    return;
  }
  const pageId = kind === 'section' && Object.hasOwn(MAIN_PAGES, id) ? id : 'all';
  renderBrowse(pageId);
  window.scrollTo({top: 0, behavior: 'instant'});
  $('#page-title').focus({preventScroll: true});
  if (MAIN_PAGES[pageId].kind === 'gallery' && new URLSearchParams(query).get('gallery') === 'images') {
    requestAnimationFrame(() => $('#page-collection').scrollIntoView({block: 'start', behavior: 'instant'}));
  }
}
function updateProgress() {
  if (!currentTopic) return;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  $('#reading-progress span').style.width = (max > 0 ? Math.min(100, Math.max(0, window.scrollY / max * 100)) : 100) + '%';
}
function renderSearch() {
  const query = $('#global-search').value.trim().toLocaleLowerCase();
  const words = query.split(/\s+/).filter(Boolean);
  const match = text => words.every(word => text.toLocaleLowerCase().includes(word));
  const sections = SITE.sectionOrder.filter(id => {const p = MAIN_PAGES[id]; return match(p.name + ' ' + p.start + p.end + ' ' + p.intro);});
  const topics = query ? TOPICS.filter(t => match(t.title + ' ' + t.description + ' ' + SECTIONS[t.section].name + ' ' + t.type + ' ' + (t.tags || ''))) : [];
  const sectionRows = sections.map(id => `<a class="search-result" href="${routeFor(id)}"><span class="result-symbol">${icon(id)}</span><span class="result-copy"><strong>${esc(MAIN_PAGES[id].name)}</strong><span>${esc(MAIN_PAGES[id].start + MAIN_PAGES[id].end)}</span></span>${arrow}</a>`).join('');
  const topicRows = topics.map(t => `<a class="search-result" href="#topic/${t.id}"><span class="result-symbol">${icon(t.section)}</span><span class="result-copy"><strong>${esc(t.title)}</strong><span>${esc(SECTIONS[t.section].name)} · ${esc(t.type)}</span></span>${arrow}</a>`).join('');
  $('#search-results').innerHTML = (sectionRows ? `<p class="search-group-title">${esc(SITE.labels.sections)}</p>` + sectionRows : '') + (topicRows ? `<p class="search-group-title">${esc(SITE.labels.articles)}</p>` + topicRows : '') || '<div class="search-no-results">No results found. Try a different word.</div>';
  $('#search-result-count').textContent = query ? (sections.length + topics.length) + ' results' : 'Choose a section or search for a topic';
}
function openSearch() {$('#global-search').value = ''; renderSearch(); searchDialog.showModal(); $('#global-search').focus();}
// Navigation order is shared with the Explore carousel, not duplicated in HTML.
$('.nav').innerHTML = ['all', ...SITE.sectionOrder].map(id => `<a href="${routeFor(id)}" data-section="${id}">${esc(MAIN_PAGES[id].name)}</a>`).join('');
$('.footer-inner > p').textContent = SITE.footer;
$('#global-search').placeholder = SITE.labels.searchPlaceholder;
$('#search-open').addEventListener('click', openSearch);
$('#search-close').addEventListener('click', () => searchDialog.close());
$('#global-search').addEventListener('input', renderSearch);
$('#search-results').addEventListener('click', event => {if (event.target.closest('a')) searchDialog.close();});
[searchDialog].forEach(dialog => dialog.addEventListener('click', event => {
  const r = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) dialog.close();
}));
document.addEventListener('keydown', event => {
  if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName) && !document.activeElement.isContentEditable) {event.preventDefault(); if (!searchDialog.open) openSearch();}
  if (event.key === 'Escape') {
    if (searchDialog.open) {event.preventDefault(); searchDialog.close();}
  }
  if (event.key === 'Escape' && $('#original-app')?.classList.contains('is-expanded')) {
    $('#original-app').classList.remove('is-expanded');
    $('#expand-app').textContent = 'Expand'; $('#expand-app').setAttribute('aria-pressed', 'false'); $('#expand-app').focus();
  }
});
window.addEventListener('hashchange', navigate);
window.addEventListener('scroll', () => {if (!scrollTick) {requestAnimationFrame(() => {updateProgress(); scrollTick = false;}); scrollTick = true;}}, {passive: true});
window.addEventListener('resize', updateProgress);
navigate();
