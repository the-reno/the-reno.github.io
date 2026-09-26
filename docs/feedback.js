'use strict';
/** Private feedback delivery. No form contents enter analytics or browser storage. */
(() => {
  const config = window.RONU_RECORDS?.feedback;
  const preview = window.RONU_FEEDBACK_PREVIEW === true;
  const endpoint = config?.endpoint || '';
  const available = config?.enabled === true && (() => {try {const u = new URL(endpoint);return u.protocol === 'https:' && u.pathname === '/api/feedback' && u.origin === window.RONU_RECORDS.origin && !u.search && !u.hash;} catch {return false;}})();
  if (!preview && !available) return; // Never offer a form without a receiving endpoint.
  if (document.getElementById('feedback-dialog')) return;
  const $ = selector => document.querySelector(selector);
  const svg = (path, extra = '') => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" ${extra}>${path}</svg>`;
  const star = svg('<path d="m12 3 2.8 5.8 6.4.9-4.6 4.5 1.1 6.4L12 17.6l-5.7 3 1.1-6.4L2.8 9.7l6.4-.9Z"/>');
  const ratingNames = ['Poor', 'Fair', 'Good', 'Very good', 'Excellent'];
  const launcher = document.createElement('button');
  launcher.type = 'button'; launcher.id = 'feedback-open'; launcher.className = 'feedback-launcher';
  launcher.setAttribute('aria-haspopup', 'dialog'); launcher.setAttribute('aria-controls', 'feedback-dialog');
  launcher.setAttribute('aria-label', 'Open feedback form');
  launcher.textContent = 'Feedback';
  (document.querySelector('.header-tools') || document.body).append(launcher);
  const dialog = document.createElement('dialog');
  dialog.id = 'feedback-dialog'; dialog.className = 'feedback-dialog';
  dialog.setAttribute('aria-labelledby', 'feedback-title'); dialog.setAttribute('aria-describedby', 'feedback-subtitle');
  dialog.innerHTML = `<div class="feedback-content">
    <div class="feedback-heading"><h2 id="feedback-title" tabindex="-1">Feedback<span>.</span></h2>
      <button type="button" class="feedback-close" aria-label="Close feedback">${svg('<path d="m6 6 12 12M18 6 6 18"/>')}</button></div>
    <p id="feedback-subtitle" class="feedback-subtitle">Share a comment or suggest a topic.</p>
    ${preview ? '<p class="feedback-demo">Form preview · Nothing is sent or saved.</p>' : ''}
    <form id="feedback-form" method="dialog" novalidate>
      <fieldset><legend>Your rating <span class="feedback-optional">(optional)</span></legend>
        <div class="feedback-stars">${ratingNames.map((name, i) => `<label><input type="radio" name="rating" value="${i + 1}" aria-label="${i + 1} out of 5 — ${name}"><span class="feedback-star">${star}</span></label>`).join('')}</div>
        <output class="feedback-rating-note" id="feedback-rating-note" aria-live="polite">Select a star</output>
      </fieldset>
      <div class="feedback-field"><label class="feedback-label" for="feedback-message">Your note <span class="feedback-optional">(optional)</span></label>
        <textarea id="feedback-message" name="message" rows="3" maxlength="2000" placeholder="Write here…" spellcheck="true"></textarea></div>
      <div class="feedback-contact">
        <div class="feedback-field"><label class="feedback-label" for="feedback-name">Name <span class="feedback-optional">(optional)</span></label>
          <input id="feedback-name" name="name" type="text" maxlength="80" autocomplete="${preview ? 'off' : 'name'}" placeholder="Your name"></div>
        <div class="feedback-field"><label class="feedback-label" for="feedback-email">Email <span class="feedback-optional">(for a reply)</span></label>
          <input id="feedback-email" name="email" type="email" maxlength="254" autocomplete="${preview ? 'off' : 'email'}" inputmode="email" placeholder="you@example.com"></div>
      </div>
      <label class="feedback-check"><input name="updates" type="checkbox" id="feedback-updates"><span>Send me occasional updates from Ronu.</span></label>
      <div class="feedback-trap" aria-hidden="true"><label>Leave this empty<input name="_gotcha" type="text" autocomplete="off" tabindex="-1"></label></div>
      <p class="feedback-privacy">Sent privately, never posted on the website. Saved until manually deleted. Email is used to reply; updates only when you opt in. <a href="/privacy/" target="_blank" rel="noopener noreferrer">Privacy</a></p>
      <p class="feedback-error" id="feedback-error" role="alert" hidden></p>
      <button class="feedback-submit" id="feedback-submit" type="submit">${preview ? 'Preview submission' : 'Send feedback'} ${svg('<path d="M4 12h15m-5-5 5 5-5 5"/>', 'width="18" height="18"')}</button>
    </form>
    <div class="feedback-success" id="feedback-success" role="status" tabindex="-1" hidden>
      <h3>Thanks for the feedback.</h3>
    </div>
  </div>`;
  document.body.append(dialog);
  const form = $('#feedback-form'), button = $('#feedback-submit'), error = $('#feedback-error');
  let previousFocus = null, inFlight = false, context = '/', submissionId = null, submittedSignature = null;
  const route = () => {
    const hash = location.hash.split('?')[0];
    const section = hash.match(/^#section\/([a-z0-9-]+)/)?.[1];
    const topic = hash.match(/^#topic\/([a-z0-9-]+)/)?.[1];
    if (section && typeof MAIN_PAGES !== 'undefined' && Object.hasOwn(MAIN_PAGES, section)) return '/section/' + section;
    if (topic && typeof TOPICS !== 'undefined' && TOPICS.some(t => t.id === topic)) return '/article/' + topic;
    return '/';
  };
  function showError(message, control) {
    error.textContent = message; error.hidden = false;
    if (control) {control.setAttribute('aria-invalid', 'true'); control.focus();}
  }
  function paintStars(value) {
    [...dialog.querySelectorAll('.feedback-stars label')].forEach((label, i) => label.classList.toggle('is-lit', i < value));
    $('#feedback-rating-note').textContent = value ? `${value} out of 5 — ${ratingNames[value - 1]}` : 'Select a star';
  }
  function open() {
    if (dialog.open) return;
    previousFocus = document.activeElement;
    const search = $('#search-dialog'); if (search?.open) search.close();
    context = route(); error.hidden = true;
    if (!$('#feedback-success').hidden) {
      $('#feedback-success').hidden = true; form.hidden = false; form.reset(); paintStars(0);
      $('#feedback-email').required = false;
    }
    dialog.showModal(); $('#feedback-title').focus();
  }
  function close() {dialog.close();}
  launcher.addEventListener('click', open);
  $('.feedback-close').addEventListener('click', close);
  dialog.addEventListener('close', () => {
    const target = previousFocus?.isConnected ? previousFocus : launcher;
    target.focus({preventScroll: true});
  });
  dialog.addEventListener('click', event => {
    const r = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) close();
  });
  // Avoid opening the site's search dialog behind this modal when '/' is pressed.
  dialog.addEventListener('keydown', event => {if (event.key === '/' || event.key === 'Escape') event.stopPropagation();});
  form.addEventListener('input', () => {
    error.hidden = true;
    form.querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
    $('#feedback-email').required = $('#feedback-updates').checked;
  });
  form.addEventListener('change', event => {
    if (event.target.name === 'rating') paintStars(Number(event.target.value));
    $('#feedback-email').required = $('#feedback-updates').checked;
  });
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (inFlight) return;
    error.hidden = true;
    const values = new FormData(form);
    const rating = values.get('rating');
    const message = String(values.get('message') || '').trim();
    const name = String(values.get('name') || '').trim();
    const email = String(values.get('email') || '').trim();
    const updates = values.get('updates') === 'on';
    if (String(values.get('_gotcha') || '').trim()) return showError('The form could not be submitted. Please reload and try again.');
    if (rating && !/^[1-5]$/.test(rating)) return showError('Choose a rating between 1 and 5.');
    if (!rating && !message && !updates) return showError('Choose a rating, leave a note, or opt in to updates.', $('#feedback-message'));
    if (updates && !email) return showError('Add your email to receive updates.', $('#feedback-email'));
    if (email && !$('#feedback-email').validity.valid) return showError('Check the email address.', $('#feedback-email'));
    if (message.length > 2000 || name.length > 80 || email.length > 254) return showError('Please shorten the text in the form.');
    const success = () => {
      submissionId = null; submittedSignature = null;
      form.hidden = true; form.reset(); paintStars(0); $('#feedback-email').required = false;
      $('#feedback-success').hidden = false;
      $('#feedback-success').focus();
    };
    if (preview) {success(); return;}
    const payload = {message, page: context, updates_opt_in: updates, privacy_version: '2026-09-25-records2'};
    if (rating) payload.rating = Number(rating);
    if (name) payload.name = name;
    if (email) payload.email = email;
    if (updates) payload.updates_consent_text = 'Send me occasional updates from Ronu.';
    const signature = JSON.stringify(payload);
    if (signature !== submittedSignature || !submissionId) {submissionId = crypto.randomUUID(); submittedSignature = signature;}
    payload.event_id = submissionId;
    inFlight = true; button.disabled = true; form.setAttribute('aria-busy', 'true');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(endpoint, {method: 'POST', headers: {'Accept': 'application/json', 'Content-Type': 'application/json'},
        body: JSON.stringify(payload), credentials: 'omit', referrerPolicy: 'no-referrer', signal: controller.signal});
      let result; try {result = await response.json();} catch {throw new Error('unconfirmed');}
      if (response.status === 429) throw new Error('rate-limit');
      if (!response.ok || result?.ok !== true) throw new Error('unconfirmed');
      success();
    } catch (e) {
      const text = e.message === 'rate-limit' ? 'The form is temporarily busy. Please try later; your text is still here.' :
        'We could not confirm delivery. Your text is still here. Please try again later; a retry may send a duplicate.';
      showError(text);
    } finally {
      clearTimeout(timeout); inFlight = false; button.disabled = false; form.setAttribute('aria-busy', 'false');
    }
  });
})();
