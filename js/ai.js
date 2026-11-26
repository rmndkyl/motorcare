/* MOTORCARE — Asisten AI
 * Dua mode, jujur soal batasnya:
 *  1) MODE LOKAL (default, offline): pencocokan gejala -> komponen dari basis
 *     pengetahuan tetap. Ini BUKAN model bahasa; tidak mengarang jawaban.
 *  2) MODE API (opsional): user memasukkan API key OpenAI-compatible miliknya
 *     sendiri. Key disimpan lokal; request dikirim langsung dari HP ke provider.
 * Semua jawaban selalu menyertakan peringatan: bukan pengganti mekanik.
 */
(function (global) {
  'use strict';
  const MC = global.MC, CU = global.MCU, I = global.MCI, MCS = global.MCS, MCD = global.MCD;

  /* ---------- basis pengetahuan gejala ---------- */
  const KB = [
    { keys: ['bunyi', 'kasar', 'berisik', 'kasar saat gas', 'getar', 'berdengung', 'cvt'], comp: 'cvt',
      cause: 'CVT kotor, roller aus, atau v-belt mulai tipis',
      check: 'Buka cover CVT, cek kondisi roller, v-belt, dan kampas ganda. Bersihkan debu.',
      urgency: 'sedang', interval: 'Servis CVT tiap 8.000 km' },
    { keys: ['susah', 'starter', 'mati', 'tidak mau nyala', 'aki', 'starter lemah', 'klik'], comp: 'aki',
      cause: 'Aki lemah, terminal kotor, atau sistem pengisian tidak bekerja',
      check: 'Ukur tegangan aki (istirahat: >12.4V, saat starter jangan turun di bawah 9.5V). Cek terminal kendor/kerak.',
      urgency: 'tinggi', interval: 'Aki umumnya 1.5–2 tahun' },
    { keys: ['rem', 'blong', 'kampas', 'tidak pakem', 'bunyi rem', 'jauh'], comp: 'rem-depan',
      cause: 'Kampas rem aus, minyak rem berkurang, atau udara di jalur hidrolik',
      check: 'Cek ketebalan kampas (minimal 2mm), level minyak rem, dan rem angin di jalur.',
      urgency: 'kritis', interval: 'Cek kampas tiap 4.000 km' },
    { keys: ['oli', 'ganti oli', 'oli hitam', 'mesin panas', 'overheat'], comp: 'oli',
      cause: 'Oli melewati interval atau kualitas turun',
      check: 'Cek warna & level oli di dipstick. Oli hitam pekat / berbau gosong = ganti.',
      urgency: 'tinggi', interval: 'Oli mesin tiap 2.000–3.000 km' },
    { keys: ['panas', 'overheat', 'mesin panas', 'suhu', 'radiator', 'pendingin'], comp: 'pendingin',
      cause: 'Sistem pendingin bermasalah: cairan kurang, kipas mati, atau radiator kotor',
      check: 'Cek level cairan pendingin, pastikan kipas menyala saat mesin panas, bersihkan sirip radiator.',
      urgency: 'kritis', interval: 'Cek cairan tiap 4.000 km' },
    { keys: ['tarikan', 'lambat', 'kurang bertenaga', 'mbrebet', 'brebet', 'tersendat', 'gas'], comp: 'bahan-bakar',
      cause: 'Pasokan bahan bakar atau pengapian tidak optimal: filter kotor, injektor, atau busi lemah',
      check: 'Cek filter udara, kondisi busi (warna elektroda), dan tekanan pompa bensin.',
      urgency: 'sedang', interval: 'Busi tiap 8.000 km, filter udara tiap 8.000 km' },
    { keys: ['lampu', 'mati lampu', 'redup', 'klakson', 'kelistrikan', 'sekring'], comp: 'kelistrikan',
      cause: 'Masalah kelistrikan: sekring putus, konektor kotor, atau kiprok/regulator lemah',
      check: 'Cek sekring terkait, bersihkan konektor, ukur tegangan pengisian (13.5–14.5V saat idle naik).',
      urgency: 'sedang', interval: 'Cek tiap servis berkala' },
    { keys: ['rantai', 'gear', 'ketat', 'kendor', 'berisik rantai'], comp: 'rantai-gear',
      cause: 'Rantai kendor/kering atau gir sudah menajam',
      check: 'Cek kelenturan rantai (2–3cm), lumasi, periksa gigi gir apakah sudah tajam.',
      urgency: 'sedang', interval: 'Lumasi tiap 500 km, setel tiap 2.000 km' },
    { keys: ['ban', 'gundul', 'bocor', 'kempes', 'selip', 'retak'], comp: 'ban',
      cause: 'Ban aus atau tekanan angin tidak sesuai',
      check: 'Cek ketebalan alur (minimal 1.6mm), tekanan angin sesuai buku manual, cari retak/benjol.',
      urgency: 'tinggi', interval: 'Cek tekanan tiap minggu, ganti ban 15.000–20.000 km' },
    { keys: ['suspensi', 'shock', 'keras', 'bunyi suspensi', 'oleng', 'goyang'], comp: 'suspensi',
      cause: 'Seal shock bocor atau per sudah lemah',
      check: 'Cek rembesan oli di batang shock, tekan motor untuk rasakan redaman.',
      urgency: 'sedang', interval: 'Cek tiap servis besar' },
    { keys: ['mesin', 'bunyi mesin', 'kasar mesin', 'ketuk', 'klek'], comp: 'mesin',
      cause: 'Perlu pemeriksaan langsung: klep, timing chain, atau bantalan',
      check: 'Jangan didiagnosis sendiri. Bunyi metalik dari mesin = segera ke bengkel.',
      urgency: 'kritis', interval: 'Servis mesin tiap 8.000 km' }
  ];

  const URGENCY_LABEL = { kritis: 'Harus segera ditangani', tinggi: 'Tinggi — jangan ditunda lama', sedang: 'Sedang — periksa minggu ini', rendah: 'Rendah — pantau saja' };

  function matchLocal(q) {
    const s = String(q || '').toLowerCase();
    const hits = [];
    KB.forEach((k) => {
      let score = 0;
      k.keys.forEach((key) => { if (s.indexOf(key) >= 0) score += key.length; });
      if (score > 0) hits.push({ score, item: k });
    });
    hits.sort((a, b) => b.score - a.score);
    return hits.slice(0, 3).map((h) => h.item);
  }

  function localAnswer(q) {
    const hits = matchLocal(q);
    if (!hits.length) {
      return {
        text: 'Saya belum punya pola yang cocok untuk keluhan itu di basis pengetahuan lokal.\n\n' +
          'Coba sebutkan lebih spesifik: kapan bunyinya muncul (saat gas dibuka, saat menikung, saat mengerem), ' +
          'dan bagian mana yang terasa bermasalah.\n\n' +
          'Kalau gejalanya mengganggu keselamatan (rem, setang, bunyi metalik dari mesin), langsung ke bengkel — jangan tunggu.',
        items: [], mode: 'local'
      };
    }
    const parts = [];
    parts.push('Kemungkinan yang paling sering menyebabkan keluhan seperti itu:\n');
    hits.forEach((h) => {
      const compLabel = (MC.COMPONENTS.find((c) => c.id === h.comp) || {}).label || h.comp;
      parts.push('• ' + compLabel + ' — ' + h.cause + '\n  Yang bisa dicek: ' + h.check +
        '\n  Urgensi: ' + (URGENCY_LABEL[h.urgency] || h.urgency) +
        (h.interval ? '\n  Interval: ' + h.interval : '') + '\n');
    });
    return { text: parts.join('\n'), items: hits, mode: 'local' };
  }

  /* ---------- mode API (opsional) ---------- */
  async function getKeySetting() {
    const m = (await MC.Store.get('meta', 'ai')) || { id: 'ai' };
    return m;
  }

  async function buildContext() {
    const bike = MCS.activeBike();
    if (!bike) return 'Belum ada data motor.';
    const ctx = MCS.ctxFor(bike);
    const km = MCD.currentKm(bike, ctx.odoLog, ctx.services);
    const health = MCD.healthScore(bike, ctx);
    const rems = MCD.buildReminders(bike, ctx.services, ctx.reminders, km).filter((r) => r.state !== 'no-baseline');

    let s = 'DATA MOTOR USER (dari aplikasi MOTORCARE):\n';
    s += '- ' + [bike.brand, bike.model, bike.year].filter(Boolean).join(' ') + ' (' + bike.nickname + ')\n';
    s += '- Odometer: ' + km + ' km\n';
    s += '- Status kesehatan: ' + health.label + (health.score !== null ? ' (' + health.score + '%)' : '') + '\n';
    s += '- Komponen diperiksa: ' + health.checked + '/' + health.total + '\n';
    if (health.factors.length) s += '- Catatan: ' + health.factors.map((f) => f.text).join('; ') + '\n';
    if (rems.length) {
      s += '- Jadwal perawatan:\n';
      rems.slice(0, 8).forEach((r) => {
        s += '  · ' + r.label + ': ' + (r.kmLeft !== null ? (r.kmLeft <= 0 ? 'LEWAT ' + Math.abs(r.kmLeft) + ' km' : r.kmLeft + ' km lagi') : '') +
          (r.daysLeft !== null ? (r.kmLeft !== null ? ', ' : '') + (r.daysLeft <= 0 ? 'LEWAT ' + Math.abs(r.daysLeft) + ' hari' : r.daysLeft + ' hari lagi') : '') + '\n';
      });
    }
    const recent = ctx.services.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 5);
    if (recent.length) {
      s += '- Servis terakhir:\n';
      recent.forEach((sv) => {
        const t = (sv.types || [sv.type]).map((x) => (MC.SERVICE_TYPES.find((v) => v.id === x) || {}).label || x);
        s += '  · ' + sv.date + ' @ ' + sv.km + ' km: ' + t.join(' + ') + (sv.cost ? ' (Rp' + sv.cost + ')' : '') + '\n';
      });
    }
    const openDmg = ctx.damages.filter((d) => d.status !== 'selesai');
    if (openDmg.length) {
      s += '- Kerusakan terbuka:\n';
      openDmg.forEach((d) => { s += '  · ' + (d.name || '') + ' (' + (d.part || '-') + '), prioritas ' + d.priority + '\n'; });
    }
    return s;
  }

  async function apiAnswer(question, setting) {
    const ctxText = await buildContext();
    const sys = 'Kamu adalah asisten mekanik sepeda motor untuk pengguna Indonesia. ' +
      'Jawab dalam bahasa Indonesia yang sederhana dan praktis. ' +
      'Gunakan data motor user di bawah kalau relevan. ' +
      'JANGAN memberi diagnosis pasti — sebutkan kemungkinan penyebab dan pemeriksaan yang bisa dilakukan. ' +
      'Kalau gejala berbahaya (rem, setang, bunyi metalik mesin, asap), sarankan segera ke bengkel. ' +
      'Jawab ringkas: maksimal 200 kata, pakai poin-poin.\n\n' + ctxText;

    const res = await fetch(setting.baseUrl.replace(/\/+$/, '') + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + setting.apiKey
      },
      body: JSON.stringify({
        model: setting.model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: question }
        ],
        temperature: 0.4,
        max_tokens: 700
      })
    });

    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error('HTTP ' + res.status + (t ? ': ' + t.slice(0, 160) : ''));
    }
    const j = await res.json();
    const msg = j.choices && j.choices[0] && j.choices[0].message;
    if (!msg) throw new Error('Respons provider tidak berisi jawaban');
    return typeof msg.content === 'string' ? msg.content : (Array.isArray(msg.content)
      ? msg.content.map((c) => c.text || '').join('') : String(msg.content || ''));
  }

  /* ---------- UI ---------- */
  function openAI() {
    const presets = [
      { id: 'local', label: 'Lokal (offline)' },
      { id: 'api', label: 'API key sendiri' }
    ];
    let mode = 'local';
    let history = [];

    const body =
      '<div class="seg" style="margin-bottom:12px">' +
        presets.map((p) => '<button data-mode="' + p.id + '" class="' + (p.id === mode ? 'on' : '') + '">' + p.label + '</button>').join('') +
      '</div>' +
      '<div data-apisettings style="display:none">' +
        '<div class="banner info" style="margin-bottom:12px">' + I.icon('info') +
          '<span>Key disimpan hanya di HP ini dan dikirim langsung ke provider pilihanmu. Tidak lewat server kami — karena memang tidak ada server.</span></div>' +
        CU.field('Base URL', CU.input('apiBase', '', { placeholder: 'https://api.openai.com/v1' })) +
        CU.field('Model', CU.input('apiModel', '', { placeholder: 'gpt-4o-mini' })) +
        CU.field('API key', '<input class="inp" name="apiKey" type="password" placeholder="sk-..." autocomplete="off">') +
        '<button class="btn sm ghost block" data-saveapi style="margin-bottom:8px">' + I.icon('check') + 'Simpan pengaturan</button>' +
      '</div>' +
      '<div data-chat style="display:flex;flex-direction:column;gap:10px;max-height:44vh;overflow-y:auto;padding-right:2px;margin-bottom:12px"></div>' +
      '<div class="banner warn" style="margin-bottom:12px">' + I.icon('alert') +
        '<span>Jawaban AI bukan pengganti pemeriksaan mekanik. Untuk rem, setang, atau bunyi metalik mesin — langsung ke bengkel.</span></div>' +
      '<form id="aiForm" style="display:flex;gap:8px;align-items:flex-end">' +
        '<textarea class="inp" name="q" rows="1" placeholder="Tulis gejala atau pertanyaan…" style="min-height:44px;resize:none"></textarea>' +
        '<button class="btn primary" style="min-width:48px;min-height:44px;padding:0" data-send type="submit" aria-label="Kirim">' + I.icon('send') + '</button>' +
      '</form>';

    const s = CU.sheet({
      title: 'Tanya Mekanik AI',
      body,
      onMount(root) {
        const chat = root.querySelector('[data-chat]');
        const settingsBox = root.querySelector('[data-apisettings]');

        function addMsg(role, text) {
          const isUser = role === 'user';
          const div = document.createElement('div');
          div.style.cssText = 'display:flex;justify-content:' + (isUser ? 'flex-end' : 'flex-start');
          div.innerHTML = '<div style="max-width:88%;padding:10px 12px;border-radius:' + (isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px') +
            ';background:' + (isUser ? 'var(--accent)' : 'var(--surface-2)') +
            ';color:' + (isUser ? 'oklch(0.16 0.01 60)' : 'var(--text)') +
            ';font-size:13px;line-height:1.55;white-space:pre-wrap;word-break:break-word">' + CU.esc(text) + '</div>';
          chat.appendChild(div);
          chat.scrollTop = chat.scrollHeight;
        }

        function addLoading() {
          const div = document.createElement('div');
          div.setAttribute('data-loading', '1');
          div.style.cssText = 'display:flex;justify-content:flex-start';
          div.innerHTML = '<div style="padding:10px 14px;border-radius:14px 14px 14px 4px;background:var(--surface-2);font-size:13px;color:var(--text-3)">Memeriksa…</div>';
          chat.appendChild(div);
          chat.scrollTop = chat.scrollHeight;
          return div;
        }

        // seed: saran cepat
        const quick = ['Motor berisik saat gas dibuka', 'Rem terasa jauh / tidak pakem', 'Susah distarter pagi', 'Tarikan berat dan mbrebet'];
        addMsg('assistant', 'Ceritakan gejala motormu. Saya cocokkan dengan basis pengetahuan perawatan, lalu sebutkan kemungkinan penyebab dan yang bisa kamu cek sendiri.\n\nMode lokal tidak memakai internet dan tidak mengarang jawaban.');
        const qbox = document.createElement('div');
        qbox.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-top:2px';
        qbox.innerHTML = quick.map((q) => '<button type="button" class="chip" data-quick="' + CU.esc(q) + '">' + CU.esc(q) + '</button>').join('');
        chat.appendChild(qbox);
        qbox.querySelectorAll('[data-quick]').forEach((b) => {
          b.onclick = () => {
            root.querySelector('#aiForm [name=q]').value = b.dataset.quick;
            root.querySelector('#aiForm').dispatchEvent(new Event('submit'));
          };
        });

        // load settings
        getKeySetting().then((st) => {
          if (st.apiKey) {
            root.querySelector('[name=apiBase]').value = st.baseUrl || 'https://api.openai.com/v1';
            root.querySelector('[name=apiModel]').value = st.model || 'gpt-4o-mini';
            root.querySelector('[name=apiKey]').value = st.apiKey;
          }
        });

        root.querySelectorAll('[data-mode]').forEach((btn) => {
          btn.onclick = () => {
            mode = btn.dataset.mode;
            root.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === mode));
            settingsBox.style.display = mode === 'api' ? 'block' : 'none';
          };
        });

        root.querySelector('[data-saveapi]').onclick = async () => {
          const st = (await MC.Store.get('meta', 'ai')) || { id: 'ai' };
          st.apiKey = root.querySelector('[name=apiKey]').value.trim();
          st.baseUrl = root.querySelector('[name=apiBase]').value.trim() || 'https://api.openai.com/v1';
          st.model = root.querySelector('[name=apiModel]').value.trim() || 'gpt-4o-mini';
          await MC.Store.put('meta', st);
          CU.toast(st.apiKey ? 'Pengaturan AI disimpan' : 'Key dihapus', 'ok');
        };

        const form = root.querySelector('#aiForm');
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const ta = form.querySelector('[name=q]');
          const q = ta.value.trim();
          if (!q) return;
          ta.value = '';
          addMsg('user', q);
          history.push({ role: 'user', content: q });

          const loading = addLoading();
          try {
            let answer;
            if (mode === 'api') {
              const st = await getKeySetting();
              if (!st.apiKey) {
                loading.remove();
                addMsg('assistant', 'Mode API butuh key. Isi Base URL, model, dan API key dulu di atas — atau pindah ke mode Lokal.');
                return;
              }
              answer = await apiAnswer(q, st);
            } else {
              const r = localAnswer(q);
              answer = r.text;
            }
            loading.remove();
            addMsg('assistant', answer);
            history.push({ role: 'assistant', content: answer });
          } catch (err) {
            loading.remove();
            addMsg('assistant', 'Gagal menghubungi provider: ' + err.message + '\n\nCoba cek Base URL, model, dan key-nya. Atau pakai mode Lokal yang selalu jalan offline.');
          }
          chat.scrollTop = chat.scrollHeight;
        });

        const ta = form.querySelector('[name=q]');
        ta.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            form.dispatchEvent(new Event('submit'));
          }
        });
      }
    });
    return s;
  }

  global.MCAI = { openAI, localAnswer, KB };
})(window);
