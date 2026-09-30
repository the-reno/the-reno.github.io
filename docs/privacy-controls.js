'use strict';
(() => {
  const consentKey = 'ronu.google-analytics-consent.v1';
  const excludeKey = 'ronu.exclude-this-browser';
  const lifetime = 180 * 24 * 60 * 60 * 1000;
  const read = key => {try {return localStorage.getItem(key);} catch {return null;}};
  const signals = () => navigator.globalPrivacyControl === true || navigator.doNotTrack === '1' || window.doNotTrack === '1';
  const excluded = () => signals() || read(excludeKey) === '1';
  function googleAllowed() {
    if (excluded()) return false;
    try {
      const choice = JSON.parse(read(consentKey));
      return choice?.allowed === true && Number.isFinite(choice.at) && choice.at <= Date.now() && Date.now() - choice.at < lifetime;
    } catch {return false;}
  }
  function clearGoogleCookies() {
    for (const cookie of document.cookie.split(';')) {
      const name = cookie.trim().split('=')[0];
      if (!/^_ga(?:_|$)/.test(name)) continue;
      for (const domain of ['', location.hostname, '.' + location.hostname]) {
        document.cookie = name + '=; Max-Age=0; Path=/; SameSite=Lax' + (domain ? '; Domain=' + domain : '');
      }
    }
  }
  window.RonuPrivacy = Object.freeze({excluded, googleAllowed});
  function render() {
    const checkbox = document.getElementById('exclude-browser');
    if (checkbox) {checkbox.checked = read(excludeKey) === '1'; checkbox.disabled = false;}
    const status = document.getElementById('analytics-status');
    if (status) status.textContent = excluded()
      ? 'Visit counting is off in both systems for this browser' + (signals() ? ' because of your browser privacy signal.' : '.')
      : googleAllowed() ? 'Google Analytics is on for this browser. Cloudflare visit records are also on.'
        : 'Google Analytics is off for this browser. Cloudflare visit records are still on.';
    const allow = document.getElementById('analytics-allow');
    if (allow) allow.disabled = excluded() || googleAllowed();
    const off = document.getElementById('analytics-off');
    if (off) off.disabled = false;
  }
  function changed() {
    if (!googleAllowed()) {
      const id = window.RONU_ANALYTICS?.measurementId;
      if (id) window['ga-disable-' + id] = true;
      clearGoogleCookies();
    }
    render();
    window.dispatchEvent(new Event('ronu:privacy-change'));
  }
  function save(key, value) {
    try {localStorage.setItem(key, value);} catch {
      render();
      document.getElementById('analytics-status').textContent = 'Your browser blocked saving this preference. Google Analytics stays off unless a valid earlier choice is available. Enable browser storage to save a change.';
      return;
    }
    changed();
  }
  document.getElementById('analytics-allow')?.addEventListener('click', () => save(consentKey, JSON.stringify({allowed: true, at: Date.now()})));
  document.getElementById('analytics-off')?.addEventListener('click', () => save(consentKey, JSON.stringify({allowed: false, at: Date.now()})));
  document.getElementById('exclude-browser')?.addEventListener('change', event => save(excludeKey, event.target.checked ? '1' : '0'));
  window.addEventListener('storage', event => {if (!event.key || event.key === consentKey || event.key === excludeKey) changed();});
  if (!googleAllowed()) clearGoogleCookies();
  render();
})();
