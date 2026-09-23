'use strict';
/** Shared presentation only. All editable wording is in page-content.js. */
function mainHero(pageId, {slide = false} = {}) {
  const page = MAIN_PAGES[pageId];
  const heading = slide ? 'h3' : 'h1';
  const id = slide ? 'section-title-' + pageId : 'page-title';
  return `<div class="index-copy"><${heading} class="index-title" id="${id}"${slide ? '' : ' tabindex="-1"'}>${esc(page.name)}<span>.</span></${heading}><p class="index-statement${page.breakSentence === false ? ' is-inline' : ''}">${esc(page.start)}<em>${esc(page.end)}</em></p>${page.intro ? `<p class="index-intro">${esc(page.intro)}</p>` : ''}</div>`;
}
function articleIcon(kind) {
  const paths = {
    endurance: '<path d="M3 12h4l3-7 4 14 3-7h4"/>',
    prediction: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 8h.01M16 8h.01M12 12h.01M8 16h.01M16 16h.01" stroke-width="3"/>',
    markets: '<path d="M4 4v16h16M7 16l4-5 4 2 5-7M16 6h4v4"/>',
    maker: '<path d="m12 3 9 5v9l-9 5-9-5V8l9-5Zm0 10 9-5m-9 5L3 8m9 5v9"/>',
    article: '<path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6M9 16h6"/>'
  };
  return `<span class="article-tile-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" focusable="false">${paths[kind] || paths.article}</svg></span>`;
}
function articleTile(topic, {sample = false} = {}) {
  const preview = sample ? topic : ARTICLE_PREVIEWS[topic.id] || {icon: 'article', summary: topic.description};
  const tag = sample ? 'article' : 'a';
  return `<${tag} class="article-tile${sample ? ' is-sample' : ''}"${sample ? '' : ` href="#topic/${esc(topic.id)}"`} aria-labelledby="card-${esc(topic.id)}" aria-describedby="summary-${esc(topic.id)}${sample ? ' status-' + esc(topic.id) : ''}">${articleIcon(preview.icon)}<div class="article-tile-copy"><h3 id="card-${esc(topic.id)}">${esc(topic.title)}</h3><p class="article-tile-summary" id="summary-${esc(topic.id)}">${esc(preview.summary)}</p>${sample ? `<p class="article-tile-status" id="status-${esc(topic.id)}">${esc(topic.status)}</p>` : ''}</div>${sample ? '' : `<span class="article-tile-arrow" aria-hidden="true">${arrow}</span>`}</${tag}>`;
}
function carouselMarkup(id, items, kind) {
  const imageMode = kind === 'images';
  const labels = SITE.labels;
  const name = imageMode ? labels.images : labels.sections;
  return `<div class="media-carousel ${imageMode ? 'image-carousel' : 'section-carousel'}" id="${id}" data-carousel role="region" aria-roledescription="carousel" aria-label="${esc(name)}">
    <div class="carousel-controls">
      <button type="button" class="carousel-toggle" data-toggle>${icon('pause')}<span>${esc(labels.pause)}</span></button>
      <div class="carousel-dots" role="tablist" aria-label="${esc(imageMode ? labels.chooseImage : labels.chooseSection)}">${items.map((item, i) => `<button type="button" role="tab" id="${id}-tab-${i}" data-dot="${i}" aria-controls="${id}-panel-${i}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" aria-label="${esc(item.name)}" title="${esc(item.name)}"><span aria-hidden="true"></span></button>`).join('')}</div>
      <div class="carousel-arrows"><button type="button" data-step="-1" aria-label="${esc(labels.previous)} ${imageMode ? 'image' : 'section'}">${icon('back')}</button><button type="button" data-step="1" aria-label="${esc(labels.next)} ${imageMode ? 'image' : 'section'}">${arrow}</button></div>
    </div>
    <div class="carousel-slides">${items.map((item, i) => `<div class="carousel-slide${i === 0 ? ' is-active' : ''}" data-slide role="tabpanel" id="${id}-panel-${i}" aria-labelledby="${id}-tab-${i}" aria-hidden="${i !== 0}"${i ? ' inert' : ''}>${item.html}</div>`).join('')}</div>
    <p class="sr-only" data-status role="status" aria-live="polite" aria-atomic="true"></p>
  </div>`;
}
function pageCollection(pageId) {
  const page = MAIN_PAGES[pageId];
  if (page.kind === 'sections') {
    const slides = SITE.sectionOrder.map(id => ({name: MAIN_PAGES[id].name, html: `<a class="section-slide-link" href="#section/${id}" aria-labelledby="section-title-${id}"><div class="section-slide-marker">${articleIcon(MAIN_PAGES[id].icon)}</div>${mainHero(id, {slide: true})}<span class="section-slide-arrow" aria-hidden="true">${arrow}</span></a>`}));
    return `<h2 class="collection-heading" id="collection-title">${esc(SITE.labels.sections)}</h2>${carouselMarkup('section-carousel', slides, 'sections')}`;
  }
  if (page.kind === 'gallery') {
    const slides = MAKER_GALLERY.images.map(image => ({name: image.title, html: `<figure class="gallery-figure"><a class="gallery-link" href="${esc(image.src)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${esc(image.title)} in a new tab"><div class="gallery-image"><img src="${esc(image.src)}" alt="${esc(image.alt)}" decoding="async" draggable="false"><span class="gallery-error" hidden>${esc(SITE.labels.imageError)}</span></div><div class="gallery-caption"><span>${esc(image.title)}</span><span>${esc(SITE.labels.openImage)}</span></div></a></figure>`}));
    return `<h2 class="sr-only" id="collection-title">${esc(SITE.labels.images)}</h2><p class="gallery-description">${esc(MAKER_GALLERY.description)}</p>${carouselMarkup('maker-gallery', slides, 'images')}`;
  }
  const topics = (page.articleIds || []).map(id => TOPICS.find(topic => topic.id === id)).filter(Boolean);
  return `<h2 class="collection-heading" id="collection-title">${esc(SITE.labels.articles)}</h2><div class="article-grid">${topics.map(topic => articleTile(topic)).join('')}${page.sample ? articleTile(page.sample, {sample: true}) : ''}</div>`;
}
