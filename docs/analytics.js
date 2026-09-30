'use strict';
/* Basic consent: do not load Google or send any pings before an explicit opt-in. */
(() => {
  const id = window.RONU_ANALYTICS?.measurementId;
  if (location.hostname !== 'ronu.one' || !/^G-[A-Z0-9]+$/.test(id || '')) return;
  let loaded = false, previous = '';
  function pageView() {
    if (!loaded || !window.RonuPrivacy?.googleAllowed()) return;
    const canonical = document.querySelector('link[rel="canonical"]')?.href;
    if (!canonical) return;
    const url = new URL(canonical);
    if (url.origin !== 'https://ronu.one') return;
    const page = url.origin + url.pathname;
    if (page === previous) return;
    // Exclude query strings, fragments, search input and feedback from Google.
    const fields = {page_location: page, page_title: document.title, page_referrer: previous};
    window.gtag('set', fields);
    window.gtag('event', 'page_view', {...fields, send_to: id});
    previous = page;
  }
  function reconcile() {
    if (!window.RonuPrivacy?.googleAllowed()) {
      window['ga-disable-' + id] = true;
      // Discard Google's timers and queues when consent is withdrawn in another tab.
      if (loaded) location.reload();
      return;
    }
    if (loaded) return;
    window['ga-disable-' + id] = false;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function() {window.dataLayer.push(arguments);};
    window.gtag('consent', 'default', {analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied'});
    window.gtag('consent', 'update', {analytics_storage: 'granted'});
    window.gtag('js', new Date());
    window.gtag('config', id, {send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false,
      cookie_expires: 15552000, cookie_update: false, page_location: 'https://ronu.one' + location.pathname, page_referrer: ''});
    loaded = true;
    pageView();
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + id;
    document.head.append(script);
  }
  window.addEventListener('ronu:navigate', pageView);
  window.addEventListener('ronu:privacy-change', reconcile);
  // Consent can expire while a tab remains open.
  document.addEventListener('visibilitychange', reconcile);
  reconcile();
})();
