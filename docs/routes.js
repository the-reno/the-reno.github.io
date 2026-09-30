'use strict';
/** Shared by the browser and static page builder. Fragments identify page anchors only. */
const SITE_ORIGIN = 'https://ronu.one';
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const icon = id => `<svg class="icon" aria-hidden="true"><use href="#i-${id}"/></svg>`;
const arrow = icon('arrow');
function routeFor(id) {return id === 'all' ? '/' : '/section/' + id + '/';}
function topicPath(id) {return '/topic/' + id + '/';}
function readRoute(url) {
  let path = url.pathname.replace(/\/index\.html$/, '/');
  let anchor = url.hash.slice(1), search = url.search;
  const legacy = url.hash.match(/^#(explore|section\/[a-z0-9-]+|topic\/[a-z0-9-]+(?:\/(?:part-\d+|article-start|article-opening))?)(?:\?([^#]*))?$/);
  if (legacy) {
    const [kind, id, part] = legacy[1].split('/');
    path = kind === 'explore' ? '/' : '/' + kind + '/' + id + '/';
    anchor = part || '';
    if (legacy[2]) search = '?' + legacy[2];
  }
  const aliases = {
    endurance: topicPath('sunlight-to-step'), 'chaos-motion': topicPath('sunlight-to-step'),
    'body-mechanics': routeFor('triathlon'), arms: routeFor('triathlon'),
    spark: routeFor('science'), traffic: routeFor('science'), 'dice-storm': routeFor('science')
  };
  const oldId = path.match(/^\/topic\/([a-z0-9-]+)\/?$/)?.[1];
  if (oldId && Object.hasOwn(aliases, oldId)) path = aliases[oldId];
  const topicId = path.match(/^\/topic\/([a-z0-9-]+)\/?$/)?.[1];
  const topic = TOPICS.find(item => item.id === topicId);
  if (topic) return {topic, path: topicPath(topic.id), anchor, search};
  const pageId = path === '/' ? 'all' : path.match(/^\/section\/([a-z0-9-]+)\/?$/)?.[1];
  if (pageId && Object.hasOwn(MAIN_PAGES, pageId)) return {pageId, path: routeFor(pageId), anchor, search};
  // Unknown old fragments used to fall back to the underlying page. Do not reload
  // that same invalid fragment indefinitely; unknown real paths still return 404.
  if (legacy) return readRoute(new URL(url.origin + url.pathname + url.search));
  return null;
}
function routeMetadata(route) {
  const topic = route.topic, page = MAIN_PAGES[route.pageId];
  return {
    title: topic ? topic.title + ' — ' + SITE.name : SITE.name + ' — ' + page.name,
    description: topic ? topic.description : route.pageId === 'all' ? SITE.description : page.start + page.end,
    canonical: SITE_ORIGIN + route.path
  };
}
// Preserve the private records service's existing identifiers across the URL migration.
function recordRoute() {
  const route = readRoute(new URL(location.href));
  return route?.topic ? '/article/' + route.topic.id : route?.pageId === 'all' ? '/' : route ? '/section/' + route.pageId : null;
}
