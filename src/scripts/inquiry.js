/* =============================================================================
   inquiry.js - the "start a tool" dialog, walked one question at a time.
   -----------------------------------------------------------------------------
   Tapping a chip selects it and auto-advances; you can type your own instead;
   a progress tracker + back step keep it light. On the last step it composes a
   pre-filled mail (the part people like) with a clipboard-copy fallback. No
   backend, nothing leaves the browser until the visitor confirms in their mail.
============================================================================= */
export function initInquiry(dialog) {
  const steps = Array.from(dialog.querySelectorAll('.inq__step'));
  const ticks = Array.from(dialog.querySelectorAll('[data-tick]'));
  const backBtn = dialog.querySelector('[data-inq-back]');
  const nextBtn = dialog.querySelector('[data-inq-next]');
  const note = dialog.querySelector('[data-inq-note]');
  const recap = dialog.querySelector('[data-inq-recap]');
  const defaultNote = note ? note.textContent : '';
  const TO = dialog.dataset.to || '';
  const subject = dialog.dataset.subject || 'Inquiry';
  const last = steps.length - 1;
  let current = 0;
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const focusStep = (el) => {
    const f = el.querySelector('.inq__chip, textarea, input, .pill');
    if (f) setTimeout(() => { try { f.focus({ preventScroll: true }); } catch (e) { f.focus(); } }, reduce ? 0 : 60);
  };

  const show = (i) => {
    current = Math.max(0, Math.min(last, i));
    steps.forEach((s, k) => {
      const on = k === current;
      if (on) {
        s.hidden = false;
        s.classList.remove('is-in');
        if (!reduce) { void s.offsetWidth; }
        s.classList.add('is-in');
      } else {
        s.hidden = true;
        s.classList.remove('is-in');
      }
    });
    ticks.forEach((t, k) => t.classList.toggle('is-on', k <= current));
    if (backBtn) backBtn.hidden = current === 0;
    if (nextBtn) nextBtn.hidden = current === last;
    if (current === last) buildRecap();
    const stepEl = steps[current];
    if (stepEl) focusStep(stepEl);
  };

  const open = () => {
    if (typeof dialog.showModal === 'function') { if (!dialog.open) dialog.showModal(); }
    else dialog.setAttribute('open', '');
    show(0);
  };
  const close = () => { if (dialog.open) dialog.close(); };

  document.querySelectorAll('[data-open-inquiry]').forEach((b) => b.addEventListener('click', open));
  dialog.querySelectorAll('[data-inq-close]').forEach((b) => b.addEventListener('click', close));
  dialog.addEventListener('click', (e) => { if (e.target === dialog) close(); });

  if (nextBtn) nextBtn.addEventListener('click', () => show(current + 1));
  if (backBtn) backBtn.addEventListener('click', () => show(current - 1));

  // Chip groups: single select; tapping one auto-advances (the delight), unless
  // the group's free-text field is in use.
  dialog.querySelectorAll('.inq__chips').forEach((group) => {
    const chips = Array.from(group.querySelectorAll('.inq__chip'));
    const other = group.parentElement.querySelector('[data-other]');
    const advance = group.hasAttribute('data-advance');
    chips.forEach((chip) => {
      chip.addEventListener('click', () => {
        const wasOn = chip.getAttribute('aria-checked') === 'true';
        chips.forEach((c) => c.setAttribute('aria-checked', 'false'));
        chip.setAttribute('aria-checked', wasOn ? 'false' : 'true');
        if (!wasOn) {
          if (other) other.value = '';
          if (advance && current < last) setTimeout(() => show(current + 1), reduce ? 0 : 300);
        }
      });
    });
    if (other) {
      other.addEventListener('input', () => {
        if (other.value.trim()) chips.forEach((c) => c.setAttribute('aria-checked', 'false'));
      });
      // Enter in the free-text advances.
      other.addEventListener('keydown', (e) => { if (e.key === 'Enter' && current < last) { e.preventDefault(); show(current + 1); } });
    }
  });

  const legendOf = (name) => {
    const fs = dialog.querySelector('[data-group="' + name + '"]');
    const lab = fs && fs.closest('.inq__step') && fs.closest('.inq__step').querySelector('.inq__qlabel');
    return lab ? lab.textContent.trim() : name;
  };
  const groupValue = (name) => {
    const fs = dialog.querySelector('[data-group="' + name + '"]');
    if (!fs) return '';
    const sel = fs.querySelector('.inq__chip[aria-checked="true"]');
    if (sel) return sel.dataset.val || sel.textContent.trim();
    const other = fs.parentElement.querySelector('[data-other]');
    return other && other.value.trim() ? other.value.trim() : '';
  };
  const fieldValue = (name) => {
    const el = dialog.querySelector('[data-field="' + name + '"]');
    return el ? el.value.trim() : '';
  };
  const fieldLabel = (name) => {
    const el = dialog.querySelector('[data-field="' + name + '"]');
    const lab = el && el.id ? dialog.querySelector('label[for="' + el.id + '"]') : null;
    return lab ? lab.textContent.trim() : name;
  };

  function buildRecap() {
    if (!recap) return;
    const parts = [];
    const who = groupValue('who'); if (who) parts.push(who);
    const need = groupValue('need'); if (need) parts.push(need);
    recap.textContent = parts.join('  /  ');
  }

  const buildBody = () => {
    const lines = [];
    const who = groupValue('who'); if (who) lines.push(legendOf('who') + ' ' + who);
    const need = groupValue('need'); if (need) lines.push(legendOf('need') + ' ' + need);
    const prob = fieldValue('problem'); if (prob) lines.push(fieldLabel('problem') + ' ' + prob);
    const email = fieldValue('email'); if (email) lines.push(fieldLabel('email') + ' ' + email);
    lines.push('');
    lines.push('(tools.kindl.work)');
    return lines.join('\n');
  };

  const flash = (msg) => {
    if (!note) return;
    note.textContent = msg;
    setTimeout(() => { note.textContent = defaultNote; }, 3200);
  };

  dialog.querySelectorAll('[data-inq-send]').forEach((b) => b.addEventListener('click', () => {
    const url = 'mailto:' + TO + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(buildBody());
    window.location.href = url;
  }));
  dialog.querySelectorAll('[data-inq-copy]').forEach((b) => b.addEventListener('click', async () => {
    const text = TO + '\n\n' + buildBody();
    try { await navigator.clipboard.writeText(text); flash(b.dataset.copied || 'Copied'); }
    catch (e) { flash(TO); }
  }));
}
