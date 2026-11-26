/* MOTORCARE — state & data loading */
(function (global) {
  'use strict';
  const MC = global.MC;

  const S = {
    bikes: [],
    activeBikeId: null,
    services: [],
    damages: [],
    expenses: [],
    odoLog: [],
    reminders: [],
    checks: [],
    docs: [],
    ready: false,
    route: 'home',
    filter: {}
  };

  function activeBike() {
    return S.bikes.find((b) => b.id === S.activeBikeId) || S.bikes[0] || null;
  }

  function ctxFor(bike) {
    const id = bike ? bike.id : null;
    return {
      bike,
      services: S.services.filter((x) => x.bikeId === id),
      damages: S.damages.filter((x) => x.bikeId === id),
      expenses: S.expenses.filter((x) => x.bikeId === id),
      odoLog: S.odoLog.filter((x) => x.bikeId === id).sort((a, b) => (a.date || '').localeCompare(b.date || '')),
      reminders: S.reminders.filter((x) => x.bikeId === id),
      checks: S.checks.filter((x) => x.bikeId === id),
      docs: S.docs.filter((x) => x.bikeId === id)
    };
  }

  async function loadAll() {
    const [bikes, services, damages, expenses, odoLog, reminders, checks, docs, meta] = await Promise.all([
      MC.Store.all('bikes'),
      MC.Store.all('services'),
      MC.Store.all('damages'),
      MC.Store.all('expenses'),
      MC.Store.all('odoLog'),
      MC.Store.all('reminders'),
      MC.Store.all('checks'),
      MC.Store.all('docs'),
      MC.Store.all('meta')
    ]);
    S.bikes = bikes.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    S.services = services;
    S.damages = damages;
    S.expenses = expenses;
    S.odoLog = odoLog;
    S.reminders = reminders;
    S.checks = checks;
    S.docs = docs;

    const pref = meta.find((m) => m.id === 'prefs') || {};
    const savedActive = pref.activeBikeId;
    if (savedActive && S.bikes.some((b) => b.id === savedActive)) S.activeBikeId = savedActive;
    else if (S.bikes.length) S.activeBikeId = S.bikes[0].id;
    else S.activeBikeId = null;

    S.ready = true;
  }

  async function setActiveBike(id) {
    S.activeBikeId = id;
    const pref = (await MC.Store.get('meta', 'prefs')) || { id: 'prefs' };
    pref.activeBikeId = id;
    await MC.Store.put('meta', pref);
  }

  // default reminder set untuk motor baru — interval mengikuti segmen motor
  function defaultReminders(bikeId, segment) {
    const seg = segment || 'matic-baru';
    const table = MC.SEGMENT_INTERVALS[seg] || MC.SEGMENT_INTERVALS['matic-baru'];

    return MC.REMINDER_TEMPLATES.map((t) => {
      const iv = table[t.kind];                     // [km, hari] khusus segmen ini
      const intervalKm = iv ? iv[0] : t.intervalKm;
      const intervalDays = iv ? iv[1] : t.intervalDays;

      // pengingat yang tidak relevan untuk segmen ini tidak dibuat sama sekali
      // (mis. oli gardan untuk motor manual, rantai untuk matic)
      const irrelevant =
        (t.kind === 'oli-gardan' && !table['oli-gardan']) ||
        (t.kind === 'cvt' && !table['cvt']) ||
        (t.kind === 'rantai-gear' && !table['rantai-gear']);
      if (irrelevant) return null;

      return {
        id: MC.uid(),
        bikeId,
        kind: t.kind,
        label: t.label,
        intervalKm,
        intervalDays,
        serviceType: t.serviceType,
        // 'servis-awal' hanya berguna untuk motor baru; default mati supaya tidak
        // memunculkan "terlewat 12.000 km" pada motor yang sudah lama dipakai
        active: t.defaultOn === false ? false : (t.kind !== 'oli-gardan'),
        soonKm: 300,
        soonDays: 21
      };
    }).filter(Boolean);
  }

  // segmen ditebak dari data motor yang sudah diisi — bukan ditanyakan lagi.
  // Hanya tebakan awal; user bisa mengubahnya di form motor.
  function guessSegment(bike) {
    if (!bike) return 'matic-baru';
    const trans = bike.transmission || 'matik';
    const year = +bike.year || 0;
    const thisYear = new Date().getFullYear();
    const age = year ? thisYear - year : null;

    if (trans === 'manual') return 'bebek-manual';
    if (trans === 'semi') return 'sport';
    if (age !== null && age > 5) return 'matic-lama';
    return 'matic-baru';
  }

  global.MCS = { S, activeBike, ctxFor, loadAll, setActiveBike, defaultReminders, guessSegment };
})(window);
