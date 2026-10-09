'use strict';
/** Generate GitHub Pages files using the same renderers as client-side navigation. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const site = path.join(root, 'docs');
const context = vm.createContext({URL});
for (const file of ['page-content.js', 'content.js', 'routes.js', 'main-pages.js', 'project.js', 'narrative.js']) {
  vm.runInContext(fs.readFileSync(path.join(site, file), 'utf8'), context, {filename: file});
}
const run = code => vm.runInContext(code, context);
const template = fs.readFileSync(path.join(__dirname, 'site-shell.html'), 'utf8');
const routes = run("['all', ...SITE.sectionOrder].map(pageId => ({pageId, path: routeFor(pageId)})).concat(TOPICS.map(topic => ({topic, path: topicPath(topic.id)})))");
const outputs = new Map();
for (const route of routes) {
  context.route = route;
  const metadata = run('routeMetadata(route)');
  let browse = '', reader = '', readerAttrs = 'hidden';
  if (route.topic) {
    context.article = JSON.parse(fs.readFileSync(path.join(site, route.topic.articleFile), 'utf8'));
    reader = run('narrativeMarkup(route.topic, narrativeSectionsMarkup(narrativeSections(article, route.topic.id)))');
    readerAttrs = run('`data-topic-id="${esc(route.topic.id)}" data-article-version="${esc(route.topic.articleVersion)}"`');
  } else {
    browse = run('`<section class="index-hero" id="page-intro" aria-labelledby="page-title">${mainHero(route.pageId)}</section><section class="page-collection" id="page-collection" aria-labelledby="collection-title"${pageCollection(route.pageId) ? "" : " hidden"}>${pageCollection(route.pageId)}</section>`');
  }
  // The hidden browse shell is needed when navigating from an article to a section.
  if (!browse) browse = '<section class="index-hero" id="page-intro" aria-labelledby="page-title"></section><section class="page-collection" id="page-collection" aria-labelledby="collection-title"></section>';
  context.active = route.topic?.section || route.pageId;
  const values = {
    TITLE: metadata.title, DESCRIPTION: metadata.description, CANONICAL: metadata.canonical,
    NAV: run("['all', ...SITE.sectionOrder].map(id => `<a href=\"${routeFor(id)}\" data-section=\"${id}\"${id === active ? ' aria-current=\"page\"' : ''}>${esc(MAIN_PAGES[id].name)}</a>`).join('')"),
    BROWSE_ATTRS: route.topic ? 'hidden' : `data-page="${route.pageId}"`, BROWSE: browse,
    READER_ATTRS: readerAttrs, READER_CLASS: route.topic ? ' story-reader' : '', READER: reader,
    PROGRESS_ATTRS: route.topic ? '' : 'hidden'
  };
  for (const key of ['TITLE', 'DESCRIPTION', 'CANONICAL']) {
    context.value = values[key]; values[key] = run('esc(value)');
  }
  const html = template.replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => {
    if (!Object.hasOwn(values, key)) throw new Error('Unknown template slot: ' + key);
    return values[key];
  });
  outputs.set(path.join(site, route.path, 'index.html'), html);
}
outputs.set(path.join(site, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  [...routes.map(route => route.path), '/privacy/'].map(route => `  <url><loc>https://ronu.one${route}</loc></url>`).join('\n') + '\n</urlset>\n');
const check = process.argv.includes('--check');
let stale = false;
for (const [file, content] of outputs) {
  if (check) {
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') !== content.replace(/\r\n/g, '\n')) {
      console.error('Regenerate ' + path.relative(root, file)); stale = true;
    }
  } else {
    fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, content);
  }
}
if (stale) process.exitCode = 1;
else console.log(`${check ? 'Verified' : 'Generated'} ${routes.length} static pages and sitemap.xml.`);
