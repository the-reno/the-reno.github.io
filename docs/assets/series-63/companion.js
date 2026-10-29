'use strict';
(() => {
  const DATA = JSON.parse(document.getElementById('study-data').textContent);
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const byId = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const chapterMap = new Map(DATA.chapters.map(c => [c.chapter_id,c]));
  const conceptMap = new Map(DATA.concepts.map(c => [c.concept_id,c]));
  const authoredQuestions = DATA.questions.filter(q => q.practice_kind === 'self_check' && Number.isSafeInteger(q.id) && q.id < 0);
  let allQuestions = [...authoredQuestions];
  let licensedBank = null;
  const questionMap = new Map(allQuestions.map(q => [q.id,q]));
  const sourceMap = new Map(DATA.sources.map(s => [s.source_key,s]));
  const glossaryMap = new Map(DATA.glossary.map(g => [g.id,g]));
  const stateKey = 'series63.public-companion.v1';
  const cleanState = () => ({version:1,read:[],saved:[],notes:{},choices:{},responses:{},reviewQuestions:[],font:18});
  const MAX_IMPORT_BYTES = 25 * 1024 * 1024;
  const MAX_BANK_QUESTIONS = 10000;
  const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const safeId = value => {
    if(typeof value !== 'number' && !(typeof value === 'string' && /^-?\d+$/.test(value))) return null;
    const id = Number(value);
    return Number.isSafeInteger(id) && id !== 0 ? id : null;
  };
  const plainText = (value, label, max = 50000, required = false) => {
    if(value === null || value === undefined) {
      if(required) throw new Error(`${label} is missing.`);
      return '';
    }
    if(typeof value !== 'string' || value.length > max) throw new Error(`${label} must be text of at most ${max.toLocaleString()} characters.`);
    const clean = value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
    if(required && !clean.trim()) throw new Error(`${label} is empty.`);
    return clean;
  };
  const safeSourceKeys = value => {
    if(value === null || value === undefined) return [];
    if(!Array.isArray(value) || value.length > 100 || value.some(k => typeof k !== 'string' || !/^[A-Za-z0-9_.:-]{1,120}$/.test(k))) throw new Error('Invalid source-reference list.');
    return [...new Set(value)];
  };
  const safeSourceUrl = value => {
    const text = plainText(value, 'Source URL', 3000, true);
    let url;
    try { url = new URL(text); } catch(error) { throw new Error('A source URL is invalid.'); }
    if(!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Source links must use HTTP or HTTPS without credentials.');
    return url.href;
  };
  const optionalInteger = (value, label) => {
    if(value === null || value === undefined || value === '') return null;
    if(!Number.isSafeInteger(value) || value < 1 || value > 1000000) throw new Error(`${label} is invalid.`);
    return value;
  };
  // Only known data fields enter the active bank. Imported strings are rendered as text.
  const validateBankPayload = (payload, filename = 'Local question bank') => {
    const rows = Array.isArray(payload) ? payload : isObject(payload) ? payload.questions : null;
    if(!Array.isArray(rows) || !rows.length || rows.length > MAX_BANK_QUESTIONS) throw new Error(`Use a question array or an object with 1–${MAX_BANK_QUESTIONS.toLocaleString()} questions.`);
    const seen = new Set();
    const questions = rows.map((raw, index) => {
      if(!isObject(raw)) throw new Error(`Question ${index + 1} is not an object.`);
      const id = safeId(raw.id ?? raw.question_id);
      if(id === null || id < 1) throw new Error(`Question ${index + 1} needs a positive, safe integer ID. Authored self-checks cannot be imported as a private bank.`);
      if(seen.has(id)) throw new Error(`Question ID ${id} appears more than once.`);
      seen.add(id);
      const conceptId = plainText(raw.concept_id, `Question ${id} concept`, 40, true);
      const concept = conceptMap.get(conceptId);
      if(!concept) throw new Error(`Question ${id} has an unknown concept: ${conceptId}. Use the mapped companion bank.`);
      if(raw.chapter_id != null && raw.chapter_id !== concept.chapter_id) throw new Error(`Question ${id} has a chapter that conflicts with ${conceptId}.`);
      if(raw.section_id != null && raw.section_id !== concept.section_id) throw new Error(`Question ${id} has a section that conflicts with ${conceptId}.`);
      const options = raw.options ?? [raw.option_a, raw.option_b, raw.option_c, raw.option_d];
      if(!Array.isArray(options) || options.length < 2 || options.length > 26) throw new Error(`Question ${id} needs between 2 and 26 answer options.`);
      const weight = raw.weight ?? raw.exam_weight_pct ?? null;
      if(weight !== null && (typeof weight !== 'number' || !Number.isFinite(weight) || weight < 0 || weight > 100)) throw new Error(`Question ${id} has an invalid topic weight.`);
      const libraryId = raw.library_id ?? raw.source_library_file_id ?? null;
      if(libraryId !== null && (typeof libraryId !== 'string' || !/^libfile_[A-Za-z0-9_-]{1,120}$/.test(libraryId))) throw new Error(`Question ${id} has an invalid Library reference.`);
      const pageStart = optionalInteger(raw.page_start ?? raw.pdf_page_start, `Question ${id} start page`);
      const pageEnd = optionalInteger(raw.page_end ?? raw.pdf_page_end, `Question ${id} end page`) ?? pageStart;
      if(pageStart !== null && pageEnd < pageStart) throw new Error(`Question ${id} has an invalid page range.`);
      if(raw.cautions != null && (!Array.isArray(raw.cautions) || raw.cautions.length > 100)) throw new Error(`Question ${id} has an invalid caution list.`);
      const cautions = (raw.cautions || []).map(c => {
        if(!isObject(c)) throw new Error(`Question ${id} has an invalid caution.`);
        return {
          caution_id: plainText(c.caution_id, 'Caution ID', 120),
          title: plainText(c.title, 'Caution title', 500, true),
          note: plainText(c.note, 'Caution text', 50000, true),
          status: plainText(c.status, 'Caution status', 150),
          source_keys: safeSourceKeys(c.source_keys)
        };
      });
      return {
        id, practice_kind: 'private',
        text: plainText(raw.text ?? raw.question_text, `Question ${id} text`, 100000, true),
        options: options.map((v, i) => plainText(v, `Question ${id} option ${i + 1}`, 50000, true)),
        explanation: plainText(raw.explanation, `Question ${id} explanation`, 150000, true),
        concept_id: conceptId, chapter_id: concept.chapter_id, section_id: concept.section_id,
        topic: plainText(raw.topic ?? raw.exam_topic, 'Exam topic', 500),
        topic_code: plainText(raw.topic_code ?? raw.exam_topic_code, 'Exam topic code', 100),
        weight, source_pdf: plainText(raw.source_pdf, 'Source filename', 1000),
        library_id: libraryId, page_start: pageStart, page_end: pageEnd,
        answer_status: plainText(raw.answer_status, 'Answer status', 200),
        // The companion never derives or trusts a guessed key to grade imported material.
        correct_answer: null,
        review_note: plainText(raw.review_note ?? raw.mapping_review_note, 'Mapping note', 50000) || null,
        classification_review: raw.classification_review === true || raw.classification_review_required === 1,
        cautions,
        source_content_sha256: plainText(raw.source_content_sha256 ?? raw.study_question_content_sha256, 'Source hash', 128)
      };
    });
    const rawSources = !Array.isArray(payload) && payload.sources != null ? payload.sources : [];
    if(!Array.isArray(rawSources) || rawSources.length > 1000) throw new Error('The source list is invalid.');
    const sourceIds = new Set();
    const sources = rawSources.map(raw => {
      if(!isObject(raw)) throw new Error('A source record is invalid.');
      const key = safeSourceKeys([raw.source_key])[0];
      if(sourceIds.has(key)) throw new Error(`Source key ${key} appears more than once.`);
      sourceIds.add(key);
      return {
        source_key: key, title: plainText(raw.title, 'Source title', 1000, true),
        short_title: plainText(raw.short_title, 'Source short title', 500),
        url: safeSourceUrl(raw.url), verified_on: plainText(raw.verified_on, 'Verification date', 100),
        note: plainText(raw.note, 'Source note', 20000)
      };
    });
    return {version: 1, filename: plainText(filename, 'Bank filename', 1000, true), imported_at: new Date().toISOString(), questions, sources};
  };
  const parseBankFile = (text, filename) => {
    if(typeof text !== 'string' || text.length > MAX_IMPORT_BYTES) throw new Error('The bank file is too large.');
    const trimmed = text.replace(/^\uFEFF/, '').trim();
    let payload;
    if(trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try { payload = JSON.parse(trimmed); } catch(error) { throw new Error('The file does not contain valid JSON.'); }
    } else {
      // Parse script blocks only. Other imported HTML, including images and frames,
      // never reaches a document, so it cannot initiate resource requests.
      const blocks = trimmed.match(/<script\b(?:[^>"']|"[^"]*"|'[^']*')*>[\s\S]*?<\/script\s*>/gi) || [];
      if(blocks.length > 1000) throw new Error('The HTML contains too many script blocks.');
      const candidates = [];
      for(const block of blocks) {
        const doc = new DOMParser().parseFromString(block, 'text/html');
        const node = doc.querySelector('script#study-data');
        if(node) {
          if(node.hasAttribute('src') || node.getAttribute('type')?.trim().toLowerCase() !== 'application/json') throw new Error('The study-data element must contain embedded JSON.');
          candidates.push(node.textContent);
        }
      }
      if(candidates.length !== 1) throw new Error('Choose the private companion HTML with exactly one embedded study-data JSON block.');
      try { payload = JSON.parse(candidates[0]); } catch(error) { throw new Error('The embedded question data is not valid JSON.'); }
    }
    return validateBankPayload(payload, filename);
  };
  let state=cleanState(), storageAvailable=true, activeChapter='C01', toastTimer, lastFocus=null;
  const sanitizeState = incoming => {
    if(!incoming || incoming.version!==1) throw new Error('This is not a compatible study backup.');
    const out=cleanState();
    out.read=[...new Set((Array.isArray(incoming.read)?incoming.read:[]).filter(id=>chapterMap.has(id)))];
    out.saved=[...new Set((Array.isArray(incoming.saved)?incoming.saved:[]).filter(id=>conceptMap.has(id)))];
    // Positive IDs may belong to a bank that has not finished restoring yet.
    // Keep them across reloads, bank removal and imports of a study backup.
    out.reviewQuestions=[...new Set((Array.isArray(incoming.reviewQuestions)?incoming.reviewQuestions:[]).slice(0,20000).map(safeId).filter(id=>id!==null&&(id>0||questionMap.has(id))))];
    for(const c of DATA.chapters) if(typeof incoming.notes?.[c.chapter_id]==='string')out.notes[c.chapter_id]=incoming.notes[c.chapter_id].slice(0,50000);
    if(isObject(incoming.choices))for(const [id,choice] of Object.entries(incoming.choices).slice(0,20000))if(safeId(id)>0&&typeof choice==='string'&&/^[A-Z]$/.test(choice))out.choices[id]=choice;
    if(isObject(incoming.responses))for(const [id,response] of Object.entries(incoming.responses))if(safeId(id)<0&&questionMap.has(Number(id))&&typeof response==='string')out.responses[id]=response.slice(0,50000);
    out.font=[16,17,18,19,20,21,22].includes(incoming.font)?incoming.font:18;
    return out;
  };
  try {const saved=localStorage.getItem(stateKey);if(saved)state=sanitizeState(JSON.parse(saved));localStorage.setItem(stateKey,JSON.stringify(state));}catch(error){storageAvailable=false;}
  const persist = () => {try{localStorage.setItem(stateKey,JSON.stringify(state));storageAvailable=true;}catch(error){storageAvailable=false;}updateStorageNote();};
  const updateStorageNote = () => {const el=byId('storage-note');if(el)el.textContent=storageAvailable?'Notes, self-check responses and progress are saved in this browser. A notes backup does not include your imported question bank.':'This browser is not saving local progress. Export a backup to keep notes, self-check responses and selections; the bank must be imported separately.';};
  const toast = message => {const el=byId('toast');el.textContent=message;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),2700);};
  let bankDbPromise = null, bankBusy = false, bankRevision = 0;
  let bankStorage = 'checking', storedBankMayExist = false, bankNotice = '';
  const openBankDb = () => {
    if(bankDbPromise) return bankDbPromise;
    bankDbPromise = new Promise((resolve, reject) => {
      if(!window.indexedDB) { reject(new Error('Browser database storage is unavailable.')); return; }
      let request, settled = false;
      const fail = error => { if(!settled) { settled = true; clearTimeout(timer); reject(error); } };
      const timer = setTimeout(() => fail(new Error('Browser database storage did not respond.')), 5000);
      try { request = window.indexedDB.open('series63.public-companion.bank.v1', 1); }
      catch(error) { fail(error); return; }
      request.onupgradeneeded = () => {
        if(!request.result.objectStoreNames.contains('banks')) request.result.createObjectStore('banks');
      };
      request.onerror = () => fail(request.error || new Error('Browser database storage could not open.'));
      request.onblocked = () => fail(new Error('Another tab is blocking browser database storage.'));
      request.onsuccess = () => {
        if(settled) { request.result.close(); return; }
        settled = true; clearTimeout(timer);
        const db = request.result;
        db.onversionchange = () => { db.close(); bankDbPromise = null; };
        resolve(db);
      };
    }).catch(error => { bankDbPromise = null; throw error; });
    return bankDbPromise;
  };
  const bankTransaction = async (action, value) => {
    const db = await openBankDb();
    return new Promise((resolve, reject) => {
      let tx, request;
      try {
        tx = db.transaction('banks', action === 'get' ? 'readonly' : 'readwrite');
        const store = tx.objectStore('banks');
        request = action === 'get' ? store.get('licensed') : action === 'put' ? store.put(value, 'licensed') : store.delete('licensed');
      } catch(error) { reject(error); return; }
      tx.oncomplete = () => resolve(action === 'get' ? request.result : undefined);
      tx.onerror = () => reject(tx.error || request.error || new Error('Browser database operation failed.'));
      tx.onabort = () => reject(tx.error || new Error('Browser database operation was cancelled.'));
    });
  };
  const updateBankStatus = () => {
    const count = licensedBank?.questions.length || 0;
    let message;
    if(bankBusy) message = 'Updating your local question bank… The file stays in this browser.';
    else if(count) {
      const origin = `${count.toLocaleString()} private questions from ${licensedBank.filename}. `;
      message = origin + (bankStorage === 'persistent'
        ? 'Saved locally in this browser. It will be restored on this device; nothing was uploaded.'
        : 'Available in this tab only: browser storage could not save this import. Keep the original file to import again.' + (storedBankMayExist ? ' A previously saved bank may still remain in browser storage.' : ''));
    } else if(bankStorage === 'checking') message = `${authoredQuestions.length} authored self-checks are ready. Checking this browser for a saved private bank…`;
    else if(bankStorage === 'removal_failed') message = 'No private questions are active in this tab. The saved copy could not be removed from browser storage; retry Remove bank or clear this site’s stored data.';
    else message = `${authoredQuestions.length} authored self-checks are ready. Import your private companion HTML or question-bank JSON to add licensed questions locally. No file is uploaded.`;
    if(bankNotice && !bankBusy) message += ' ' + bankNotice;
    const status = byId('bank-status');
    if(status) { status.textContent = message; status.setAttribute('role','status'); status.setAttribute('aria-live','polite'); }
    const importButton = byId('import-bank'), removeButton = byId('remove-bank'), input = byId('bank-file');
    if(importButton) importButton.disabled = bankBusy;
    if(removeButton) { removeButton.disabled = bankBusy || (!count && !storedBankMayExist); removeButton.hidden = !count && !storedBankMayExist; }
    if(input) input.disabled = bankBusy;
    const source = byId('practice-source');
    if(source) {
      const checks = source.querySelector('option[value="checks"]'), bank = source.querySelector('option[value="private"]');
      if(checks) checks.textContent = `${authoredQuestions.length} authored self-checks`;
      if(bank) bank.textContent = count ? `${count.toLocaleString()} private questions` : 'Private bank (import first)';
    }
    $$('[data-check-count]').forEach(el => el.textContent = authoredQuestions.length.toLocaleString());
    $$('[data-private-count]').forEach(el => el.textContent = count.toLocaleString());
    $$('[data-practice-count]').forEach(el => el.textContent = (authoredQuestions.length + count).toLocaleString());
  };
  const refreshQuestionData = () => {
    allQuestions = [...authoredQuestions, ...(licensedBank?.questions || [])];
    questionMap.clear(); allQuestions.forEach(q => questionMap.set(q.id, q));
    sourceMap.clear(); DATA.sources.forEach(s => sourceMap.set(s.source_key, s));
    // Local sources can supplement the public references but cannot replace them.
    (licensedBank?.sources || []).forEach(s => { if(!sourceMap.has(s.source_key)) sourceMap.set(s.source_key, s); });
    questionIndex = allQuestions.map(q => ({id:q.id,haystack:normalize(q.id+' '+q.text+' '+q.explanation+' '+q.options.join(' '))}));
    updateBankStatus(); filterPractice(); runSearch();
    if(byId('notebook-dialog')?.open) renderNotebook();
  };
  const restoreBank = async () => {
    const revision = bankRevision;
    try {
      const saved = await bankTransaction('get');
      if(revision !== bankRevision) return;
      storedBankMayExist = Boolean(saved);
      if(saved) {
        if(saved.version !== 1) throw new Error('The saved bank uses an unsupported version.');
        licensedBank = validateBankPayload(saved, saved.filename || 'Saved local question bank');
        bankStorage = 'persistent';
      } else bankStorage = 'none';
    } catch(error) {
      if(revision !== bankRevision) return;
      bankStorage = 'unavailable'; storedBankMayExist = true;
      bankNotice = 'A saved bank could not be restored. You can still import a file for this tab.';
    } finally {
      if(revision === bankRevision) refreshQuestionData();
    }
  };
  const importBank = async file => {
    if(!file || bankBusy) return;
    const revision = ++bankRevision;
    if(bankStorage === 'checking') storedBankMayExist = true;
    bankBusy = true; bankNotice = ''; updateBankStatus();
    try {
      if(file.size > MAX_IMPORT_BYTES) throw new Error('The bank file exceeds the 25 MB import limit.');
      const bank = parseBankFile(await file.text(), file.name);
      if(revision !== bankRevision) return;
      licensedBank = bank; bankStorage = 'memory';
      byId('practice-source').value = 'private';
      try {
        await bankTransaction('put', bank);
        if(revision !== bankRevision) return;
        bankStorage = 'persistent'; storedBankMayExist = true;
      } catch(error) {
        bankStorage = 'memory';
      }
      toast(`${bank.questions.length.toLocaleString()} private questions imported locally.`);
    } catch(error) {
      bankNotice = 'Import failed: ' + error.message;
      toast('Could not import the question bank. See the bank status for details.');
    } finally {
      if(revision === bankRevision) {
        bankBusy = false; refreshQuestionData();
        if(bankStorage === 'checking') void restoreBank();
      }
      if(byId('bank-file')) byId('bank-file').value = '';
    }
  };
  const removeBank = async () => {
    if(bankBusy) return;
    const revision = ++bankRevision;
    bankBusy = true; bankNotice = ''; licensedBank = null;
    byId('practice-source').value = 'checks';
    refreshQuestionData();
    try {
      await bankTransaction('delete');
      if(revision !== bankRevision) return;
      storedBankMayExist = false; bankStorage = 'none';
      bankNotice = 'The private bank was removed. Your notes and saved question IDs remain for a future reimport.';
      toast('Private bank removed from this browser.');
    } catch(error) {
      bankStorage = 'removal_failed'; storedBankMayExist = true;
      toast('The bank is inactive, but its saved copy could not be removed.');
    } finally {
      if(revision === bankRevision) { bankBusy = false; refreshQuestionData(); }
    }
  };
  const closeMenu = () => {byId('sidebar').classList.remove('open');byId('mobile-backdrop').classList.remove('active');byId('menu-toggle').setAttribute('aria-expanded','false');};
  const openDialog = id => {const dialog=byId(id);$$('dialog[open]').forEach(d=>d.close());lastFocus=document.activeElement;dialog.showModal();document.body.style.overflow='hidden';};
  const closeDialog = dialog => {dialog.close();document.body.style.overflow='';lastFocus?.focus?.({preventScroll:true});};
  $$('dialog').forEach(dialog=>{
    dialog.addEventListener('close',()=>{if(!document.querySelector('dialog[open]'))document.body.style.overflow='';});
    dialog.addEventListener('click',event=>{if(event.target===dialog){const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)closeDialog(dialog);}});
  });
  const goTo = id => {$$('dialog[open]').forEach(d=>d.close());document.body.style.overflow='';closeMenu();const target=byId(id);if(!target)return;if(target.matches('details'))target.open=true;let parent=target.parentElement;while(parent){if(parent.matches('details'))parent.open=true;parent=parent.parentElement;}target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});try{history.replaceState(null,'','#'+encodeURIComponent(id));}catch(error){location.hash=id;}};
  const renderSourceLinks = keys => keys.filter(k=>sourceMap.has(k)).map(k=>{const s=sourceMap.get(k);return `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.short_title||s.title)}</a>`;}).join(' · ');
  const updateProgress = () => {
    byId('progress-fill').style.width=`${state.read.length/7*100}%`;
    byId('progress-text').textContent=`${state.read.length} of 7 chapters marked as read`;
    $$('[data-read]').forEach(input=>input.checked=state.read.includes(input.dataset.read));
    $$('[data-chapter-nav]').forEach(a=>a.classList.toggle('complete',state.read.includes(a.dataset.chapterNav)));
    $$('[data-save-concept]').forEach(button=>{const saved=state.saved.includes(button.dataset.saveConcept);button.classList.toggle('saved',saved);button.setAttribute('aria-pressed',String(saved));button.textContent=saved?'✓ On review list':'Save for review';});
    document.documentElement.style.setProperty('--reading',state.font+'px');
  };
  const openGlossary = (termId='') => {byId('glossary-search').value='';renderGlossary();openDialog('glossary-dialog');if(termId){const entry=byId('glossary-'+termId);if(entry){entry.scrollIntoView({block:'start'});entry.setAttribute('tabindex','-1');entry.focus({preventScroll:true});}}else byId('glossary-search').focus();};
  const renderGlossary = () => {
    const q=normalize(byId('glossary-search').value.trim());
    const terms=DATA.glossary.filter(g=>normalize(g.term+' '+g.definition+' '+g.context).includes(q));
    byId('glossary-count').textContent=`${terms.length} ${terms.length===1?'definition':'definitions'}`;
    byId('glossary-results').innerHTML=terms.length?terms.map(g=>`<article class="glossary-entry" id="glossary-${esc(g.id)}"><h3>${esc(g.term)}</h3><p>${esc(g.definition)}</p>${g.context?`<p class="glossary-context">${esc(g.context)}</p>`:''}<button class="ghost-button" data-goto="${esc(g.chapter_id)}">Read in chapter ${esc(g.chapter_id.slice(1).replace(/^0/,''))}</button><div class="sources-line">${renderSourceLinks(g.source_keys||[])}</div></article>`).join(''):'<p class="empty-state">No matching definition. Try a shorter word.</p>';
  };
  let searchTimer;
  const chapterIndex=DATA.sections.map(s=>({...s,haystack:normalize(s.title+' '+s.text)}));
  const conceptIndex=DATA.concepts.map(c=>({...c,haystack:normalize(c.concept_id+' '+c.title+' '+c.definition+' '+c.core_idea)}));
  let questionIndex=allQuestions.map(q=>({id:q.id,haystack:normalize(q.id+' '+q.text+' '+q.explanation+' '+q.options.join(' '))}));
  const searchGroup=(title,items)=>items.length?`<div class="results-group"><h3>${esc(title)}</h3>${items.join('')}</div>`:'';
  const snippet=(text,q,max=160)=>{const lower=normalize(text);let i=lower.indexOf(q);const start=Math.max(0,i-35);return(start?'…':'')+text.slice(start,start+max)+(start+max<text.length?'…':'');};
  const runSearch=()=>{
    const q=normalize(byId('global-search').value.trim());
    if(q.length<2){byId('search-results').innerHTML='';byId('search-count').textContent=`Search definitions, lessons and ${authoredQuestions.length} authored self-checks${licensedBank?' plus '+licensedBank.questions.length.toLocaleString()+' locally imported private questions':''}.`;return;}
    const gs=DATA.glossary.filter(g=>normalize(g.term+' '+g.definition).includes(q));
    const cs=conceptIndex.filter(c=>c.haystack.includes(q));
    const ss=chapterIndex.filter(s=>s.haystack.includes(q));
    const qs=questionIndex.filter(x=>x.haystack.includes(q));
    let html=searchGroup('Definitions',gs.slice(0,5).map(g=>`<button class="result-button" data-term="${esc(g.id)}"><strong>${esc(g.term)}</strong>${esc(snippet(g.definition,q,145))}</button>`));
    html+=searchGroup('Concepts',cs.slice(0,6).map(c=>`<button class="result-button" data-goto="concept-${esc(c.concept_id)}"><strong>${esc(c.concept_id)} · ${esc(c.title)}</strong><small>${esc(snippet(c.definition,q))}</small></button>`));
    html+=searchGroup('Lessons',ss.slice(0,5).map(s=>`<button class="result-button" data-goto="${esc(s.section_id)}"><strong>${esc(s.title)}</strong><small>Chapter ${esc(s.chapter_id.slice(1).replace(/^0/,''))} · ${esc(snippet(s.text,q))}</small></button>`));
    html+=searchGroup('Practice',qs.slice(0,7).map(r=>{const x=questionMap.get(r.id);return `<button class="result-button" data-question="${x.id}"><strong>${x.practice_kind==='self_check'?'Self-check':'Private question '+x.id} · ${esc(x.concept_id)}</strong><small>${esc(snippet(x.text,q,175))}</small></button>`;}));
    const total=gs.length+cs.length+ss.length+qs.length;
    byId('search-results').innerHTML=html||'<p class="empty-state">No matches. Try another term or a question ID.</p>';
    byId('search-count').textContent=`${total} matches · ${qs.length} in available practice. Showing a selection in each group.`;
  };
  let practice={pool:[],index:0,revealed:false};
  const fillConceptFilter=()=>{const chapter=byId('practice-chapter').value,selected=byId('practice-concept').value;const cs=DATA.concepts.filter(c=>!chapter||c.chapter_id===chapter);byId('practice-concept').innerHTML='<option value="">All concepts</option>'+cs.map(c=>`<option value="${c.concept_id}">${esc(c.concept_id)} · ${esc(c.title)}</option>`).join('');if(cs.some(c=>c.concept_id===selected))byId('practice-concept').value=selected;};
  const filterPractice=()=>{
    const chapter=byId('practice-chapter').value,concept=byId('practice-concept').value,query=normalize(byId('practice-search').value.trim()),review=byId('practice-review-only').checked;
    const pool=byId('practice-source').value==='private'?(licensedBank?.questions||[]):authoredQuestions;
    practice.pool=pool.filter(q=>(!chapter||q.chapter_id===chapter)&&(!concept||q.concept_id===concept)&&(!review||state.reviewQuestions.includes(q.id)||state.saved.includes(q.concept_id))&&(!query||normalize(q.id+' '+q.text+' '+q.explanation+' '+q.options.join(' ')).includes(query)));
    practice.index=0;practice.revealed=false;renderPractice();
  };
  const openPractice=({chapter='',concept='',question=null,review=false}={})=>{
    if(question!==null)byId('practice-source').value=Number(question)>0?'private':'checks';
    byId('practice-chapter').value=chapter;
    fillConceptFilter();
    byId('practice-concept').value=concept;
    byId('practice-search').value='';
    byId('practice-review-only').checked=review;
    filterPractice();
    if(question!==null){const ix=practice.pool.findIndex(q=>q.id===Number(question));if(ix>=0){practice.index=ix;renderPractice();}}
    openDialog('practice-dialog');
    byId('practice-body').scrollTop=0;
  };
  const renderPractice=()=>{
    const q=practice.pool[practice.index];
    const isCheck=q?.practice_kind==='self_check';
    byId('practice-position').textContent=practice.pool.length?`${practice.index+1} of ${practice.pool.length.toLocaleString()} ${isCheck?'self-checks':'private questions'}`:'No practice matches';
    byId('practice-prev').disabled=!q||practice.index===0;
    byId('practice-next').disabled=!q||practice.index>=practice.pool.length-1;
    byId('practice-random').disabled=!q;
    if(!q){byId('practice-question').innerHTML=byId('practice-source').value==='private'&&!licensedBank?'<p class="empty-state">Use the local file button above to import your private companion HTML or question-bank JSON. The authored self-checks are available now under Practice source.</p>':'<p class="empty-state">No practice matches these filters. Try another concept, change the practice source or clear the review filter.</p>';return;}
    const selected=state.choices[q.id];
    const selection=!isCheck&&typeof selected==='string'&&selected.charCodeAt(0)-65<q.options.length?selected:null;
    const marked=state.reviewQuestions.includes(q.id);
    const cautions=(q.cautions||[]).map(c=>`<aside class="source-note"><strong>${esc(c.title)}</strong>${esc(c.note)}${c.status?`<div class="small muted">Source note status: ${esc(c.status.replace(/_/g,' '))}</div>`:''}${c.source_keys?.length?`<div class="sources-line">${renderSourceLinks(c.source_keys)}</div>`:''}</aside>`).join('');
    const mappingNote=q.review_note?`<aside class="source-note"><strong>Study mapping note</strong>${esc(q.review_note)}</aside>`:'';
    const pages=q.page_start?` · page ${q.page_start}${q.page_end&&q.page_end!==q.page_start?'–'+q.page_end:''}`:'';
    const origin=isCheck?'Authored concept self-check':(q.library_id?`<a href="https://chatgpt.com/library?file_id=${esc(q.library_id)}&account_id=personal" target="_blank" rel="noopener noreferrer">Original PDF</a>`:esc(q.source_pdf||'Locally imported question'))+pages;
    const topic=q.topic?`<span>${esc(q.topic)}${Number.isFinite(q.weight)?' · '+q.weight+'% exam topic':''}</span>`:'';
    const response=isCheck?`<div class="note-block self-check-response"><label for="self-check-response">Your reasoning</label><textarea id="self-check-response" data-self-check="${q.id}" maxlength="50000" placeholder="Explain the rule and apply it to the facts before reading the model answer.">${esc(state.responses[q.id]||'')}</textarea></div>`:`<div class="choices" role="group" aria-label="Choose an option">${q.options.map((text,index)=>{const letter=String.fromCharCode(65+index);return `<button class="choice ${selection===letter?'selected':''}" data-choice="${letter}" aria-pressed="${selection===letter}"><span class="letter">${letter}</span><span>${esc(text)}</span></button>`;}).join('')}</div>`;
    const gradeNote=isCheck?'Compare your explanation with the model answer. Self-checks are ungraded.':`${selection?'Your selection: '+selection+'. ':''}Compare your reasoning with the original explanation. This companion does not infer an answer key or assign a grade.`;
    const answerStatus=!isCheck&&q.answer_status?`<p class="small muted">Imported answer status: ${esc(q.answer_status.replace(/_/g,' '))}.</p>`:'';
    const classificationNote=!isCheck&&q.classification_review?'<p class="small muted">The imported topic classification is flagged for review.</p>':'';
    byId('practice-question').innerHTML=`<div class="question-meta"><span>${isCheck?'Self-check':'Q'+q.id}</span><span>${esc(q.concept_id)}</span>${topic}${q.cautions?.length?'<span>Source note included</span>':''}</div><div class="question-text">${esc(q.text)}</div>${response}<div class="practice-actions"><button class="button" data-reveal>${practice.revealed?(isCheck?'Hide model answer':'Hide explanation'):(isCheck?'Read model answer':'Read explanation')}</button><button class="ghost-button ${marked?'saved':''}" data-review-question aria-pressed="${marked}">${marked?'✓ On review list':'Save for review'}</button></div>${practice.revealed?`<div class="explanation"><h4>${isCheck?'Model answer':'Original source explanation'}</h4>${esc(q.explanation)}</div>${cautions}${mappingNote}${classificationNote}${answerStatus}<p class="small muted">${gradeNote}</p>`:''}<div class="question-origin">${origin} · <button class="practice-ref" data-goto="concept-${esc(q.concept_id)}">Read this concept</button>${isCheck&&q.source_keys?.length?`<div class="sources-line">${renderSourceLinks(q.source_keys)}</div>`:''}</div>`;
  };
  const renderNotebook=()=>{
    const saved=state.saved.map(id=>conceptMap.get(id)).filter(Boolean);
    byId('saved-concepts').innerHTML=saved.length?saved.map(c=>`<div class="saved-concept"><button data-goto="concept-${c.concept_id}">${esc(c.concept_id)} · ${esc(c.title)}</button><button class="remove" data-remove-concept="${c.concept_id}" aria-label="Remove ${esc(c.concept_id)} from review list">Remove</button></div>`).join(''):'<p class="small muted">Use “Save for review” in a concept to keep it here.</p>';
    const available=state.reviewQuestions.filter(id=>questionMap.has(id)).length,pending=state.reviewQuestions.length-available;
    byId('saved-question-count').textContent=`${available} individual practice items available for review.${pending?' '+pending+' saved private-question IDs will be available when their bank is imported.':''}`;
    byId('notebook-notes').innerHTML=DATA.chapters.map(c=>`<div class="note-block"><label for="note-${c.chapter_id}">${c.chapter_id.slice(1).replace(/^0/,'')}. ${esc(c.title)}</label><textarea id="note-${c.chapter_id}" data-note="${c.chapter_id}" maxlength="50000" placeholder="In my own words… A distinction to remember… A question to revisit…">${esc(state.notes[c.chapter_id]||'')}</textarea></div>`).join('');
    updateStorageNote();
  };
  const exportState=()=>{const payload={...state,exported_at:new Date().toISOString(),guide_version:DATA.version};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='Series63_Study_Backup_'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);toast('Backup exported. Keep it with your study file.');};
  document.addEventListener('click',event=>{
    const button=event.target.closest('button,a');if(!button)return;
    if(button.dataset.close!==undefined){closeDialog(button.closest('dialog'));return;}
    if(button.dataset.term){event.preventDefault();openGlossary(button.dataset.term);return;}
    if(button.dataset.goto){event.preventDefault();goTo(button.dataset.goto);return;}
    if(button.dataset.question){openPractice({question:Number(button.dataset.question)});return;}
    if(button.dataset.practiceConcept){openPractice({concept:button.dataset.practiceConcept});return;}
    if(button.dataset.practiceChapter){openPractice({chapter:button.dataset.practiceChapter});return;}
    if(button.dataset.saveConcept){const id=button.dataset.saveConcept;state.saved=state.saved.includes(id)?state.saved.filter(x=>x!==id):[...state.saved,id];persist();updateProgress();toast(state.saved.includes(id)?'Concept added to your review list.':'Concept removed from your review list.');return;}
    if(button.dataset.removeConcept){state.saved=state.saved.filter(id=>id!==button.dataset.removeConcept);persist();updateProgress();renderNotebook();return;}
    if(button.dataset.choice){const q=practice.pool[practice.index],choice=button.dataset.choice;if(q&&q.practice_kind!=='self_check'&&/^[A-Z]$/.test(choice)&&choice.charCodeAt(0)-65<q.options.length){state.choices[q.id]=choice;persist();renderPractice();}return;}
    if(button.hasAttribute('data-reveal')){practice.revealed=!practice.revealed;renderPractice();if(practice.revealed)byId('practice-question').querySelector('.explanation').scrollIntoView({behavior:'smooth',block:'nearest'});return;}
    if(button.hasAttribute('data-review-question')){const q=practice.pool[practice.index];if(q){state.reviewQuestions=state.reviewQuestions.includes(q.id)?state.reviewQuestions.filter(id=>id!==q.id):[...state.reviewQuestions,q.id];persist();renderPractice();}return;}
    const action=button.dataset.action;
    if(action==='search'){openDialog('search-dialog');byId('global-search').focus();}
    if(action==='glossary')openGlossary();
    if(action==='practice')openPractice();
    if(action==='notebook'){renderNotebook();openDialog('notebook-dialog');}
    if(action==='review-practice')openPractice({review:true});
    if(action==='export')exportState();
    if(action==='import')byId('import-file').click();
    if(action==='print')window.print();
    if(action==='font-plus'){state.font=Math.min(22,state.font+1);persist();updateProgress();}
    if(action==='font-minus'){state.font=Math.max(16,state.font-1);persist();updateProgress();}
  });
  document.addEventListener('change',event=>{const input=event.target;if(input.dataset.read){const id=input.dataset.read;state.read=input.checked?[...new Set([...state.read,id])]:state.read.filter(x=>x!==id);persist();updateProgress();}});
  document.addEventListener('input',event=>{
    if(event.target.dataset.note){state.notes[event.target.dataset.note]=event.target.value;persist();}
    if(event.target.dataset.selfCheck){const id=safeId(event.target.dataset.selfCheck);if(id<0&&questionMap.get(id)?.practice_kind==='self_check'){state.responses[id]=event.target.value.slice(0,50000);persist();}}
  });
  byId('glossary-search').addEventListener('input',renderGlossary);
  byId('global-search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(runSearch,150);});
  byId('practice-chapter').innerHTML='<option value="">All chapters</option>'+DATA.chapters.map(c=>`<option value="${c.chapter_id}">${c.chapter_id.slice(1).replace(/^0/,'')}. ${esc(c.title)}</option>`).join('');
  fillConceptFilter();
  byId('practice-source').addEventListener('change',filterPractice);
  byId('practice-chapter').addEventListener('change',()=>{fillConceptFilter();filterPractice();});
  byId('practice-concept').addEventListener('change',filterPractice);
  byId('practice-review-only').addEventListener('change',filterPractice);
  let practiceSearchTimer;
  byId('practice-search').addEventListener('input',()=>{clearTimeout(practiceSearchTimer);practiceSearchTimer=setTimeout(filterPractice,170);});
  byId('practice-prev').addEventListener('click',()=>{practice.index=Math.max(0,practice.index-1);practice.revealed=false;renderPractice();byId('practice-body').scrollTop=0;});
  byId('practice-next').addEventListener('click',()=>{practice.index=Math.min(practice.pool.length-1,practice.index+1);practice.revealed=false;renderPractice();byId('practice-body').scrollTop=0;});
  byId('practice-random').addEventListener('click',()=>{if(practice.pool.length){let next=Math.floor(Math.random()*practice.pool.length);if(practice.pool.length>1&&next===practice.index)next=(next+1)%practice.pool.length;practice.index=next;practice.revealed=false;renderPractice();byId('practice-body').scrollTop=0;}});
  byId('import-file').addEventListener('change',async event=>{const file=event.target.files[0];if(!file)return;try{if(file.size>5000000)throw new Error('The backup is too large.');const incoming=sanitizeState(JSON.parse(await file.text()));state=incoming;persist();updateProgress();renderNotebook();filterPractice();toast('Study backup restored.');}catch(error){toast('Could not import: '+error.message);}finally{event.target.value='';}});
  byId('import-bank').addEventListener('click',()=>byId('bank-file').click());
  byId('bank-file').addEventListener('change',event=>{void importBank(event.target.files?.[0]);});
  byId('remove-bank').addEventListener('click',()=>{void removeBank();});
  byId('menu-toggle').addEventListener('click',()=>{const open=byId('sidebar').classList.toggle('open');byId('mobile-backdrop').classList.toggle('active',open);byId('menu-toggle').setAttribute('aria-expanded',String(open));});
  byId('mobile-backdrop').addEventListener('click',closeMenu);
  $$('.chapter-nav a').forEach(a=>a.addEventListener('click',closeMenu));
  document.addEventListener('keydown',event=>{const input=/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName||'');if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();openDialog('search-dialog');byId('global-search').focus();}if(event.key==='Escape')closeMenu();if(event.key==='/'&&!input&&!document.querySelector('dialog[open]')){event.preventDefault();openDialog('search-dialog');byId('global-search').focus();}});
  let scrollScheduled=false;
  const updateActiveChapter=()=>{scrollScheduled=false;let next='C01';for(const chapter of DATA.chapters){const el=byId(chapter.chapter_id);if(el.getBoundingClientRect().top<=150)next=chapter.chapter_id;else break;}if(next!==activeChapter){activeChapter=next;$$('[data-chapter-nav]').forEach(a=>{const active=a.dataset.chapterNav===next;a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});const c=chapterMap.get(next);byId('breadcrumb').textContent=c.chapter_id.slice(1).replace(/^0/,'')+' / '+c.title;}};
  window.addEventListener('scroll',()=>{if(!scrollScheduled){scrollScheduled=true;requestAnimationFrame(updateActiveChapter);}},{passive:true});
  let printOpened=[];
  window.addEventListener('beforeprint',()=>{printOpened=$$('details:not([open])');printOpened.forEach(d=>d.open=true);});
  window.addEventListener('afterprint',()=>{printOpened.forEach(d=>d.open=false);printOpened=[];});
  updateProgress();updateActiveChapter();updateBankStatus();runSearch();
  void restoreBank();
  if(location.hash){let target;try{target=decodeURIComponent(location.hash.slice(1));}catch(error){target='';}if(target.startsWith('concept-')&&byId(target))setTimeout(()=>goTo(target),50);}
  document.documentElement.dataset.ready='true';
})();
