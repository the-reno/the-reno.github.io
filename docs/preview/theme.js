'use strict';
/** Preview-only color comparison. Query choice overrides the optional local preference. */
(() => {
  const choices=['amber','blue','lilac'];
  const key='ronu-preview-accent';
  let saved='amber';
  try { saved=localStorage.getItem(key)||'amber'; } catch { /* Storage is optional. */ }
  const parameter=new URLSearchParams(location.search).get('accent');
  let current=choices.includes(parameter)?parameter:(choices.includes(saved)?saved:'amber');
  const buttons=Array.from(document.querySelectorAll('[data-accent-choice]'));
  function apply(name,remember=false) {
    if(!choices.includes(name))return;
    current=name;
    document.documentElement.dataset.accent=name;
    buttons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.accentChoice===name)));
    if(remember){
      try { localStorage.setItem(key,name); } catch { /* No storage is required. */ }
      try {
        const url=new URL(location.href);url.searchParams.set('accent',name);
        history.replaceState(null,'',url.pathname+url.search+url.hash);
      } catch { /* The theme still changes when URL updates are blocked. */ }
    }
  }
  buttons.forEach(button=>button.addEventListener('click',()=>apply(button.dataset.accentChoice,true)));
  apply(current);
})();
