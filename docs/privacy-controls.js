'use strict';
(() => {
  const signals = () => navigator.globalPrivacyControl === true || navigator.doNotTrack === '1' || window.doNotTrack === '1';
  const excluded = () => signals();
  const googleAllowed = () => !excluded();
  const statisticsAllowed = () => !excluded();
  function clearGoogleCookies() {
    for (const cookie of document.cookie.split(';')) {
      const name = cookie.trim().split('=')[0];
      if (!/^_ga(?:_|$)/.test(name)) continue;
      for (const domain of ['', location.hostname, '.' + location.hostname]) {
        document.cookie = name + '=; Max-Age=0; Path=/; SameSite=Lax' + (domain ? '; Domain=' + domain : '');
      }
    }
  }
  window.RonuPrivacy = Object.freeze({excluded, googleAllowed, statisticsAllowed});
  if (!googleAllowed()) clearGoogleCookies();
})();
