'use strict';
/** Text-first articles, using the shared site shell and landing design tokens.
 * Prose stays in a same-origin JSON file.
 */
const narrativeCache = new Map();
let articleController = null, pendingAnchor = '';
function stopArticle() {
  if (articleController) {articleController.abort(); articleController = null;}
}
function goAnchor(id) {
  const target = document.getElementById(id);
  if (target && !target.closest('[hidden]')) {
    target.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start'});
    pendingAnchor = '';
  } else pendingAnchor = id;
}
// Blocks are structured data, never raw HTML. Existing paragraph-only articles still work.
function narrativeBlocks(section) {
  const hasParagraphs = Array.isArray(section.paragraphs);
  const hasBlocks = Array.isArray(section.blocks);
  if (hasParagraphs === hasBlocks) throw new Error('Use paragraphs or blocks, not both');
  const blocks = hasParagraphs ? section.paragraphs.map(text => ({type: 'paragraph', text})) : section.blocks;
  const text = value => typeof value === 'string' && value.trim().length > 0;
  if (!blocks.length || blocks.length > 300) throw new Error('Invalid article blocks');
  for (const block of blocks) {
    if (!block || !['paragraph', 'code', 'table', 'fraction', 'concepts'].includes(block.type)) throw new Error('Invalid block type');
    if (block.label !== undefined && !text(block.label)) throw new Error('Invalid block label');
    if (block.type === 'table') {
      if (!text(block.label) || !Array.isArray(block.columns) || !block.columns.length || block.columns.length > 8 ||
          !block.columns.every(text) || !Array.isArray(block.rows) || !block.rows.length || block.rows.length > 100 ||
          !block.rows.every(row => Array.isArray(row) && row.length === block.columns.length && row.every(text))) {
        throw new Error('Invalid article table');
      }
    } else if (block.type === 'code') {
      if (!text(block.text) || !text(block.label)) throw new Error('Invalid article formula');
    } else if (block.type === 'fraction') {
      if (!text(block.label) || !text(block.numerator) || !text(block.denominator) ||
          !text(block.percent) || !text(block.note)) throw new Error('Invalid article fraction');
    } else if (block.type === 'concepts') {
      if (block.label !== undefined && !text(block.label)) throw new Error('Invalid concepts label');
      if (!Array.isArray(block.items) || !block.items.length || block.items.length > 8 ||
          !block.items.every(item => item && text(item.term) && text(item.text)) ||
          (block.conclusion !== undefined && !text(block.conclusion))) {
        throw new Error('Invalid article concepts');
      }
    } else {
      const runs = Array.isArray(block.runs);
      if (runs === (block.text !== undefined) || (!runs && !text(block.text)) ||
          (runs && (!block.runs.length || !block.runs.every(run => run && text(run.text) &&
            (run.strong === undefined || typeof run.strong === 'boolean')))) ||
          (block.highlight !== undefined && typeof block.highlight !== 'boolean')) {
        throw new Error('Invalid article paragraph');
      }
    }
  }
  return blocks;
}
function narrativeSections(value, expectedId) {
  if (!value || value.id !== expectedId || !Array.isArray(value.sections) || !value.sections.length || value.sections.length > 50) {
    throw new Error('Invalid article structure');
  }
  const ids = new Set(), anchors = new Set();
  return value.sections.map((section, index) => {
    if (!section || !/^[a-z][a-z0-9-]*$/.test(section.id) || ids.has(section.id) ||
        (section.heading !== undefined && (typeof section.heading !== 'string' || !section.heading.trim()))) {
      throw new Error('Invalid article section');
    }
    // Optional anchors preserve existing part-N URLs when migrating a legacy reader.
    const anchor = section.anchor || 'part-' + (index + 1);
    if (!/^(part-[1-9][0-9]*|article-opening)$/.test(anchor) || anchors.has(anchor)) throw new Error('Invalid section anchor');
    ids.add(section.id); anchors.add(anchor);
    return {...section, anchor, blocks: narrativeBlocks(section)};
  });
}
function narrativeBlockMarkup(block) {
  const lines = text => esc(text).replace(/\n/g, '<br>');
  if (block.type === 'paragraph') {
    const content = block.runs ? block.runs.map(run => run.strong ? '<strong>' + lines(run.text) + '</strong>' : lines(run.text)).join('') : lines(block.text);
    return `<p${block.highlight ? ' class="story-highlight"' : ''}>${content}</p>`;
  }
  if (block.type === 'code') {
    return `<pre class="story-code" tabindex="0" role="region" aria-label="${esc(block.label)}"><code>${esc(block.text)}</code></pre>`;
  }
  if (block.type === 'fraction') {
    return `<figure class="story-fraction" aria-label="${esc(block.label)}">
      <div class="story-fraction-main">
        <figcaption>${esc(block.label)}</figcaption>
        <div class="story-fraction-formula" aria-label="${esc(block.label)}: ${esc(block.numerator)} over ${esc(block.denominator)}, approximately ${esc(block.percent)}">
          <span class="story-fraction-name">P(6)</span><span class="story-fraction-equals">=</span>
          <span class="story-fraction-stack"><span>${esc(block.numerator)}</span><span>${esc(block.denominator)}</span></span>
          <span class="story-fraction-equals">≈</span><strong>${esc(block.percent)}</strong>
        </div>
      </div>
      <p class="story-fraction-note">${esc(block.note)}</p>
    </figure>`;
  }
  if (block.type === 'concepts') {
    return `<aside class="story-concepts"${block.label ? ` aria-label="${esc(block.label)}"` : ''}>
      ${block.label ? `<p class="story-concepts-label">${esc(block.label)}</p>` : ''}
      <div class="story-concepts-list">${block.items.map(item => `<div class="story-concept"><strong>${esc(item.term)}</strong><span>${esc(item.text)}</span></div>`).join('')}</div>
      ${block.conclusion ? `<p class="story-concepts-conclusion">${esc(block.conclusion)}</p>` : ''}
    </aside>`;
  }
  return `<div class="story-table" tabindex="0" role="region" aria-label="${esc(block.label)}"><table aria-label="${esc(block.label)}"><thead><tr>${block.columns.map(text => `<th scope="col">${esc(text)}</th>`).join('')}</tr></thead><tbody>${block.rows.map(row => `<tr>${row.map(text => `<td>${esc(text)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function renderNarrative(topic) {
  stopArticle();
  pendingAnchor = '';
  currentTopic = topic;
  // Reuse the exact palette, page width and display fonts of the main pages.
  document.body.dataset.pageMode = 'landing';
  $('#browse-page').hidden = true;
  const reader = $('#reader-page');
  reader.hidden = false;
  reader.classList.add('story-reader');
  $('#reading-progress').hidden = false;
  renderNavigation(topic.section);
  const back = routeFor(topic.section);
  const sectionName = SECTIONS[topic.section].name;
  reader.innerHTML = `<div class="reader-top story-top"><a class="quiet-link" href="${back}">${icon('back')}Back to ${esc(sectionName)}</a></div>
    <article class="story-article" id="article-start" aria-labelledby="reader-title">
      <header class="story-header">
        <p class="story-kicker">${esc(sectionName)} / ${esc(topic.type)}</p>
        <h1 class="index-title story-title" id="reader-title" tabindex="-1">${esc(topic.title)}</h1>
      </header>
      <nav class="story-index" id="story-index" aria-label="On this page" hidden></nav>
      <div class="story-body" id="narrative-content" aria-busy="true"></div>
      <nav class="story-bottom" aria-label="Article navigation">
        <a class="quiet-link" href="${back}">${icon('back')}Back to ${esc(sectionName)}</a>
        <a class="quiet-link" href="#explore">Explore sections ${arrow}</a>
      </nav>
    </article>`;
  document.title = topic.title + ' — ' + SITE.name;
  loadNarrative(topic);
  updateProgress();
}
async function loadNarrative(topic) {
  stopArticle();
  const controller = new AbortController();
  articleController = controller;
  const host = $('#narrative-content');
  const isCurrent = () => !controller.signal.aborted && currentTopic?.id === topic.id && $('#narrative-content') === host;
  host.setAttribute('aria-busy', 'true');
  host.innerHTML = '<p class="story-loading" role="status">Loading article…</p>';
  let timeout;
  try {
    const key = topic.id + ':' + (topic.articleVersion || '');
    let sections = narrativeCache.get(key);
    if (!sections) {
      if (!/^articles\/[a-z0-9-]+\.json$/.test(topic.articleFile)) throw new Error('Invalid article path');
      // Relative to the website: no dependency on external raw-source hosts.
      timeout = setTimeout(() => {
        if (isCurrent()) {
          showNarrativeError(host, topic);
          controller.abort();
        }
      }, 12000);
      const response = await fetch(topic.articleFile + '?v=' + encodeURIComponent(topic.articleVersion || '1'), {
        signal: controller.signal, credentials: 'same-origin', referrerPolicy: 'no-referrer'
      });
      if (!response.ok) throw new Error('Article HTTP ' + response.status);
      const text = await response.text();
      if (text.length > 200000) throw new Error('Article exceeds size limit');
      sections = narrativeSections(JSON.parse(text), topic.id);
      if (!isCurrent()) return;
      narrativeCache.set(key, sections);
    }
    if (!isCurrent()) return;
    host.innerHTML = sections.map((section, index) => `<section class="story-section" id="${esc(section.anchor)}"${section.heading ? ' aria-labelledby="story-heading-' + index + '"' : ' aria-label="Article opening"'}>
      ${section.heading ? `<h2 id="story-heading-${index}">${esc(section.heading)}</h2>` : ''}
      ${section.blocks.map(narrativeBlockMarkup).join('')}
    </section>`).join('');
    host.setAttribute('aria-busy', 'false');
    if (pendingAnchor) goAnchor(pendingAnchor);
    updateProgress();
  } catch (error) {
    if (isCurrent()) showNarrativeError(host, topic);
  } finally {
    clearTimeout(timeout);
  }
}
function showNarrativeError(host, topic) {
  host.setAttribute('aria-busy', 'false');
  host.innerHTML = '<div class="story-error" role="status"><p>The article could not load. Please try again.</p><button type="button" class="small-cta" data-retry-story>Retry</button></div>';
  $('[data-retry-story]', host).addEventListener('click', () => loadNarrative(topic));
}
