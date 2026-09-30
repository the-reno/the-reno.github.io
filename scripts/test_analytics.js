'use strict';
// Exercise production tracker lifecycles without contacting Google or Cloudflare.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {Event, EventTarget} = require('node:events');
const NativeEvent = Event || globalThis.Event;
const NativeTarget = EventTarget || globalThis.EventTarget;
const site = path.resolve(__dirname, '../docs');
const consentKey = 'ronu.statistics-setting.v2';
const excludeKey = 'ronu.statistics-excluded.v2';
const id = 'G-EWVTJ4SBS2';
let checks = 0;
function check(value, message) {assert.ok(value, message); checks++;}
function fixture({allowed, excluded, age = 0, signals = {}, blockedStorage = false, host = 'ronu.one'} = {}) {
  const store = new Map();
  if (allowed !== undefined) store.set(consentKey, JSON.stringify({allowed, at: Date.now() - age}));
  if (excluded) store.set(excludeKey, '1');
  const elements = new Map(['analytics-status', 'statistics-toggle', 'statistics-value'].map(key => [key, new NativeTarget()]));
  const cookies = new Map([['_ga', 'test-id'], ['necessary', 'keep']]);
  const scripts = [], requests = [], intervals = [];
  const win = new NativeTarget();
  const document = Object.assign(new NativeTarget(), {
    title: 'Ronu.one — Explore', visibilityState: 'visible',
    documentElement: {scrollHeight: 2000}, body: {scrollHeight: 2000},
    head: {append: script => scripts.push(script)},
    canonical: 'https://ronu.one/',
    querySelector: selector => selector === 'link[rel="canonical"]' ? {href: document.canonical} : null,
    getElementById: key => elements.get(key), createElement: tag => ({tag})
  });
  Object.defineProperty(document, 'cookie', {
    get: () => [...cookies].map(([k, v]) => k + '=' + v).join('; '),
    set: value => {const [name, val] = value.split(';')[0].split('='); if (value.includes('Max-Age=0')) cookies.delete(name); else cookies.set(name, val);}
  });
  let reloads = 0, ticks = 0, nextId = 0;
  const location = {hostname: host, pathname: '/', href: 'https://' + host + '/', reload: () => reloads++};
  const context = vm.createContext({window: win, document, navigator: signals, location, URL, Event: NativeEvent,
    localStorage: {getItem: key => {if (blockedStorage) throw Error('blocked'); return store.get(key) || null;},
      setItem: (key, value) => {if (blockedStorage) throw Error('blocked'); store.set(key, value);}},
    crypto: {randomUUID: () => 'local-test-' + ++nextId}, performance: {now: () => ticks},
    scrollY: 0, innerHeight: 900, setTimeout: () => {}, setInterval: callback => intervals.push(callback),
    fetch: (url, options) => {requests.push({url, body: JSON.parse(options.body)}); return Promise.resolve({ok: true});},
    recordRoute: () => location.pathname.replace(/^\/topic\/(.+)\/$/, '/article/$1')});
  for (const file of ['records-config.js', 'analytics-config.js', 'privacy-controls.js', 'visits.js', 'analytics.js']) {
    vm.runInContext(fs.readFileSync(path.join(site, file), 'utf8'), context, {filename: file});
  }
  return {win, store, scripts, requests, elements, cookies, document, location,
    get reloads() {return reloads;},
    commands: () => (win.dataLayer || []).map(args => Array.from(args)),
    event: name => win.dispatchEvent(new NativeEvent(name)),
    toggle: checked => {const element = elements.get('statistics-toggle'); element.checked = checked; element.dispatchEvent(new NativeEvent('change'));},
    tick: ms => {ticks += ms; intervals.forEach(callback => callback());},
    navigate: pathname => {location.pathname = pathname; location.href = 'https://' + host + pathname + '?email=private@example.com#private'; document.canonical = 'https://ronu.one' + pathname; document.title = 'Article — Ronu.one'; win.dispatchEvent(new NativeEvent('ronu:navigate'));}
  };
}

let f = fixture();
check(f.scripts.length === 1 && f.commands().length > 0, 'Google statistics start by default');
check(f.requests.length === 1, 'Site statistics start by default');
check(f.cookies.has('_ga') && f.cookies.has('necessary'), 'Default-on leaves existing statistics cookies available');
f.tick(30000);
check(f.requests.at(-1).body.active_seconds === 30, 'Default-on engagement continues');

