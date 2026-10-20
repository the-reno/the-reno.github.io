'use strict';
/** Shared presentation only. All editable wording is in page-content.js. */
function introMarkup(page, {slide = false} = {}) {
  const paragraphs = String(page.intro || '').split(/\n\s*\n/).filter(text => text.trim());
  const visible = slide ? paragraphs.slice(0, SITE.carousel.introParagraphs) : paragraphs;
  if (!visible.length) return '';
  return `<div class="index-intro">${visible.map(text => `<p>${esc(text)}</p>`).join('')}</div>`;
}
function mainHero(pageId, {slide = false} = {}) {
  const page = MAIN_PAGES[pageId];
  if (pageId === 'all' && !slide) {
    const [welcome, ...purpose] = page.intro.split('\n');
    return `<div class="index-copy home-hero-copy"><div class="home-hero-heading"><h1 class="index-title" id="page-title" tabindex="-1">${esc(page.name)}<span>.</span></h1><p class="index-statement is-inline">${esc(page.start)}<em>${esc(page.end)}</em></p></div><div class="index-intro home-hero-intro"><p class="home-welcome">${esc(welcome)}</p><p>${esc(purpose.join(' '))}</p></div></div>`;
  }
  const heading = slide ? 'h3' : 'h1';
  const id = slide ? 'section-title-' + pageId : 'page-title';
  return `<div class="index-copy"><${heading} class="index-title" id="${id}"${slide ? '' : ' tabindex="-1"'}>${esc(page.name)}<span>.</span></${heading}><p class="index-statement${page.breakSentence === false ? ' is-inline' : ''}">${esc(page.start)}<em>${esc(page.end)}</em></p>${introMarkup(page, {slide})}</div>`;
}
function articleIcon(kind) {
  const paths = {
    endurance: '<path d="M3 12h4l3-7 4 14 3-7h4"/>',
    science: '<circle cx="12" cy="12" r="1.5"/><ellipse cx="12" cy="12" rx="10" ry="4"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)"/>',
    prediction: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 8h.01M16 8h.01M12 12h.01M8 16h.01M16 16h.01" stroke-width="3"/>',
    markets: '<path d="M4 4v16h16M7 16l4-5 4 2 5-7M16 6h4v4"/>',
    maker: '<path d="m12 3 9 5v9l-9 5-9-5V8l9-5Zm0 10 9-5m-9 5L3 8m9 5v9"/>',
    article: '<path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6M9 16h6"/>'
  };
  return `<span class="article-tile-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" focusable="false">${paths[kind] || paths.article}</svg></span>`;
}
function articleTile(topic) {
  const preview = ARTICLE_PREVIEWS[topic.id] || {icon: 'article', summary: topic.description};
  return `<a class="article-tile" href="${topicPath(topic.id)}" aria-labelledby="card-${esc(topic.id)}" aria-describedby="summary-${esc(topic.id)}">${articleIcon(preview.icon)}<div class="article-tile-copy"><h3 id="card-${esc(topic.id)}">${esc(topic.title)}</h3><p class="article-tile-summary" id="summary-${esc(topic.id)}">${esc(preview.summary)}</p></div><span class="article-tile-arrow" aria-hidden="true">${arrow}</span></a>`;
}
function makerProjectTile(topic) {
  const preview = ARTICLE_PREVIEWS[topic.id];
  if (!preview?.image) return articleTile(topic);
  return `<a class="maker-project-feature" href="${topicPath(topic.id)}" aria-labelledby="card-${esc(topic.id)}" aria-describedby="summary-${esc(topic.id)}"><div class="maker-project-art"><img src="${esc(preview.image)}" alt="${esc(preview.alt)}" width="1600" height="1100" decoding="async"></div><div class="maker-project-copy"><p class="maker-project-kicker">3D + assembly</p><h3 id="card-${esc(topic.id)}">${esc(topic.title)}</h3><p id="summary-${esc(topic.id)}">${esc(preview.summary)}</p><span class="maker-project-cta">${esc(preview.action)} ${arrow}</span></div></a>`;
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
function homeSectionIcon(id) {
  const drawings = {
    triathlon: '<g stroke-width="1.8"><g class="home-icon-detail"><circle cx="8" cy="26" r="3"/><path d="m3 34 9-5 10-1m-10-3 8-8 7 5M2 40q3-3 6 0t6 0t6 0t6 0"/><circle cx="39" cy="37" r="7"/><circle cx="63" cy="37" r="7"/><path d="m39 37 8-11 5 11H39m8-11h11l-6 11m6-11 5 11m-6-11-1-4h5m-17 3h6"/><circle cx="50" cy="13" r="3"/><path d="m48 19-5 6 10 5-2 6m-3-17 7 4h4"/><circle cx="91" cy="12" r="3"/><path d="m88 19-5 11 9 6-3 9m-6-15-7 9-5 1m16-18 8 5 7-4m-15-3-7 3-3 6"/></g><g class="home-icon-accent"><path d="m12 25 8-8 7 5m21-3 7 4h4m29-4-5 11 9 6"/></g></g>',
    science: '<path class="home-icon-detail" d="m33 9 16 28H17L33 9ZM3 24h22m17 0h10m-7 6h10m-7 7h12"/><path class="home-icon-accent" d="m25 24 11-2 16-9m-16 9 21-1m-21 1 22 8"/>',
    markets: '<path class="home-icon-detail" d="M9 8v32h54M21 12v8m0 13v5m16-28v4m0 12v9m16-29v7m0 12v5"/><path class="home-icon-accent" d="M17 20h8v13h-8zM33 14h8v12h-8zM49 13h8v12h-8z"/>',
    maker: '<path class="home-icon-detail" d="m40 19 15 8v15l-15 8-15-8V27l15-8Zm0 16 15-8m-15 8-15-8m15 8v15" transform="translate(0 -5)"/><path class="home-icon-accent" d="m9 30 3-10L32 0l7 7-20 20-10 3Zm3-10 7 7M28 4l7 7" transform="translate(0 4)"/>'
  };
  return `<span class="home-section-icon${id === 'triathlon' ? ' is-triathlon' : ''}" aria-hidden="true"><svg viewBox="0 0 ${id === 'triathlon' ? '108' : '72'} 52" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" focusable="false">${drawings[id]}</svg></span>`;
}
function pageCollection(pageId) {
  const page = MAIN_PAGES[pageId];
  if (page.kind === 'sections') {
    const sections = SITE.sectionOrder.map(id => {
      const section = {...MAIN_PAGES[id], ...HOME_SECTIONS[id]};
      const statement = section.parts
        ? section.parts.map((text, i) => i % 2 ? `<em>${esc(text)}</em>` : esc(text)).join('')
        : `${esc(section.start)}<em>${esc(section.end)}</em>`;
      return `<a class="home-section" href="${routeFor(id)}" aria-labelledby="section-title-${id}" aria-describedby="section-summary-${id}"><div class="home-section-heading"><h3 id="section-title-${id}">${esc(section.name)}<span>.</span></h3>${homeSectionIcon(id)}</div><p id="section-summary-${id}" class="home-section-statement${section.parts ? ' is-continuous' : ''}">${statement}</p>${introMarkup(section, {slide: true})}</a>`;
    }).join('');
    return `<h2 class="collection-heading" id="collection-title">${esc(SITE.labels.sections)}</h2><div class="home-sections">${sections}</div>`;
  }
  if (page.kind === 'gallery') {
    const projects = (page.articleIds || []).map(id => TOPICS.find(topic => topic.id === id)).filter(Boolean);
    const images = MAKER_GALLERY.images.map(image => `<img src="${esc(image.src)}" alt="${esc(image.alt)}" width="${esc(image.width)}" height="${esc(image.height)}" decoding="async" draggable="false">`).join('');
    return `<h2 class="sr-only" id="collection-title">Maker</h2><div class="maker-billboard" role="group" aria-label="Three night scenes">${images}</div>${projects.map(makerProjectTile).join('')}`;
  }
  const topics = (page.articleIds || []).map(id => TOPICS.find(topic => topic.id === id)).filter(Boolean);
  if (!topics.length) return '';
  return `<h2 class="collection-heading" id="collection-title">${esc(SITE.labels.articles)}</h2><div class="article-grid">${topics.map(topic => articleTile(topic)).join('')}</div>`;
}



