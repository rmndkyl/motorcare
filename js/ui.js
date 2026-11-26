/* MOTORCARE — UI helpers: escape, element builder, sheet, toast, form controls */
(function (global) {
  'use strict';
  const MC = global.MC;
  const I = global.MCI;

  function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  /* ---------- toast ---------- */
  let toastTimer = null;
  function toast(msg, kind) {
    const old = document.querySelector('.toast');
    if (old) old.remove();
    const node = el('<div class="toast ' + (kind || '') + '" role="status">' + esc(msg) + '</div>');
    document.body.appendChild(node);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      node.style.opacity = '0';
      node.style.transition = 'opacity .2s';
      setTimeout(() => node.remove(), 220);
    }, 2400);
  }

  /* ---------- sheet ---------- */
  let sheetStack = [];
  function sheet(opts) {
    // opts: {title, body (html), footer (html), onMount(root), size}
    const wrap = el(
      '<div class="sheet-backdrop" role="dialog" aria-modal="true" aria-label="' + esc(opts.title || 'Form') + '">' +
        '<div class="sheet">' +
          '<div class="sheet-grab"></div>' +
          '<div class="sheet-head">' +
            '<h2>' + esc(opts.title || '') + '</h2>' +
            '<button class="iconbtn" data-close aria-label="Tutup">' + I.icon('x') + '</button>' +
          '</div>' +
          '<div class="sheet-body">' + (opts.body || '') + '</div>' +
          (opts.footer ? '<div class="sheet-foot">' + opts.footer + '</div>' : '') +
        '</div>' +
      '</div>'
    );

    function close() {
      if (wrap.dataset.closing) return;
      wrap.dataset.closing = '1';
      sheetStack = sheetStack.filter((s) => s !== wrap);
      // hapus sinkron: animasi fade-out tidak sepadan dengan risiko node
      // tertinggal dan memblokir sentuhan kalau timer/transition tidak pernah datang
      wrap.remove();
      if (!sheetStack.length) document.body.style.overflow = '';
    }

    wrap.addEventListener('click', (e) => {
      if (e.target === wrap) close();
      if (e.target.closest('[data-close]')) close();
    });

    document.body.appendChild(wrap);
    document.body.style.overflow = 'hidden';
    sheetStack.push(wrap);

    if (opts.onMount) opts.onMount(wrap);
    const first = wrap.querySelector('input:not([type=hidden]), select, textarea');
    if (first && !opts.noFocus) setTimeout(() => first.focus(), 240);

    return { root: wrap, close };
  }

  function closeTopSheet() {
    const top = sheetStack[sheetStack.length - 1];
    if (!top) return false;
    const btn = top.querySelector('[data-close]');
    if (btn) btn.click();
    return true;
  }

  function anySheetOpen() { return sheetStack.length > 0; }

  /* ---------- confirm ---------- */
  function confirmDialog(opts) {
    return new Promise((resolve) => {
      const s = sheet({
        title: opts.title || 'Konfirmasi',
        body: '<p style="font-size:14px;color:var(--text-2);margin:0 0 6px">' + esc(opts.message || '') + '</p>' +
          (opts.detail ? '<p style="font-size:12.5px;color:var(--text-3);margin:0">' + esc(opts.detail) + '</p>' : ''),
        footer: '<button class="btn ghost" data-no>Batal</button>' +
          '<button class="btn ' + (opts.danger ? 'danger' : 'primary') + '" data-yes>' + esc(opts.yes || 'Ya') + '</button>',
        onMount(root) {
          root.querySelector('[data-no]').onclick = () => { s.close(); resolve(false); };
          root.querySelector('[data-yes]').onclick = () => { s.close(); resolve(true); };
        }
      });
    });
  }

  /* ---------- reusable field markup ---------- */
  function field(label, inputHtml, hint) {
    return '<div class="field"><label>' + esc(label) + '</label>' + inputHtml +
      (hint ? '<div class="hint">' + esc(hint) + '</div>' : '') + '</div>';
  }

  function input(name, value, opts) {
    opts = opts || {};
    return '<input class="inp" name="' + esc(name) + '" type="' + (opts.type || 'text') + '" ' +
      'value="' + esc(value === null || value === undefined ? '' : value) + '" ' +
      (opts.placeholder ? 'placeholder="' + esc(opts.placeholder) + '" ' : '') +
      (opts.min !== undefined ? 'min="' + esc(opts.min) + '" ' : '') +
      (opts.max !== undefined ? 'max="' + esc(opts.max) + '" ' : '') +
      (opts.step !== undefined ? 'step="' + esc(opts.step) + '" ' : '') +
      (opts.inputmode ? 'inputmode="' + esc(opts.inputmode) + '" ' : '') +
      (opts.required ? 'required ' : '') +
      (opts.maxlength ? 'maxlength="' + esc(opts.maxlength) + '" ' : '') +
      '>';
  }

  function textarea(name, value, opts) {
    opts = opts || {};
    return '<textarea class="inp" name="' + esc(name) + '" ' +
      (opts.placeholder ? 'placeholder="' + esc(opts.placeholder) + '"' : '') + '>' + esc(value || '') + '</textarea>';
  }

  function select(name, options, value) {
    // options: [{id,label}]
    return '<select class="inp" name="' + esc(name) + '">' +
      options.map((o) => '<option value="' + esc(o.id) + '"' + (String(o.id) === String(value) ? ' selected' : '') + '>' +
        esc(o.label) + '</option>').join('') +
      '</select>';
  }

  function formValues(formEl) {
    const out = {};
    new FormData(formEl).forEach((v, k) => {
      if (out[k] !== undefined) {
        if (!Array.isArray(out[k])) out[k] = [out[k]];
        out[k].push(v);
      } else {
        out[k] = v;
      }
    });
    return out;
  }

  /* ---------- photo picker ---------- */
  // slot: {key, label, dataUrl}
  function photoPicker(slots, opts) {
    opts = opts || {};
    const max = opts.max || 3;
    const html =
      '<div class="photo-pick" data-picker>' +
        slots.map((s, i) =>
          '<div class="photo-slot" data-slot="' + i + '">' +
            (s.dataUrl
              ? '<img src="' + s.dataUrl + '" alt="' + esc(s.label) + '">' +
                '<button type="button" class="del" data-delslot="' + i + '" aria-label="Hapus ' + esc(s.label) + '">' + I.icon('x', 11) + '</button>'
              : I.icon('camera', 20)) +
            '<span class="tag">' + esc(s.label) + '</span>' +
            '<input type="file" accept="image/*" hidden data-file="' + i + '">' +
          '</div>'
        ).join('') +
      '</div>';
    return html;
  }

  function wirePhotoPicker(root, slots, onChange) {
    root.querySelectorAll('[data-file]').forEach((inp) => {
      inp.addEventListener('change', async () => {
        const i = +inp.dataset.file;
        const f = inp.files && inp.files[0];
        if (!f) return;
        try {
          const r = await MC.compressImage(f);
          slots[i].dataUrl = r.dataUrl;
          onChange(slots);
        } catch (e) {
          toast('Gagal memproses gambar: ' + e.message, 'err');
        }
        inp.value = '';
      });
    });
    root.querySelectorAll('[data-delslot]').forEach((b) => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const i = +b.dataset.delslot;
        slots[i].dataUrl = null;
        onChange(slots);
      });
    });
    root.querySelectorAll('.photo-slot').forEach((slot) => {
      slot.addEventListener('click', (e) => {
        if (e.target.closest('[data-delslot]')) return;
        const inp = slot.querySelector('[data-file]');
        if (inp) inp.click();
      });
    });
  }

  /* ---------- misc renderers ---------- */
  function empty(iconName, title, sub, actionHtml) {
    return '<div class="empty">' + I.icon(iconName, 40) +
      '<div class="t">' + esc(title) + '</div>' +
      (sub ? '<div class="s">' + esc(sub) + '</div>' : '') +
      (actionHtml || '') + '</div>';
  }

  function badge(text, tone, dot) {
    return '<span class="badge ' + (tone || '') + '">' + (dot ? '<span class="dot"></span>' : '') + esc(text) + '</span>';
  }

  function bytes(n) {
    if (!n) return '0 B';
    const u = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
    return (n / Math.pow(1024, i)).toFixed(i ? 1 : 0) + ' ' + u[i];
  }

  global.MCU = {
    esc, el, toast, sheet, closeTopSheet, anySheetOpen, confirmDialog,
    field, input, textarea, select, formValues,
    photoPicker, wirePhotoPicker, empty, badge, bytes
  };
})(window);