f = fixture({allowed: true});
check(f.scripts.length === 1 && f.scripts[0].src === 'https://www.googletagmanager.com/gtag/js?id=' + id, 'Opt-in loads the intended Google property once');
check(f.requests.length === 1 && f.requests[0].url.endsWith('/api/visit'), 'Site statistics start with Google after opt-in');
let commands = f.commands();
check(commands[0][0] === 'consent' && commands[0][2].analytics_storage === 'denied' && commands[1][2].analytics_storage === 'granted', 'Consent is established before tag setup');
check(commands[0][2].ad_storage === 'denied' && commands[0][2].ad_user_data === 'denied' && commands[0][2].ad_personalization === 'denied', 'Advertising remains denied');
const config = commands.find(c => c[0] === 'config')[2];
check(config.send_page_view === false && config.allow_google_signals === false && config.allow_ad_personalization_signals === false, 'Manual route views with advertising features off');
check(config.cookie_expires === 15552000 && config.cookie_update === false, 'Fixed 180-day cookie lifetime');
check(commands.filter(c => c[1] === 'page_view').length === 1, 'Exactly one initial Google page view');
f.navigate('/topic/prediction/');
f.event('ronu:navigate');
commands = f.commands();
let views = commands.filter(c => c[1] === 'page_view');
check(views.length === 2 && views[1][2].page_location === 'https://ronu.one/topic/prediction/', 'One view per distinct route without query strings or fragments');
check(views[1][2].page_referrer === 'https://ronu.one/' && !JSON.stringify(commands).includes('private@'), 'Only sanitized previous-page context');
check(f.requests.at(-1).body.page === '/article/prediction', 'Cloudflare retains its article identifiers');
f.navigate('/');
check(f.commands().filter(c => c[1] === 'page_view').length === 3, 'Returning to a prior route counts a new view');
const requestCount = f.requests.length;
f.toggle(false);
check(f.win['ga-disable-' + id] === true && f.reloads === 1 && !f.cookies.has('_ga'), 'Withdrawal disables Google, removes cookies and unloads its timers');
const count = f.commands().length;
f.navigate('/topic/sunlight-to-step/');
check(f.commands().length === count && f.requests.length === requestCount, 'Turning statistics off stops both collectors');

for (const options of [{allowed: true, excluded: true}, {allowed: true, signals: {doNotTrack: '1'}}, {allowed: true, signals: {globalPrivacyControl: true}}]) {
  f = fixture(options); f.navigate('/topic/prediction/'); f.tick(30000);
  check(f.scripts.length === 0 && f.requests.length === 0, 'Exclusions/privacy signals suppress both systems');
}
f = fixture({allowed: false});
check(f.scripts.length === 0 && f.requests.length === 0, 'An explicit off choice keeps both systems off');
for (const options of [{allowed: true, age: 181 * 86400000}, {allowed: true, age: -60000}, {blockedStorage: true}]) {
  f = fixture(options);
  check(f.scripts.length === 1 && f.requests.length === 1, 'Missing, expired or unavailable storage uses the default-on setting');
}
f = fixture({blockedStorage: true});
f.toggle(false);
check(f.scripts.length === 1 && f.elements.get('analytics-status').textContent.includes('blocked saving'), 'A blocked browser reports that an off choice could not be saved');
f = fixture();
f.toggle(true);
check(f.scripts.length === 1 && f.requests.length === 1 && f.win.RonuPrivacy.statisticsAllowed(), 'One switch activates both statistics systems');
f.store.set(excludeKey, '1');
const storage = new NativeEvent('storage'); storage.key = excludeKey; f.win.dispatchEvent(storage);
const before = f.requests.length; f.navigate('/topic/prediction/'); f.tick(30000);
check(f.reloads === 1 && f.requests.length === before, 'Changing exclusion in another tab stops both collectors');
f = fixture({allowed: true, host: 'localhost'});
check(f.scripts.length === 0 && f.requests.length === 0, 'Local previews do not pollute either service');
console.log('Analytics lifecycle checks passed: ' + checks + '. No network requests were sent.');
