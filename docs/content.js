'use strict';
// Public article catalogue. Text is loaded from the same host as the website.
const SECTIONS = Object.fromEntries(['all', ...SITE.sectionOrder].map(id => [id, {name: MAIN_PAGES[id].name}]));
const TOPICS = [
  {id:'usd-cash-allocation',section:'markets',type:'Article',title:'Where should short-term cash sit?',description:'How the Fed path shapes the choice between rolling overnight cash and locking term rates.',articleFile:'articles/usd-cash-allocation.json',articleVersion:'20261126-1',tags:'SOFR USD cash allocation treasury overnight ON term rates premium Fed rate path scenarios diversified ladder liquidity yield resilience'},
  {id:'series-63-study-guide',section:'maker',type:'Project',title:'Series 63 Study Guide',description:'A practical Series 63 case study: follow one client through investment decisions, professional duties, exceptions and a disputed trade, with definitions, practice and official guides.',articleFile:'articles/series-63-study-guide.json',articleVersion:'20261126-case-1',tags:'series 63 study guide securities law uniform securities act NASAA SEC FINRA broker dealer agent investment adviser IAR registration duties obligations exemptions enforcement concepts glossary learning'},
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
      style.rel = 'stylesheet'; style.href = '/sunlight-reader.css?v=20261118-leaf2';
      const scienceStyle = document.createElement('link');
      scienceStyle.rel = 'stylesheet'; scienceStyle.href = '/sunlight-science.css?v=20261021-science-modal1';
      const script = document.createElement('script');
      script.src = '/sunlight-reader.js?v=20261118-leaf2'; script.defer = true;
      document.head.append(style, scienceStyle, script);
    };
    window.addEventListener('ronu:navigate', loadScienceReader);
    document.addEventListener('DOMContentLoaded', loadScienceReader, {once:true});
    if (document.readyState !== 'loading') loadScienceReader();
  })();
}
