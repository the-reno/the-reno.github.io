'use strict';
// Public article catalogue. Text is loaded from the same host as the website.
const SECTIONS = Object.fromEntries(['all', ...SITE.sectionOrder].map(id => [id, {name: MAIN_PAGES[id].name}]));
const TOPICS = [
  {id:'sunlight-to-step',section:'triathlon',type:'Article',title:'From sunlight to a single step',description:'From the finish line back to the food that made the effort possible.',articleFile:'articles/sunlight-to-step.json',articleVersion:'20260924-1',tags:'sun sunlight wheat pasta food training muscle movement energy finish line'},
  {id:'prediction',section:'science',type:'Article',title:'The Complexity of Prediction',description:'From rolling dice to understanding the patterns behind uncertain outcomes.',articleFile:'articles/prediction.json',articleVersion:'20260925-4',tags:'dice probability Newton mathematics uncertainty complexity gas fluid dynamics turbulence weather chaos'}
];
