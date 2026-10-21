'use strict';
// Public article catalogue. Text is loaded from the same host as the website.
const SECTIONS = Object.fromEntries(['all', ...SITE.sectionOrder].map(id => [id, {name: MAIN_PAGES[id].name}]));
const TOPICS = [
  {id:'garage-door',section:'maker',type:'Project',title:'Rebuilding the garage doors',description:'An insulated timber-and-plywood garage door rebuild, with an interactive 3D model, illustrated assembly steps and a metric cut list.',articleFile:'articles/garage-door.json',articleVersion:'20261009-1',tags:'garage door doors maker wood timber plywood insulation frame half-lap strips trim screws building assembly manual cuts centimeters imperial 3D'},
  {id:'sunlight-to-step',section:'triathlon',type:'Article',title:'From Sunlight to the Finish Line.',description:'From hydrogen fusion in the Sun to the energy behind a finish line.',articleFile:'articles/sunlight-to-step.json',articleVersion:'20261021-science-modal1',tags:'sun sunlight photon hydrogen helium fusion plasma quantum physics tunnelling probability Einstein relativity mass energy photon finish line'},
  {id:'prediction',section:'science',type:'Article',title:'The Complexity of Prediction',description:'From rolling dice to understanding the patterns behind uncertain outcomes.',articleFile:'articles/prediction.json',articleVersion:'20260925-4',tags:'dice probability Newton mathematics uncertainty complexity gas fluid dynamics turbulence weather chaos'}
];

// Load the optional science reader only on its article. The static builder has no DOM.
if (typeof window !== 'undefined') {
  (() => {
    let requested = false;
    const loadScienceReader = () => {
      if (requested || !(/\/topic\/sunlight-to-step(?:\/|$)/.test(location.pathname) || /^#topic\/sunlight-to-step(?:[/?]|$)/.test(location.hash))) return;
      requested = true;
      const style = document.createElement('link');
      style.rel = 'stylesheet'; style.href = '/sunlight-reader.css?v=20261021-science-modal1';
      const scienceStyle = document.createElement('link');
      scienceStyle.rel = 'stylesheet'; scienceStyle.href = '/sunlight-science.css?v=20261021-science-modal1';
      const script = document.createElement('script');
      script.src = '/sunlight-reader.js?v=20261021-science-modal1'; script.defer = true;
      document.head.append(style, scienceStyle, script);
    };
    window.addEventListener('ronu:navigate', loadScienceReader);
    document.addEventListener('DOMContentLoaded', loadScienceReader, {once:true});
    if (document.readyState !== 'loading') loadScienceReader();
  })();
}
