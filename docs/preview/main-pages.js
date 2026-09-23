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
 return `<div class="index-copy"><${tag} class="index-title" id="${titleId}"${slide?'':' tabindex="-1"'}>${esc(section.name)}<span>.</span></${tag}><p class="index-statement">${esc(copy.start)}<em>${esc(copy.end)}</em></p>${copy.intro?`<p class="index-intro">${esc(copy.intro)}</p>`:''}</div>`;
}
// Compact summaries are used only on section landing pages, not in the reader.
const ARTICLE_PREVIEWS = {
 endurance:{icon:'endurance',summary:'How fuel and movement sustain effort.'},
 prediction:{icon:'prediction',summary:'Patterns and uncertainty, starting with a roll of the dice.'}
};
function articleIcon(kind){
 const paths={
  endurance:'<path d="M3 12h4l3-7 4 14 3-7h4"/>',
  prediction:'<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="8" cy="8" r="1" fill="currentColor" stroke="none"/><circle cx="16" cy="8" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="8" cy="16" r="1" fill="currentColor" stroke="none"/><circle cx="16" cy="16" r="1" fill="currentColor" stroke="none"/>',
  markets:'<path d="M4 4v16h16M7 16l4-5 4 2 5-7M16 6h4v4"/>',
  article:'<path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6M9 16h6"/>'
 };
 return `<span class="article-tile-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" focusable="false">${paths[kind]||paths.article}</svg></span>`;
}
function mainArticleCard(sectionId){
 const id=MAIN_PAGES[sectionId]?.article,topic=TOPICS.find(item=>item.id===id);
 if(!topic){
  if(sectionId!=='markets')return '';
  // Non-clickable and explicitly labeled: this sample is not a published article.
  return `<article class="article-tile is-sample" aria-labelledby="sample-market-title" aria-describedby="sample-market-status">${articleIcon('markets')}<div class="article-tile-copy"><h3 id="sample-market-title">Pricing the future</h3><p class="article-tile-summary">Compare rate scenarios before allocating cash.</p><p class="article-tile-status" id="sample-market-status">Layout sample · Not published</p></div></article>`;
 }
 const preview=ARTICLE_PREVIEWS[topic.id]||{icon:'article',summary:topic.description};
 return `<a class="article-tile" href="#topic/${esc(topic.id)}" aria-labelledby="card-${esc(topic.id)}" aria-describedby="summary-${esc(topic.id)}">${articleIcon(preview.icon)}<div class="article-tile-copy"><h3 id="card-${esc(topic.id)}">${esc(topic.title)}</h3><p class="article-tile-summary" id="summary-${esc(topic.id)}">${esc(preview.summary)}</p></div><span class="article-tile-arrow" aria-hidden="true">${arrow}</span></a>`;
}
