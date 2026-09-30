'use strict';
(() => {
  const consentKey = 'ronu.statistics-setting.v2';
  const excludeKey = 'ronu.statistics-excluded.v2';
  const lifetime = 180 * 24 * 60 * 60 * 1000;
  const read = key => {try {return localStorage.getItem(key);} catch {return null;}};
  const signals = () => navigator.globalPrivacyControl === true || navigator.doNotTrack === '1' || window.doNotTrack === '1';
  const excluded = () => signals() || read(excludeKey) === '1';
  function googleAllowed() {
    if (excluded()) return false;
    const stored = read(consentKey);
    if (stored === null) return true;
    try {
      const choice = JSON.parse(stored);
      if (Number.isFinite(choice?.at) && choice.at <= Date.now() && Date.now() - choice.at < lifetime) return choice.allowed === true;
    } catch {}
    return true;
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
  const statisticsAllowed = () => googleAllowed();
  window.RonuPrivacy = Object.freeze({excluded, googleAllowed, statisticsAllowed});
  function render() {
    const on = statisticsAllowed();
    const toggle = document.getElementById('statistics-toggle');
    if (toggle) {toggle.checked = on; toggle.disabled = signals();}
    const value = document.getElementById('statistics-value');
    if (value) value.textContent = on ? 'On' : 'Off';
    const status = document.getElementById('analytics-status');
    if (status) status.textContent = on ? 'Statistics are on for this browser.'
      : 'Statistics are off for this browser' + (signals() ? ' because of your browser privacy signal.' : '.');
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
  function save(on) {
    try {
      localStorage.setItem(excludeKey, on ? '0' : '1');
      localStorage.setItem(consentKey, JSON.stringify({allowed: on, at: Date.now()}));
    } catch {
      render();
      document.getElementById('analytics-status').textContent = 'Your browser blocked saving this setting. The current setting remains unchanged.';
      return;
    }
    changed();
  }
  document.getElementById('statistics-toggle')?.addEventListener('change', event => save(event.target.checked));
  window.addEventListener('storage', event => {if (!event.key || event.key === consentKey || event.key === excludeKey) changed();});
  if (!googleAllowed()) clearGoogleCookies();
  render();
})();
