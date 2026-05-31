/* =============================================================================
   inquiry.js - the "start a tool" dialog behaviour.
   -----------------------------------------------------------------------------
   Opens from any [data-open-inquiry] trigger. Single-select chip groups, each
   with an "or write your own" field that clears the chips when used. On send it
   composes a mailto with the answers (labels read from the DOM, so it matches
   the page language); a copy button puts the same text on the clipboard.
   No backend, nothing is sent until the visitor confirms in their mail client.
============================================================================= */
export function initInquiry(dialog) {
  const note = dialog.querySelector('[data-inq-note]');
  const defaultNote = note ? note.textContent : '';
  const TO = dialog.dataset.to || '';
  const subject = dialog.dataset.subject || 'Inquiry';

  const open = () => {
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
    const first = dialog.querySelector('.inq__chip');
    if (first) setTimeout(() => first.focus(), 40);
  };
  const close = () => { if (dialog.open) dialog.close(); };

  document.querySelectorAll('[data-open-inquiry]').forEach((b) => b.addEventListener('click', open));
  dialog.querySelectorAll('[data-inq-close]').forEach((b) => b.addEventListener('click', close));
  // Backdrop click (the click lands on the dialog itself, not the inner panel).
  dialog.addEventListener('click', (e) => { if (e.target === dialog) close(); });

  // Chip groups: single select, mutually exclusive with the group's free text.
  dialog.querySelectorAll('.inq__chips').forEach((group) => {
    const chips = Array.from(group.querySelectorAll('.inq__chip'));
    const other = group.parentElement.querySelector('[data-other]');
    chips.forEach((chip) => {
      chip.addEventListener('click', () => {
        const wasOn = chip.getAttribute('aria-checked') === 'true';
        chips.forEach((c) => c.setAttribute('aria-checked', 'false'));
        chip.setAttribute('aria-checked', wasOn ? 'false' : 'true');
        if (!wasOn && other) other.value = '';
      });
    });
    if (other) {
      other.addEventListener('input', () => {
        if (other.value.trim()) chips.forEach((c) => c.setAttribute('aria-checked', 'false'));
      });
    }
  });

  const legendOf = (name) => {
    const fs = dialog.querySelector('[data-group="' + name + '"]');
    const l = fs && fs.querySelector('legend');
    return l ? l.textContent.trim() : name;
  };
  const groupValue = (name) => {
    const fs = dialog.querySelector('[data-group="' + name + '"]');
    if (!fs) return '';
    const sel = fs.querySelector('.inq__chip[aria-checked="true"]');
    if (sel) return sel.dataset.val || sel.textContent.trim();
    const other = fs.querySelector('[data-other]');
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
    try {
      await navigator.clipboard.writeText(text);
      flash(b.dataset.copied || 'Copied');
    } catch (e) {
      flash(TO);
    }
  }));
}
