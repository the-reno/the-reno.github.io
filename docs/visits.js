'use strict';
/* Ephemeral session engagement. No persistent browser identifier. */
(() => {
  const config=window.RONU_RECORDS;
  if(!config?.enabled||location.hostname!=='ronu.one')return;
  let base;try{base=new URL(config.origin);if(base.protocol!=='https:'||base.origin!==config.origin)return;}catch{return;}
  const signals=()=>navigator.globalPrivacyControl===true||navigator.doNotTrack==='1'||window.doNotTrack==='1';
  if(signals())return;

  const sessionId=crypto.randomUUID();
  let current=null,sequence=0,lastTick=performance.now(),activeMs=0,maxScroll=0,wasVisible=document.visibilityState==='visible';

  function route(){
    const hash=location.hash.split('?')[0];
    const [kind,id]=hash.slice(1).split('/');
    if(kind==='section'&&typeof MAIN_PAGES!=='undefined'&&Object.hasOwn(MAIN_PAGES,id)&&id!=='all')return '/section/'+id;
    if(kind==='topic'&&typeof TOPICS!=='undefined'&&TOPICS.some(t=>t.id===id))return '/article/'+id;
    if(!hash||hash==='#explore')return '/';
    return null;
  }
  function addActive(){
    const now=performance.now();
    if(wasVisible&&current)activeMs+=Math.max(0,now-lastTick);
    lastTick=now;
  }
  function updateScroll(){
    if(!current)return;
    const h=Math.max(document.documentElement.scrollHeight,document.body?.scrollHeight||0);
    if(!h)return;
    maxScroll=Math.max(maxScroll,Math.min(100,Math.round(((scrollY+innerHeight)/h)*100)));
  }
  function send(payload){
    fetch(base.origin+'/api/visit',{method:'POST',credentials:'omit',referrerPolicy:'no-referrer',
      headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),keepalive:true}).catch(()=>{});
  }
  function flush(){
    if(!current)return;
    addActive();updateScroll();
    send({event_id:current.event_id,session_id:sessionId,page:current.page,page_sequence:current.page_sequence,
      mode:'update',active_seconds:Math.round(activeMs/1000),max_scroll:maxScroll,privacy_version:'2026-09-25-records3'});
  }
  function start(){
    const page=route();if(!page)return;
    sequence+=1;
    current={event_id:crypto.randomUUID(),page,page_sequence:sequence};
    activeMs=0;maxScroll=0;lastTick=performance.now();updateScroll();
    send({event_id:current.event_id,session_id:sessionId,page,page_sequence:sequence,
      mode:'start',active_seconds:0,max_scroll:maxScroll,privacy_version:'2026-09-25-records3'});
    setTimeout(updateScroll,120);
  }
  window.addEventListener('scroll',updateScroll,{passive:true});
  window.addEventListener('hashchange',()=>{flush();start();});
  document.addEventListener('visibilitychange',()=>{flush();wasVisible=document.visibilityState==='visible';lastTick=performance.now();});
  window.addEventListener('pagehide',flush);
  setInterval(flush,30000);
  start();
})();
