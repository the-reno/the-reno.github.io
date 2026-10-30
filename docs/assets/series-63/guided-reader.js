'use strict';
(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const chapters = $$('.chapter');
  if (!chapters.length || document.getElementById('guided-reader')) return;

  const STORAGE_KEY = 'series63.guided-reading.v1';
  const RATES = [0.8, 1, 1.15, 1.3];
  const synth = typeof window.speechSynthesis === 'object' ? window.speechSynthesis : null;
  const canSpeak = Boolean(synth && typeof window.SpeechSynthesisUtterance === 'function');
  const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const textOf = element => (element?.textContent || '').replace(/\s+/g, ' ').trim();
  const chapterName = chapter => textOf($('.chapter-header h2', chapter));
  const sectionName = section => textOf($('h3', section));
  const chapterById = id => chapters.find(chapter => chapter.id === id);

  // The narration only visits the original, public reading surface. Private
  // practice data and notes are never read by this module or sent to a voice.
  const collectPassages = (chapter, withComments) => {
    const passages = [];
    const add = (elements, sectionId, kind, label) => {
      elements.forEach((element, index) => {
        const text = textOf(element);
        if (!text) return;
        passages.push({
          key: `${chapter.id}:${sectionId}:${kind}:${index}`,
          element, sectionId, kind, label, text
        });
      });
    };
    add($$('.chapter-header h2, .chapter-opening > p', chapter), 'intro', 'reading', chapterName(chapter));
    $$('.study-section', chapter).forEach(section => {
      const label = sectionName(section);
      add($$(':scope > h3, :scope > .definition > p, :scope > .narrative > p', section), section.id, 'reading', label);
      if (withComments) add($$('.guided-commentary-body > p:not(.sources-line)', section), section.id, 'comment', label);
      add($$('.application-content > p', section), section.id, 'application', label);
    });
    add($$('.chapter-close > p', chapter), 'closing', 'reading', 'Putting it together');
    return passages;
  };

  // Short sentences keep native speech engines responsive. A long legal
  // sentence is split at a word boundary; no estimated audio timing is used.
  const sentenceChunks = text => {
    let sentences;
    try {
      sentences = [...new Intl.Segmenter('en', {granularity: 'sentence'}).segment(text)].map(item => item.segment.trim());
    } catch (error) {
      sentences = text.match(/[^.!?]+(?:[.!?]+["')\]]*|$)/g) || [text];
    }
    const chunks = [];
    for (const sentence of sentences) {
      let remaining = sentence.trim();
      while (remaining.length > 320) {
        let split = remaining.lastIndexOf(' ', 300);
        if (split < 80) split = 300;
        chunks.push(remaining.slice(0, split).trim());
        remaining = remaining.slice(split).trim();
      }
      if (remaining) chunks.push(remaining);
    }
    return chunks;
  };

  let saved = {};
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (value && typeof value === 'object' && !Array.isArray(value)) saved = value;
  } catch (error) { /* Reading remains available without browser storage. */ }
  const settings = {
    comments: saved.comments !== false,
    follow: saved.follow !== false,
    rate: RATES.includes(saved.rate) ? saved.rate : 1,
    voice: typeof saved.voice === 'string' && saved.voice.length <= 1000 ? saved.voice : ''
  };
  let chapter = chapterById(saved.chapter) || chapters[0];
  let passages = collectPassages(chapter, settings.comments);
  let position = Math.max(0, passages.findIndex(passage => passage.key === saved.passage));
  let chunks = sentenceChunks(passages[position]?.text || '');
  let chunkIndex = Number.isSafeInteger(saved.sentence) && saved.sentence >= 0 && saved.sentence < chunks.length ? saved.sentence : 0;
  let open = false;
  let phase = 'idle';
  let voices = [];
  let currentElement = null;
  let currentUtterance = null;
  let generation = 0;
  let startTimer = null;
  let endTimer = null;
  let returnFocus = null;
  let lastMessage = '';

  const player = document.createElement('section');
  player.id = 'guided-reader';
  player.className = 'guided-reader';
  player.hidden = true;
  player.setAttribute('role', 'region');
  player.setAttribute('aria-label', 'Guided reading');
  // This template contains only fixed interface text; source content is
  // subsequently assigned with textContent and never interpreted as HTML.
  player.innerHTML = `
    <div class="guided-topline">
      <div class="guided-heading">
        <span class="guided-eyebrow">Read with context</span>
        <strong id="guided-title">Guided reading</strong>
        <p id="guided-status" role="status" aria-live="polite" aria-atomic="true"></p>
      </div>
      <div class="guided-transport" role="group" aria-label="Reading controls">
        <button type="button" class="guided-button" id="guided-prev" aria-label="Previous passage">Previous</button>
        <button type="button" class="guided-button guided-primary" id="guided-play">Play</button>
        <button type="button" class="guided-button" id="guided-next" aria-label="Next passage">Next</button>
        <button type="button" class="guided-button guided-close" id="guided-close" aria-label="Close guided reading and stop audio">Close</button>
      </div>
    </div>
    <div class="guided-location">
      <span id="guided-position"></span>
      <progress id="guided-progress" value="0" max="1" aria-label="Reading progress"></progress>
    </div>
    <div class="guided-disclosures">
      <details class="guided-settings" id="guided-settings">
        <summary>Reading settings</summary>
        <div class="guided-options">
          <label class="guided-field">Chapter<select id="guided-chapter"></select></label>
          <label class="guided-field">Start at<select id="guided-section"></select></label>
          <label class="guided-field">Pace<select id="guided-rate"><option value="0.8">0.8× · slower</option><option value="1">1× · natural</option><option value="1.15">1.15×</option><option value="1.3">1.3×</option></select></label>
          <label class="guided-field">Voice<select id="guided-voice"></select></label>
        </div>
        <div class="guided-checks">
          <label class="guided-check"><input type="checkbox" id="guided-comments" checked> Include practical explanations</label>
          <label class="guided-check"><input type="checkbox" id="guided-follow" checked> Follow the highlighted text</label>
        </div>
        <p class="guided-help">Use Next to read silently. Voice availability and sound depend on your browser and device.</p>
      </details>
      <details class="guided-transcript" id="guided-transcript">
        <summary>Current passage</summary>
        <p id="guided-text"></p>
      </details>
    </div>`;
  document.body.appendChild(player);
  const ui = Object.fromEntries(['title', 'status', 'prev', 'play', 'next', 'close', 'position', 'progress', 'chapter', 'section', 'rate', 'voice', 'comments', 'follow', 'text'].map(name => [name, document.getElementById(`guided-${name}`)]));

  const option = (value, text) => {
    const element = document.createElement('option');
    element.value = value;
    element.textContent = text;
    return element;
  };
  chapters.forEach((item, index) => ui.chapter.appendChild(option(item.id, `${index + 1}. ${chapterName(item)}`)));
  ui.rate.value = String(settings.rate);
  ui.comments.checked = settings.comments;
  ui.follow.checked = settings.follow;

  const save = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 1, chapter: chapter.id, passage: passages[position]?.key || '', sentence: chunkIndex,
        comments: settings.comments, follow: settings.follow, rate: settings.rate, voice: settings.voice
      }));
    } catch (error) { /* Controls also work with storage disabled. */ }
  };
  const announce = message => {
    if (message !== lastMessage) {
      lastMessage = message;
      ui.status.textContent = message;
    }
  };
  const noVoiceMessage = () => !canSpeak
    ? 'Audio is unavailable in this browser. Read the highlighted passage and use Next.'
    : 'No English voice is available yet. Read the highlighted passage and use Next, or check your device voices.';
  const readyMessage = () => voices.length
    ? 'Ready. Press Play to listen, or use Next to read at your own pace.'
    : noVoiceMessage();
  const active = () => phase === 'playing' || phase === 'starting';

  const updateSections = () => {
    ui.section.replaceChildren(option('intro', 'Chapter opening'));
    $$('.study-section', chapter).forEach(section => ui.section.appendChild(option(section.id, sectionName(section))));
    ui.section.appendChild(option('closing', 'Putting it together'));
    ui.chapter.value = chapter.id;
  };
  const updatePlayerHeight = () => {
    document.documentElement.style.setProperty('--guided-player-height', open ? `${Math.ceil(player.getBoundingClientRect().height)}px` : '0px');
  };
  const scrollToPassage = () => {
    if (!open || !settings.follow || !currentElement || $('dialog[open]')) return;
    const rect = currentElement.getBoundingClientRect();
    const top = Math.max(0, $('.topbar')?.getBoundingClientRect().bottom || 0) + 24;
    const bottom = Math.max(top + 80, player.getBoundingClientRect().top - 24);
    if (rect.top < top || (rect.bottom > bottom && rect.top > top + 10)) {
      window.scrollTo({top: Math.max(0, window.scrollY + rect.top - top), behavior: reducedMotion() ? 'auto' : 'smooth'});
    }
  };
  const clearHighlight = () => {
    if (!currentElement) return;
    currentElement.classList.remove('guided-current');
    currentElement.removeAttribute('aria-current');
    currentElement.removeAttribute('data-guided-kind');
    currentElement = null;
  };
  const highlight = (shouldScroll = true) => {
    clearHighlight();
    if (!open) return;
    const passage = passages[position];
    if (!passage) return;
    currentElement = passage.element;
    const disclosure = currentElement.closest('.guided-commentary');
    if (disclosure) disclosure.open = true;
    currentElement.classList.add('guided-current');
    currentElement.setAttribute('aria-current', 'true');
    currentElement.setAttribute('data-guided-kind', passage.kind);
    if (shouldScroll) window.requestAnimationFrame(scrollToPassage);
  };
  const render = () => {
    const passage = passages[position];
    ui.title.textContent = passage?.label || chapterName(chapter);
    ui.position.textContent = `${chapter.id.replace('C0', 'Chapter ')} · ${passage?.kind === 'comment' ? 'Explanation' : 'Passage'} ${position + 1} of ${passages.length}`;
    ui.progress.max = Math.max(1, passages.length);
    ui.progress.value = phase === 'ended' ? passages.length : position;
    ui.section.value = passage?.sectionId || 'intro';
    ui.text.textContent = passage?.text || '';
    ui.play.textContent = active() ? 'Pause' : phase === 'paused' ? 'Resume' : phase === 'ended' ? 'Replay chapter' : 'Play';
    ui.play.setAttribute('aria-label', active() ? 'Pause narration' : phase === 'paused' ? 'Resume narration from this sentence' : 'Play narration');
    ui.play.disabled = !canSpeak || !voices.length || !passages.length;
    ui.prev.disabled = position === 0 && chapters.indexOf(chapter) === 0;
    const last = position >= passages.length - 1;
    ui.next.disabled = last && chapters.indexOf(chapter) === chapters.length - 1;
    ui.next.textContent = last && !ui.next.disabled ? 'Next chapter' : 'Next';
    ui.next.setAttribute('aria-label', last && !ui.next.disabled ? 'Go to next chapter' : 'Next passage');
    player.dataset.state = phase;
    updatePlayerHeight();
  };
  const cancelSpeech = () => {
    generation += 1;
    window.clearTimeout(startTimer);
    window.clearTimeout(endTimer);
    startTimer = null;
    endTimer = null;
    const owned = Boolean(currentUtterance);
    currentUtterance = null;
    if (owned && canSpeak) {
      try { synth.cancel(); } catch (error) { /* The browser may have removed its voice. */ }
    }
  };
  const pause = message => {
    if (!active()) return;
    // Cancel at a sentence boundary instead of relying on browser-specific
    // pause implementations. Resume repeats only the unfinished sentence.
    cancelSpeech();
    phase = 'paused';
    announce(message || 'Paused. Resume starts from the current sentence.');
    save();
    render();
  };
  const audioFailed = message => {
    cancelSpeech();
    phase = 'error';
    announce(message || 'Audio stopped. Use Next to keep reading, or choose another voice and press Play.');
    save();
    render();
  };
  const preparePosition = (index, shouldScroll = true) => {
    position = Math.max(0, Math.min(index, passages.length - 1));
    chunks = sentenceChunks(passages[position]?.text || '');
    chunkIndex = 0;
    highlight(shouldScroll);
    save();
    render();
  };

  const speakSentence = () => {
    if (!open || !active() || !canSpeak || !voices.length || !chunks[chunkIndex]) return;
    const token = generation;
    const utterance = new window.SpeechSynthesisUtterance(chunks[chunkIndex]);
    currentUtterance = utterance;
    utterance.voice = voices.find(voice => voice.voiceURI === settings.voice) || voices[0];
    utterance.lang = utterance.voice.lang || 'en-US';
    utterance.rate = settings.rate;
    utterance.volume = 1;
    const valid = () => token === generation && currentUtterance === utterance && open && active();
    utterance.onstart = () => {
      if (!valid()) return;
      window.clearTimeout(startTimer);
      startTimer = null;
      phase = 'playing';
      announce(passages[position].kind === 'comment' ? 'Explaining the highlighted passage.' : 'Reading the highlighted passage.');
      render();
      const words = chunks[chunkIndex].split(/\s+/).length;
      endTimer = window.setTimeout(() => {
        if (valid()) audioFailed('The voice stopped responding. Use Next to read, or select another voice and press Play.');
      }, Math.max(30000, Math.ceil(words / (2 * settings.rate) * 1000) + 20000));
    };
    utterance.onend = () => {
      if (!valid()) return;
      window.clearTimeout(startTimer);
      window.clearTimeout(endTimer);
      startTimer = null;
      endTimer = null;
      currentUtterance = null;
      if (chunkIndex + 1 < chunks.length) {
        chunkIndex += 1;
        save();
        speakSentence();
      } else if (position + 1 < passages.length) {
        preparePosition(position + 1);
        speakSentence();
      } else {
        phase = 'ended';
        chunkIndex = 0;
        announce(chapters.indexOf(chapter) < chapters.length - 1
          ? 'Chapter complete. Choose Next chapter when you are ready.'
          : 'Guide complete. Revisit any chapter or try the related practice.');
        save();
        render();
      }
    };
    utterance.onerror = event => {
      if (!valid()) return;
      const message = event.error === 'not-allowed'
        ? 'Your browser blocked this voice. Press Play again or choose another voice. You can also read with Next.'
        : 'Audio could not continue with this voice. Use Next to read, or choose another voice and press Play.';
      audioFailed(message);
    };
    startTimer = window.setTimeout(() => {
      if (valid()) audioFailed('The voice did not start. Use Next to read, or choose another voice and press Play.');
    }, 10000);
    try { synth.speak(utterance); } catch (error) {
      if (valid()) audioFailed('Audio is unavailable here. Read the highlighted passage and use Next.');
    }
  };
  const play = () => {
    if (!open) return;
    if (!canSpeak || !voices.length) {
      phase = 'manual';
      announce(noVoiceMessage());
      render();
      return;
    }
    cancelSpeech();
    if (phase === 'ended') preparePosition(0);
    phase = 'starting';
    announce('Starting the selected voice…');
    highlight();
    render();
    speakSentence();
  };
  const selectChapter = (nextChapter, sectionId = '', shouldScroll = true) => {
    cancelSpeech();
    chapter = nextChapter;
    passages = collectPassages(chapter, settings.comments);
    phase = 'idle';
    updateSections();
    const index = sectionId ? passages.findIndex(passage => passage.sectionId === sectionId) : 0;
    preparePosition(index < 0 ? 0 : index, shouldScroll);
    announce(readyMessage());
  };
  const move = direction => {
    const continueSpeaking = active();
    cancelSpeech();
    const next = position + direction;
    if (next < 0 || next >= passages.length) {
      const nextChapter = chapters[chapters.indexOf(chapter) + direction];
      if (!nextChapter) return;
      selectChapter(nextChapter);
      if (direction < 0) preparePosition(passages.length - 1);
      // Chapter boundaries are intentional stopping places.
      return;
    }
    phase = 'idle';
    preparePosition(next);
    announce(readyMessage());
    if (continueSpeaking) play();
  };
  const setOpen = value => {
    open = value;
    player.hidden = !value;
    document.body.classList.toggle('guided-open', value);
    $$('[data-guided-start], [data-guided-section]').forEach(button => button.setAttribute('aria-expanded', String(value)));
    updatePlayerHeight();
  };
  const close = () => {
    cancelSpeech();
    phase = 'idle';
    save();
    setOpen(false);
    clearHighlight();
    if (returnFocus?.isConnected && player.contains(document.activeElement)) returnFocus.focus({preventScroll: true});
  };
  const openAt = (target, trigger, keyboard = false) => {
    const alreadyOpen = open;
    returnFocus = trigger || returnFocus;
    setOpen(true);
    const targetChapter = target?.closest('.chapter');
    const targetSection = target?.closest('.study-section');
    if (targetChapter) {
      selectChapter(targetChapter, targetSection?.id || '', true);
    } else if (!alreadyOpen) {
      phase = 'idle';
      highlight();
      render();
      announce(readyMessage());
    }
    // Keyboard readers can reach the controls immediately. Pointer activation
    // keeps its existing focus and reading position.
    if (keyboard) {
      const control = !ui.play.disabled ? ui.play : !ui.next.disabled ? ui.next : ui.prev;
      control.focus({preventScroll: true});
    }
  };
  const refreshVoices = () => {
    const oldVoice = settings.voice;
    try { voices = canSpeak ? synth.getVoices().filter(voice => /^en(?:[-_]|$)/i.test(voice.lang || '')) : []; }
    catch (error) { voices = []; }
    voices.sort((a, b) => Number(b.localService) - Number(a.localService) || Number(b.default) - Number(a.default) || a.name.localeCompare(b.name));
    ui.voice.replaceChildren();
    if (voices.length) {
      const selected = voices.find(voice => voice.voiceURI === oldVoice) || voices.find(voice => voice.lang.toLowerCase() === 'en-us') || voices[0];
      settings.voice = selected.voiceURI;
      voices.forEach(voice => ui.voice.appendChild(option(voice.voiceURI, `${voice.name} · ${voice.lang}${voice.localService ? ' · device' : ' · online'}`)));
      ui.voice.value = settings.voice;
    } else ui.voice.appendChild(option('', canSpeak ? 'No English voice available' : 'Audio unavailable'));
    ui.voice.disabled = !voices.length;
    if (open && active() && !voices.length) audioFailed(noVoiceMessage());
    else if (open && ['idle', 'manual'].includes(phase)) announce(readyMessage());
    render();
  };

  ui.play.addEventListener('click', () => active() ? pause() : play());
  ui.prev.addEventListener('click', () => move(-1));
  ui.next.addEventListener('click', () => move(1));
  ui.close.addEventListener('click', close);
  ui.chapter.addEventListener('change', () => {
    const target = chapterById(ui.chapter.value);
    if (target) selectChapter(target);
  });
  ui.section.addEventListener('change', () => selectChapter(chapter, ui.section.value));
  ui.rate.addEventListener('change', () => {
    const continueSpeaking = active();
    settings.rate = RATES.includes(Number(ui.rate.value)) ? Number(ui.rate.value) : 1;
    save();
    if (continueSpeaking) play();
  });
  ui.voice.addEventListener('change', () => {
    const continueSpeaking = active();
    if (voices.some(voice => voice.voiceURI === ui.voice.value)) settings.voice = ui.voice.value;
    save();
    if (continueSpeaking) play();
    else if (open) announce(readyMessage());
  });
  ui.comments.addEventListener('change', () => {
    const continueSpeaking = active();
    const oldPassages = passages;
    const oldPosition = position;
    const key = passages[position]?.key;
    cancelSpeech();
    settings.comments = ui.comments.checked;
    passages = collectPassages(chapter, settings.comments);
    let index = passages.findIndex(passage => passage.key === key);
    if (index < 0) {
      const remaining = new Set(passages.map(passage => passage.key));
      const next = oldPassages.slice(oldPosition + 1).find(passage => remaining.has(passage.key));
      index = next ? passages.findIndex(passage => passage.key === next.key) : passages.length - 1;
    }
    phase = 'idle';
    preparePosition(index);
    announce(readyMessage());
    if (continueSpeaking) play();
  });
  ui.follow.addEventListener('change', () => {
    settings.follow = ui.follow.checked;
    save();
    if (settings.follow) scrollToPassage();
  });
  $$('[data-guided-start], [data-guided-section]').forEach(button => {
    button.setAttribute('aria-controls', 'guided-reader');
    button.setAttribute('aria-expanded', 'false');
  });
  document.addEventListener('click', event => {
    const trigger = event.target.closest?.('[data-guided-start], [data-guided-section]');
    if (trigger) {
      const section = trigger.dataset.guidedSection && document.getElementById(trigger.dataset.guidedSection);
      const specifiedChapter = trigger.dataset.guidedStart && chapterById(trigger.dataset.guidedStart);
      // The general control resumes the saved passage. Explicit section or
      // chapter controls are the only actions that choose a new start point.
      openAt(section || specifiedChapter || null, trigger, event.detail === 0);
      return;
    }
    if (!open || player.contains(event.target)) return;
    const link = event.target.closest?.('[data-goto], a[href^="#"]');
    if (!link) return;
    const id = link.dataset.goto || link.getAttribute('href')?.slice(1);
    let target;
    try { target = document.getElementById(decodeURIComponent(id || '')); } catch (error) { target = null; }
    pause('Paused while you explore. Press Resume when you are ready.');
    const targetChapter = target?.closest('.chapter');
    const targetSection = target?.closest('.study-section');
    const chapterOpening = targetChapter && (target === targetChapter || target.matches?.('.chapter-header h2'));
    if (targetChapter && (chapterOpening || targetChapter !== chapter || (targetSection && targetSection.id !== passages[position]?.sectionId))) {
      selectChapter(targetChapter, targetSection?.id || '', false);
    }
  }, true);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && open && player.contains(document.activeElement) && !$('dialog[open]')) {
      close();
      event.preventDefault();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause('Paused while this tab is hidden. Press Resume when you return.');
  });
  window.addEventListener('pagehide', () => { cancelSpeech(); save(); });
  window.addEventListener('hashchange', () => {
    if (!open) return;
    let target;
    try { target = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch (error) { return; }
    const nextChapter = target?.closest('.chapter');
    const nextSection = target?.closest('.study-section');
    const chapterOpening = nextChapter && (target === nextChapter || target.matches?.('.chapter-header h2'));
    if (nextChapter && (chapterOpening || nextChapter !== chapter || (nextSection && nextSection.id !== passages[position]?.sectionId))) {
      selectChapter(nextChapter, nextSection?.id || '', false);
    }
  });
  if (typeof MutationObserver === 'function') {
    const readingObserver = new MutationObserver(records => {
      if (records.some(record => record.target.tagName === 'DIALOG' && record.target.open)) {
        pause('Paused while a study panel is open. Close the panel, then press Resume.');
      } else if (records.some(record => record.target.matches?.('.guided-commentary') && !record.target.open && currentElement && record.target.contains(currentElement))) {
        pause('Paused because this explanation is closed. Resume reopens the passage.');
      }
    });
    readingObserver.observe(document.body, {subtree: true, attributes: true, attributeFilter: ['open']});
  }
  if (typeof ResizeObserver === 'function') new ResizeObserver(updatePlayerHeight).observe(player);
  window.addEventListener('resize', updatePlayerHeight);
  if (canSpeak && typeof synth.addEventListener === 'function') synth.addEventListener('voiceschanged', refreshVoices);
  updateSections();
  refreshVoices();
})();
