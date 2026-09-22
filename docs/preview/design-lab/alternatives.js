'use strict';
/* Second-round design options. Existing L01–L04 and color references are unchanged. */
(() => {
  const data = window.RONU_LAB;
  data.revision = 'lab2-20260922';
  data.layouts.push(
    {id:'05',name:'Minimal',note:'Space, a rule, one clear thought.',detail:'A large white section title, a narrow accent rule and a plain-spoken sentence. No decorative visual; space and alignment do the work.',fresh:true},
    {id:'06',name:'Signal',note:'A precise, technical field note.',detail:'A squared, ruled composition with a section marker, crosshairs and a restrained grid. A technical-lab feel rather than a traditional article header.',fresh:true},
    {id:'07',name:'Outline',note:'An outlined title. A solid idea.',detail:'The section name becomes an oversized outlined word. Your sentence sits below in solid type, with a small accent marker. The outline is decorative; the subject remains readable as text.',fresh:true},
    {id:'08',name:'Spotlight',note:'Centered words, a quiet glow.',detail:'A centered sentence sits over a soft, static halo. One concentrated accent creates atmosphere without turning the whole page bright.',fresh:true},
    {id:'09',name:'Duotone',note:'Two panels. Two contrasting roles.',detail:'A bright left panel names the subject in dark text. A dark right panel carries the sentence. The two stack cleanly on a phone.',fresh:true},
    {id:'10',name:'Index',note:'A numbered, magazine-like entry.',detail:'An oversized section marker anchors a compact editorial row. The section title and sentence form an index-like entry, leaving more room for the work below.',fresh:true}
  );
  data.colors.push(
    {id:'G3',name:'Laser teal',hex:'#00F0B5',family:'Green',fresh:true},
    {id:'G4',name:'Highlighter green',hex:'#75FF00',family:'Green',fresh:true},
    {id:'O3',name:'Vermilion',hex:'#FF5C35',family:'Orange',fresh:true},
    {id:'O4',name:'Tangerine',hex:'#FF9366',family:'Orange',fresh:true},
    {id:'B3',name:'Ultramarine',hex:'#7384FF',family:'Blue',fresh:true},
    {id:'B4',name:'Polar blue',hex:'#8EDFFF',family:'Blue',fresh:true},
    {id:'P1',name:'Ultraviolet',hex:'#C880FF',family:'Pink & violet',fresh:true},
    {id:'P2',name:'Hot pink',hex:'#FF6BD6',family:'Pink & violet',fresh:true},
    {id:'P3',name:'Neon rose',hex:'#FF7597',family:'Pink & violet',fresh:true},
    {id:'Y1',name:'Volt yellow',hex:'#F2FF40',family:'Yellow',fresh:true},
    {id:'Y2',name:'Electric gold',hex:'#FFDA3D',family:'Yellow',fresh:true},
    {id:'N1',name:'Silver',hex:'#F2F4F7',family:'Neutral',fresh:true}
  );
  data.colors.sort((a,b)=>['G','O','B','P','Y','N'].indexOf(a.id[0])-['G','O','B','P','Y','N'].indexOf(b.id[0])||a.id.localeCompare(b.id));
  data.fonts = [
    {id:'01',name:'Original mix',note:'Each layout’s own type pairing.'},
    {id:'02',name:'Modern sans',note:'Clean, direct, sans serif.'},
    {id:'03',name:'Literary serif',note:'Expressive serif headlines.'},
    {id:'04',name:'Technical mono',note:'A measured, monospaced voice.'}
  ];
  data.presets = [
    {name:'Quiet',layout:'05',color:'N1',type:'02'},
    {name:'Technical',layout:'06',color:'G1',type:'04'},
    {name:'Atmospheric',layout:'08',color:'B2',type:'02'},
    {name:'Graphic',layout:'09',color:'O1',type:'02'}
  ];
  const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  window.RONU_VARIANTS = {
    hero(section,layout,{home=false,compact=false}={}) {
      const tag=home||compact?'h2':'h1';
      const number=String(data.sections.findIndex(s=>s.id===section.id)+1).padStart(2,'0');
      const statement = `<span>${escape(section.start)}</span><em>${escape(section.end)}</em>`;
      const cta=home?`Explore ${section.name.toLowerCase()}`:section.id==='maker'?'See the images':section.id==='markets'?'Explore the perspective':'Browse articles';
      const action=home?`data-page="${section.id}"`:'data-jump="section-work"';
      const actions=`<div class="hero-actions"><button type="button" class="hero-cta" ${action}>${escape(cta)}<span class="arr" aria-hidden="true">→</span></button><span class="hero-themes">${escape(section.themes)}</span></div>`;
      const intro=section.intro&&!compact?`<p class="hero-intro">${escape(section.intro)}</p>`:'';
      const label=`<p class="hero-eyebrow">${escape(section.name)} / A personal perspective</p>`;
      let body='';
      if(layout==='05')body=`<div class="hero-copy">${label}<${tag} class="hero-title">${escape(section.name)}<span class="period">.</span></${tag}><div class="minimal-note"><p class="hero-tagline">${statement}</p>${intro}</div>${actions}</div>`;
      if(layout==='06')body=`<div class="signal-mast"><span class="signal-stamp">FIELD NOTES / ${number}</span><span>${escape(section.name)}</span><span class="signal-cross" aria-hidden="true">+</span></div><div class="hero-copy">${label}<${tag} class="hero-title">${escape(section.name)}<span class="period">_</span></${tag}><p class="hero-tagline">${statement}</p>${intro}${actions}</div><div class="signal-foot" aria-hidden="true"><span>OBSERVE / QUESTION / EXPLORE</span><span>+</span></div>`;
      if(layout==='07')body=`<div class="outline-word" aria-hidden="true">${escape(section.name)}</div><div class="hero-copy">${label}<${tag} class="hero-title">${statement}</${tag}>${intro}${actions}</div>`;
      if(layout==='08')body=`<div class="spotlight-halo" aria-hidden="true"></div><div class="hero-copy">${label}<${tag} class="hero-title">${statement}</${tag}>${intro}${actions}</div>`;
      if(layout==='09')body=`<div class="duo-label"><span class="duo-kicker">A PERSONAL PERSPECTIVE</span><span class="duo-name" aria-hidden="true">${escape(section.name)}.</span><span class="duo-bottom">${escape(section.themes)}</span></div><div class="hero-copy"><p class="hero-eyebrow">${escape(section.name)}</p><${tag} class="hero-title">${statement}</${tag}>${intro}${actions}</div>`;
      if(layout==='10')body=`<div class="index-no" aria-hidden="true">${number}</div><div class="hero-copy"><p class="hero-eyebrow">${escape(section.themes)}</p><${tag} class="hero-title">${escape(section.name)}<span class="period">.</span></${tag}><p class="hero-tagline">${statement}</p>${intro}${actions}</div>`;
      return `<section class="page-hero variant-hero" aria-label="${escape(section.name)} introduction">${body}</section>`;
    }
  };
})();
