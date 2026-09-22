'use strict';
/** Main-page copy and single-card selections. Article bodies and models are unchanged. */
const MAIN_PAGES = {
 triathlon:{start:'Getting comfortable ',end:'with discomfort.',intro:'For me, triathlon is a process of adaptation. Through practice and discipline, I explore how the body responds to effort and how its limits change.',article:'endurance'},
 science:{start:'Finding patterns ',end:'within the chaos.',intro:'I use ordinary events to explore the patterns and laws behind them. Simple models help me test explanations and see where prediction reaches its limits.',article:'prediction'},
 markets:{start:'Pricing the future ',end:'before it happens.',intro:'I use data and models to compare possible futures. The aim is to understand the trade-offs and make the best decision the available information supports.',article:null},
 // Preserve the intentionally empty Maker introduction and the existing image gallery.
 maker:{start:'What happens when ',end:'an idea becomes real?',intro:'',article:null}
};
function mainHero(sectionId,{slide=false}={}){
 const section=SECTIONS[sectionId],copy=MAIN_PAGES[sectionId],tag=slide?'h2':'h1';
 const titleId=slide?'carousel-title-'+sectionId:'page-title';
 return `<span class="index-number" aria-hidden="true">${esc(section.number)}</span><div class="index-copy"><${tag} class="index-title" id="${titleId}"${slide?'':' tabindex="-1"'}>${esc(section.name)}<span>.</span></${tag}><p class="index-statement">${esc(copy.start)}<em>${esc(copy.end)}</em></p>${copy.intro?`<p class="index-intro">${esc(copy.intro)}</p>`:''}</div>`;
}
function mainArticleCard(sectionId){
 const id=MAIN_PAGES[sectionId].article,topic=TOPICS.find(item=>item.id===id);
 if(!topic){
  if(sectionId!=='markets')return '';
  // A layout-only sample, not a new publication or a fabricated working link.
  return `<article class="article-preview is-sample" aria-labelledby="sample-market-title"><div class="article-preview-art" aria-hidden="true">${artSvg('curves')}</div><div class="article-preview-copy"><p class="article-meta">Layout sample</p><h3 id="sample-market-title">Pricing the future</h3><p class="article-summary">Comparing possible paths for rates before deciding where cash should sit.</p><span class="article-status">Article not added yet</span></div></article>`;
 }
 return `<a class="article-preview" href="#topic/${topic.id}" aria-labelledby="card-${topic.id}"><div class="article-preview-art" aria-hidden="true">${artSvg(topic.art)}</div><div class="article-preview-copy"><p class="article-meta">${esc(topic.type)}</p><h3 id="card-${topic.id}">${esc(topic.title)}</h3><p class="article-summary">${esc(topic.description)}</p><span class="article-read">Read article ${arrow}</span></div></a>`;
}
