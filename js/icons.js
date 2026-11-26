/* MOTORCARE — ikon inline (stroke-based, 24x24 grid). Tanpa CDN, tanpa font ikon. */
(function (global) {
  'use strict';

  const P = {
    home: '<path d="M4 10.5 12 3l8 7.5"/><path d="M6 10v10h12V10"/><path d="M10 20v-6h4v6"/>',
    garage: '<path d="M3 20V9l9-5 9 5v11"/><path d="M7 20v-7h10v7"/><path d="M7 16h10"/>',
    wrench: '<path d="M14.7 6.3a4 4 0 1 0 4 4L21 8V5h-3l-2.3 1.3"/><path d="M13 11 4 20l1 1 9-9"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 8v4l3 2"/>',
    user: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    check: '<path d="M4 12.5 9 17.5 20 6.5"/>',
    chevron: '<path d="M6 9l6 6 6-6"/>',
    right: '<path d="M9 6l6 6-6 6"/>',
    left: '<path d="M15 6l-6 6 6 6"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    camera: '<path d="M3 8.5h3.2l1.6-2.3h8.4l1.6 2.3H21v11H3z"/><circle cx="12" cy="13.6" r="3.4"/>',
    trash: '<path d="M3.5 7h17"/><path d="M8.5 7V4.5h7V7"/><path d="M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/>',
    edit: '<path d="M4 20h4L20 8l-4-4L4 16z"/><path d="M14.5 5.5 18.5 9.5"/>',
    download: '<path d="M12 3v11"/><path d="M8 10.5 12 14.5l4-4"/><path d="M4 19h16"/>',
    upload: '<path d="M12 14.5V3.5"/><path d="M8 7.5 12 3.5l4 4"/><path d="M4 19h16"/>',
    alert: '<path d="M12 3.5 21.5 20h-19z"/><path d="M12 9.5v4.5"/><circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><circle cx="12" cy="7.8" r="0.9" fill="currentColor" stroke="none"/>',
    clock: '<circle cx="12" cy="12" r="8.6"/><path d="M12 6.8V12l3.6 2.2"/>',
    calendar: '<rect x="3.5" y="5.5" width="17" height="15" rx="2.4"/><path d="M3.5 10h17M8.5 3v4M15.5 3v4"/>',
    gauge: '<path d="M3.6 17.5a8.4 8.4 0 1 1 16.8 0"/><path d="M12 17.5 16 11"/><circle cx="12" cy="17.5" r="1.3" fill="currentColor" stroke="none"/>',
    rupiah: '<path d="M8 20V4h4.5a4.5 4.5 0 0 1 0 9H8"/><path d="M6 9h9M6 12.5h9"/>',
    oil: '<path d="M6 21V8.5L12 3l6 5.5V21"/><path d="M9 21v-5h6v5"/><path d="M6 12.5h12"/>',
    engine: '<rect x="3" y="8" width="12" height="9" rx="1.6"/><path d="M15 11h3l3 2.5V17"/><path d="M7 8V5.5h4V8"/><path d="M7 17v2.5h4V17"/>',
    brake: '<circle cx="12" cy="12" r="7.6"/><circle cx="12" cy="12" r="2.2"/><path d="M12 4.4V9M12 15v4.6M4.4 12H9M15 12h4.6"/>',
    tire: '<circle cx="12" cy="12" r="8.4"/><circle cx="12" cy="12" r="4.2"/><path d="M12 3.6v4.2M12 16.2v4.2M3.6 12h4.2M16.2 12h4.2"/>',
    battery: '<rect x="2.5" y="7.5" width="16" height="9" rx="2"/><path d="M18.5 10.5h2v3h-2"/><path d="M10.5 9.5v5M8 12h5"/>',
    bolt: '<path d="M13 2.5 4.5 13.5h6L11 21.5l8.5-11h-6z"/>',
    chain: '<circle cx="7" cy="12" r="3.6"/><circle cx="17" cy="12" r="3.6"/><path d="M10.6 12h2.8"/>',
    cvt: '<circle cx="12" cy="12" r="8.4"/><circle cx="12" cy="12" r="3"/><path d="M12 3.6v5.4M12 15v5.4M3.6 12h5.4M15 12h5.4"/>',
    filter: '<path d="M4 5h16l-6 7v7l-4 2v-9z"/>',
    spark: '<path d="M11 2.5 12.8 9l6.5 1.8-6.5 1.8L11 19l-1.8-6.4L2.7 10.8 9.2 9z"/><path d="M18 16.5l.8 2.7 2.7.8-2.7.8-.8 2.7"/>',
    gauge2: '<path d="M4 18a8.4 8.4 0 0 1 16 0"/><path d="M8 18h8"/>',
    doc: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 12h6M9 15.5h6"/>',
    shield: '<path d="M12 3 20 6v6c0 4.4-3.2 7.6-8 9-4.8-1.4-8-4.6-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-4.5"/>',
    sparkAI: '<path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z"/><path d="M18.5 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.6v3M12 18.4v3M2.6 12h3M18.4 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/>',
    bike: '<circle cx="5.5" cy="17" r="3.4"/><circle cx="18.5" cy="17" r="3.4"/><path d="M9 17h5l-2-5H8.5"/><path d="M12 12 14.5 6h3"/><path d="M16.4 8.2 18.5 17"/>',
    trend: '<path d="M3 17l5.5-5.5 3.5 3.5L21 6"/><path d="M15 6h6v6"/>',
    filter2: '<path d="M3 6h18M6.5 12h11M10 18h4"/>',
    sort: '<path d="M7 5v14M3.5 15.5 7 19l3.5-3.5"/><path d="M17 19V5M13.5 8.5 17 5l3.5 3.5"/>',
    copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2"/><path d="M15.5 5.5h-9a2 2 0 0 0-2 2v9"/>',
    lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2.4"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
    palette: '<circle cx="12" cy="12" r="9"/><circle cx="9" cy="9" r="1.2" fill="currentColor" stroke="none"/><circle cx="15" cy="9" r="1.2" fill="currentColor" stroke="none"/><circle cx="9.5" cy="15" r="1.2" fill="currentColor" stroke="none"/>',
    send: '<path d="M21 3 10.5 13.5"/><path d="M21 3 14.5 21 10.5 13.5 3 9.5z"/>'
  };

  function icon(name, size) {
    const d = P[name] || P.info;
    const s = size || 20;
    return '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '" fill="none" stroke="currentColor" ' +
      'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  }

  // Logo: huruf M tajam + garis jalan
  function logo(size) {
    const s = size || 22;
    return '<svg class="mark" viewBox="0 0 24 24" width="' + s + '" height="' + s + '" fill="none" aria-hidden="true">' +
      '<path d="M3 20V5l6 8 6-8v15" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M18 20V9" stroke="var(--accent)" stroke-width="2.6" stroke-linecap="round"/>' +
      '<path d="M16 6h4" stroke="var(--accent)" stroke-width="2.6" stroke-linecap="round"/>' +
      '</svg>';
  }

  // gauge melingkar untuk skor kesehatan
  function ring(score, toneVar, size) {
    const s = size || 88;
    const r = 36;
    const c = 2 * Math.PI * r;
    const pct = score === null ? 0 : Math.max(0, Math.min(100, score));
    const off = c * (1 - pct / 100);
    // tick marks ala instrumen: 12 garis, tiap 30°
    let ticks = '';
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2 - Math.PI / 2;
      const long = i % 6 === 0;
      const r1 = 44.5;
      const r2 = long ? 40.5 : 42.5;
      const x1 = 46 + Math.cos(a) * r1, y1 = 46 + Math.sin(a) * r1;
      const x2 = 46 + Math.cos(a) * r2, y2 = 46 + Math.sin(a) * r2;
      ticks += '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) +
        '" y2="' + y2.toFixed(1) + '" stroke="' + (long ? 'var(--tick-major)' : 'var(--tick-minor)') +
        '" stroke-width="' + (long ? 1.6 : 1) + '" stroke-linecap="round"/>';
    }
    return '<svg viewBox="0 0 92 92" width="' + s + '" height="' + s + '" style="transform:rotate(-90deg)">' +
      ticks +
      '<circle class="track" cx="46" cy="46" r="' + r + '"/>' +
      '<circle class="bar" cx="46" cy="46" r="' + r + '" stroke="' + toneVar + '" ' +
      'stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '"/>' +
      '</svg>';
  }

  global.MCI = { icon, logo, ring, paths: P };
})(window);
