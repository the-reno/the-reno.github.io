'use strict';
/* Reopen the inspector when a narrow window becomes a desktop window. */
(() => {
  const desktop = matchMedia('(min-width:801px)');
  const reveal = () => { if (desktop.matches) document.querySelector('.inspector-details').open = true; };
  desktop.addEventListener('change', reveal);
  reveal();
})();
