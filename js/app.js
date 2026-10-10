/* app.js — UI wiring for countdown-hub-bd.
 * All date math comes from window.CD (js/countdown.js);
 * all chrome strings from window.I18N (js/i18n.js). */
(function () {
  'use strict';

  var LS_KEY = 'countdown-hub-bd:v1';
  var COLORS = ['#5b5bd6', '#0ea5a4', '#e08700', '#d6455b', '#7c3aed', '#1c7a3d'];
  var REMIND_OFFSET = { day: 24 * 3600 * 1000, hour: 3600 * 1000 };

  var state = { events: [], lang: 'en', bnDigits: true, notifWanted: false };
  var selectedColor = COLORS[0];

  /* ---------- tiny helpers ---------- */
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function t(key) { return (I18N.STR[state.lang] && I18N.STR[state.lang][key]) || I18N.STR.en[key] || key; }
  function num(n) {
    var s = String(n);
    return (state.lang === 'bn' && state.bnDigits) ? CD.toBengaliDigits(s) : s;
  }
  function uid() { return 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  /* ---------- persistence ---------- */
  function save() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) { /* storage full/blocked: app still works in-memory */ }
  }
  function load() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      var s = JSON.parse(raw);
      if (s && Array.isArray(s.events)) state.events = s.events;
      if (s && (s.lang === 'en' || s.lang === 'bn')) state.lang = s.lang;
      if (s && typeof s.bnDigits === 'boolean') state.bnDigits = s.bnDigits;
      if (s && typeof s.notifWanted === 'boolean') state.notifWanted = s.notifWanted;
    } catch (e) { /* corrupt storage: start fresh */ }
  }

  /* ---------- event model ---------- */
  // event = { id, name, datetime:"YYYY-MM-DDTHH:MM", repeatYearly:bool,
  //           color, reminder:"none"|"day"|"hour", notified:{ "<target>:<rem>": true } }
  function resolvedList() {
    var now = CD.nowMs();
    return state.events.map(function (ev) {
      var r = CD.resolveTarget(ev, now);
      return { ev: ev, target: r.target, past: r.past, rolled: r.rolled };
    }).filter(function (x) { return !isNaN(x.target); })
      .sort(function (a, b) {
        if (!a.past && b.past) return -1;
        if (a.past && !b.past) return 1;
        return a.past ? b.target - a.target : a.target - b.target;
      });
  }

  function fmtCountdown(parts) {
    // compact row form: 2d 4h 12m 33s (digits localized)
    return num(parts.days) + t('d') + ' ' + num(CD.pad2(parts.hours)) + t('h') + ' ' +
           num(CD.pad2(parts.minutes)) + t('m') + ' ' + num(CD.pad2(parts.seconds)) + t('s');
  }

  function fmtAgo(target, now) {
    var p = CD.agoParts(target - now);
    return num(p.value) + ' ' + t(I18N.AGO_KEY[p.unit]);
  }

  function fmtDateTime(ms) {
    var d = new Date(ms);
    var locale = state.lang === 'bn' ? 'bn-BD' : 'en-GB';
    var s;
    try {
      s = d.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
    } catch (e) {
      s = d.toLocaleString();
    }
    return (state.lang === 'bn' && state.bnDigits) ? CD.toBengaliDigits(s) : s;
  }

  /* ---------- rendering ---------- */
  function applyI18n() {
    document.documentElement.lang = state.lang === 'bn' ? 'bn' : 'en';
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph')));
    });
    $('langBtn').textContent = t('langBtn');
    $('digitsBtn').textContent = state.bnDigits ? t('digitsBtn') : t('digitsBtnLatin');
    updateNotifBtn();
  }

  function renderHero() {
    var now = CD.nowMs();
    var list = resolvedList();
    var body = $('heroBody');
    if (!list.length) {
      body.innerHTML = '<p class="hero-empty">' + esc(t('heroCta')) + '</p>';
      return;
    }
    var item = list[0];
    var ev = item.ev;
    if (item.past) {
      body.innerHTML =
        '<h2 class="hero-name">' + esc(ev.name) + '</h2>' +
        '<p class="hero-date">' + esc(fmtDateTime(item.target)) + '</p>' +
        '<div class="digits"><div class="digit"><b>' + esc(fmtAgo(item.target, now)) + '</b><span>' + esc(t('inPast')) + '</span></div></div>';
      return;
    }
    var p = CD.diffParts(item.target - now);
    var badge = ev.repeatYearly ? '<span class="hero-badge">' + esc(t('yearlyBadge')) + '</span>' : '';
    body.innerHTML =
      '<h2 class="hero-name">' + esc(ev.name) + badge + '</h2>' +
      '<p class="hero-date">' + esc(fmtDateTime(item.target)) + '</p>' +
      '<div class="digits" id="heroDigits">' +
      digitBox(p.days, t('days')) + digitBox(p.hours, t('hours')) +
      digitBox(p.minutes, t('minutes')) + digitBox(p.seconds, t('seconds')) +
      '</div>';
  }

  function digitBox(v, label) {
    return '<div class="digit"><b data-dv="' + v + '">' + esc(num(v)) + '</b><span>' + esc(label) + '</span></div>';
  }

  function renderList() {
    var now = CD.nowMs();
    var list = resolvedList();
    var box = $('eventList');
    $('emptyState').classList.toggle('hidden', list.length > 0);
    box.innerHTML = list.map(function (item) {
      var ev = item.ev;
      var countHtml;
      if (item.past) {
        countHtml = '<span class="ev-count past">' + esc(fmtAgo(item.target, now)) + '</span>';
      } else {
        var p = CD.diffParts(item.target - now);
        countHtml = '<span class="ev-count" data-count="' + ev.id + '">' + esc(fmtCountdown(p)) + '</span>';
      }
      var badges = '';
      if (ev.repeatYearly) badges += '<span class="badge yearly">' + esc(t('yearlyBadge')) + '</span>';
      if (item.past && !ev.repeatYearly) badges += '<span class="badge pastflag">' + esc(t('pastFlag')) + '</span>';
      if (ev.reminder !== 'none') badges += '<span class="badge rem">🔔</span>';
      return '<div class="ev" data-ev="' + ev.id + '">' +
        '<span class="ev-dot" style="background:' + esc(ev.color || COLORS[0]) + '"></span>' +
        '<div class="ev-main"><p class="ev-name">' + esc(ev.name) + badges + '</p>' +
        '<p class="ev-sub">' + esc(fmtDateTime(item.target)) + '</p></div>' +
        countHtml +
        '<button class="ev-del" data-del="' + ev.id + '" title="' + esc(t('delete')) + '" aria-label="' + esc(t('delete')) + '">✕</button>' +
        '</div>';
    }).join('');
  }

  // Light per-second refresh: update countdown texts without rebuilding DOM.
  function tick() {
    var now = CD.nowMs();
    var list = resolvedList();
    list.forEach(function (item) {
      if (item.past) return;
      var el = document.querySelector('[data-count="' + item.ev.id + '"]');
      if (el) el.textContent = fmtCountdown(CD.diffParts(item.target - now));
    });
    var hero = $('heroDigits');
    if (hero && list.length && !list[0].past) {
      var p = CD.diffParts(list[0].target - now);
      var bs = hero.querySelectorAll('b');
      var vals = [p.days, p.hours, p.minutes, p.seconds];
      bs.forEach(function (b, i) {
        if (b.getAttribute('data-dv') !== String(vals[i])) {
          b.setAttribute('data-dv', vals[i]);
          b.textContent = num(vals[i]);
        }
      });
    }
    // Re-render structurally once a minute (handles rollovers past midnight etc.)
    if (!tick._last || now - tick._last > 55000) { tick._last = now; renderHero(); renderList(); }
  }

  function renderAll() { applyI18n(); renderHero(); renderList(); }

  /* ---------- notifications ---------- */
  function notifSupported() { return 'Notification' in window; }

  function updateNotifBtn() {
    var btn = $('notifBtn');
    var note = $('notifNote');
    if (!notifSupported()) {
      btn.classList.add('hidden');
      note.textContent = t('notifUnsupported');
      note.classList.remove('hidden');
      return;
    }
    btn.classList.remove('hidden');
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && state.notifWanted) {
      btn.textContent = '🔔 ' + t('notifOn');
      btn.classList.add('on');
      note.classList.add('hidden');
    } else if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
      btn.textContent = '🔔 ' + t('enableNotif');
      btn.classList.remove('on');
      note.textContent = t('notifDenied');
      note.classList.remove('hidden');
    } else {
      btn.textContent = '🔔 ' + t('enableNotif');
      btn.classList.remove('on');
      if (state.notifWanted) note.classList.add('hidden');
    }
  }

  function requestNotif() {
    if (!notifSupported()) { updateNotifBtn(); return; }
    try {
      var p = Notification.requestPermission();
      if (p && p.then) {
        p.then(function () { state.notifWanted = true; save(); updateNotifBtn(); checkReminders(); });
      } else {
        state.notifWanted = true; save(); updateNotifBtn(); checkReminders();
      }
    } catch (e) { updateNotifBtn(); }
  }

  function fireReminder(ev, label) {
    var title = '⏳ ' + ev.name;
    var body = label;
    try {
      if (notifSupported() && Notification.permission === 'granted') {
        new Notification(title, { body: body });
        return;
      }
    } catch (e) { /* fall through to in-page fallback */ }
    // Graceful fallback: in-page alert banner (also the path when blocked/unsupported)
    var note = $('notifNote');
    note.textContent = '🔔 ' + t('notifFallback') + ': ' + ev.name + ' — ' + body;
    note.classList.remove('hidden');
  }

  function checkReminders() {
    if (!state.notifWanted) return;
    var now = CD.nowMs();
    var changed = false;
    state.events.forEach(function (ev) {
      if (!ev.reminder || ev.reminder === 'none') return;
      var r = CD.resolveTarget(ev, now);
      if (isNaN(r.target) || r.past) return;
      var offset = REMIND_OFFSET[ev.reminder] || 0;
      if (!offset) return;
      var key = r.target + ':' + ev.reminder;
      ev.notified = ev.notified || {};
      if (ev.notified[key]) return;
      if (now >= r.target - offset && now < r.target) {
        var label = ev.reminder === 'day' ? t('remDay') : t('remHour');
        fireReminder(ev, label + ' · ' + fmtDateTime(r.target));
        ev.notified[key] = true;
        changed = true;
      }
    });
    if (changed) save();
  }

  /* ---------- CRUD ---------- */
  function addEvent(data) {
    var ev = {
      id: uid(),
      name: data.name,
      datetime: data.datetime,
      repeatYearly: !!data.repeatYearly,
      color: data.color || COLORS[0],
      reminder: data.reminder || 'none',
      notified: {}
    };
    state.events.push(ev);
    save(); renderHero(); renderList(); checkReminders();
    return ev;
  }

  function deleteEvent(id) {
    state.events = state.events.filter(function (e) { return e.id !== id; });
    save(); renderHero(); renderList();
  }

  function validateForm(name, dt) {
    if (!name.trim()) return t('nameRequired');
    if (!dt) return t('dateRequired');
    if (isNaN(CD.parseLocal(dt))) return t('dateRequired');
    return null;
  }

  /* ---------- export / import ---------- */
  function exportJSON() {
    var blob = new Blob([JSON.stringify({ app: 'countdown-hub-bd', v: 1, events: state.events }, null, 2)],
      { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'countdown-hub-backup.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function validEvent(o) {
    return o && typeof o.name === 'string' && o.name.trim() &&
      typeof o.datetime === 'string' && !isNaN(CD.parseLocal(o.datetime));
  }

  function importJSON(text) {
    var msg = $('importMsg');
    try {
      var data = JSON.parse(text);
      var arr = Array.isArray(data) ? data : data.events;
      if (!Array.isArray(arr) || !arr.every(validEvent)) throw new Error('bad schema');
      state.events = arr.map(function (o) {
        return {
          id: typeof o.id === 'string' ? o.id : uid(),
          name: String(o.name).slice(0, 80),
          datetime: o.datetime,
          repeatYearly: !!o.repeatYearly,
          color: typeof o.color === 'string' ? o.color : COLORS[0],
          reminder: (o.reminder === 'day' || o.reminder === 'hour') ? o.reminder : 'none',
          notified: (o.notified && typeof o.notified === 'object') ? o.notified : {}
        };
      });
      save(); renderHero(); renderList(); checkReminders();
      msg.textContent = t('importDone').replace('{n}', num(state.events.length));
      msg.classList.remove('hidden');
      return true;
    } catch (e) {
      msg.textContent = t('importFail');
      msg.classList.remove('hidden');
      return false;
    }
  }

  /* ---------- sample data ---------- */
  function loadSample() {
    var now = CD.nowMs();
    function isoPlus(ms) {
      var d = new Date(ms);
      return d.getFullYear() + '-' + CD.pad2(d.getMonth() + 1) + '-' + CD.pad2(d.getDate()) +
        'T' + CD.pad2(d.getHours()) + ':' + CD.pad2(d.getMinutes());
    }
    var samples = state.lang === 'bn' ? [
      { name: 'ঈদ-উল-ফিতর', off: 5 * 864e5, yearly: true, color: COLORS[2] },
      { name: 'জন্মদিন', off: 40 * 864e5, yearly: true, color: COLORS[0] },
      { name: 'ডিআইইউ ভর্তি মেলা', off: -3 * 864e5, yearly: false, color: COLORS[3] }
    ] : [
      { name: 'Eid-ul-Fitr', off: 5 * 864e5, yearly: true, color: COLORS[2] },
      { name: 'Birthday', off: 40 * 864e5, yearly: true, color: COLORS[0] },
      { name: 'DIU Admission Fair', off: -3 * 864e5, yearly: false, color: COLORS[3] }
    ];
    samples.forEach(function (s) {
      addEvent({ name: s.name, datetime: isoPlus(now + s.off), repeatYearly: s.yearly, color: s.color, reminder: 'none' });
    });
  }

  /* ---------- wiring ---------- */
  function buildSwatches() {
    var row = $('colorRow');
    row.innerHTML = '';
    COLORS.forEach(function (c, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch';
      b.style.background = c;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', i === 0 ? 'true' : 'false');
      b.setAttribute('aria-label', c);
      b.addEventListener('click', function () {
        selectedColor = c;
        row.querySelectorAll('.swatch').forEach(function (s) { s.setAttribute('aria-checked', 'false'); });
        b.setAttribute('aria-checked', 'true');
      });
      row.appendChild(b);
    });
  }

  function init() {
    load();
    buildSwatches();
    applyI18n();
    renderHero();
    renderList();

    $('addForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var name = $('fName').value;
      var dt = $('fDate').value;
      var err = validateForm(name, dt);
      var errBox = $('formErr');
      if (err) { errBox.textContent = err; errBox.classList.remove('hidden'); return; }
      errBox.classList.add('hidden');
      addEvent({
        name: name.trim(),
        datetime: dt,
        repeatYearly: $('fYearly').checked,
        color: selectedColor,
        reminder: $('fReminder').value
      });
      $('fName').value = '';
      $('fDate').value = '';
      $('fYearly').checked = false;
      $('fReminder').value = 'none';
    });

    $('eventList').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-del]');
      if (!btn) return;
      if (window.confirm(t('confirmDelete'))) deleteEvent(btn.getAttribute('data-del'));
    });

    $('langBtn').addEventListener('click', function () {
      state.lang = state.lang === 'en' ? 'bn' : 'en';
      save(); renderAll();
    });

    $('digitsBtn').addEventListener('click', function () {
      state.bnDigits = !state.bnDigits;
      save(); renderAll();
    });

    $('notifBtn').addEventListener('click', requestNotif);

    $('exportBtn').addEventListener('click', exportJSON);
    $('importBtn').addEventListener('click', function () { $('importFile').click(); });
    $('importFile').addEventListener('change', function (e) {
      var f = e.target.files[0];
      if (!f) return;
      var r = new FileReader();
      r.onload = function () { importJSON(String(r.result)); };
      r.readAsText(f);
      e.target.value = '';
    });

    $('clearBtn').addEventListener('click', function () {
      if (window.confirm(t('confirmClear'))) {
        state.events = [];
        save(); renderHero(); renderList();
      }
    });

    $('sampleBtn').addEventListener('click', loadSample);

    // Live ticking + periodic reminder sweep.
    setInterval(tick, 1000);
    setInterval(checkReminders, 60000);
    if (state.notifWanted) checkReminders();
  }

  // Test seam (also used by the export test): window.__CHB = { state, importJSON, ... }
  window.__CHB = {
    state: state, addEvent: addEvent, deleteEvent: deleteEvent,
    importJSON: importJSON, exportJSON: exportJSON, checkReminders: checkReminders,
    resolvedList: resolvedList, renderAll: renderAll
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
