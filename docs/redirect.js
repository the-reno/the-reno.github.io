'use strict';
(() => {
  const path = location.pathname.toLowerCase().replace(/\/index\.html$/, '/').replace(/\/+$/, '') || '/';
  const destinations = {
    '/science/prediction.html': '#topic/prediction',
    '/science': '#section/science', '/maker': '#section/maker',
    '/triathlon': '#section/triathlon', '/triathlon/energy.html': '#topic/sunlight-to-step',
    '/triathlon/body-mechanics': '#section/triathlon',
    '/triathlon/body-mechanics/arms': '#section/triathlon',
    '/science/dice.html': '#section/science', '/science/forest-fire-model.html': '#section/science',
    '/science/traffic-jam.html': '#section/science'
  };
  if (path === '/preview' || path.startsWith('/preview/')) {
    const hash = /^#(?:explore|section\/[a-z0-9-]+|topic\/[a-z0-9-]+(?:\/(?:part-\d+|article-start|article-opening))?)(?:\?[^#]*)?$/.test(location.hash) ? location.hash : '#explore';
    location.replace('/' + hash);
  } else if (Object.hasOwn(destinations, path)) location.replace('/' + destinations[path]);
})();
