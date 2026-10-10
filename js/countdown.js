/* ============================================================
 * countdown.js — the single countdown-math module for
 * countdown-hub-bd. ALL date/time arithmetic lives here.
 *
 * Design notes:
 *  - Everything is computed from epoch milliseconds using the
 *    Date constructor, so DST transitions and leap years are
 *    handled by the platform — no hand-rolled calendar math.
 *  - `?now=<ISO local datetime>` (e.g. ?now=2026-10-11T02:00)
 *    freezes "now" for deterministic testing. The hook is
 *    documented in README.md and never used in production UI.
 *  - Yearly-repeat events roll forward to the next occurrence
 *    strictly AFTER now (an event exactly at now counts as due).
 * ============================================================ */
(function (global) {
  'use strict';

  var MS = { s: 1000, m: 60 * 1000, h: 3600 * 1000, d: 24 * 3600 * 1000 };

  // Parse a local datetime-local string ("YYYY-MM-DDTHH:MM") into epoch ms.
  // Returns NaN for invalid input.
  function parseLocal(isoLocal) {
    if (typeof isoLocal !== 'string' || !isoLocal) return NaN;
    var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(isoLocal);
    if (!m) return NaN;
    var d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], m[6] ? +m[6] : 0, 0);
    // Guard against overflow dates like 2026-02-30 (Date auto-rolls).
    if (d.getFullYear() !== +m[1] || d.getMonth() !== +m[2] - 1 || d.getDate() !== +m[3]) return NaN;
    return d.getTime();
  }

  // "Now" in epoch ms. Honors the ?now= test hook.
  function nowMs() {
    try {
      var q = new URLSearchParams(global.location.search).get('now');
      if (q) {
        var t = parseLocal(q.length === 16 ? q : q.slice(0, 16));
        if (!isNaN(t)) return t;
      }
    } catch (e) { /* ignore — fall through to real clock */ }
    return Date.now();
  }

  // Break a millisecond distance into d/h/m/s parts (floored).
  // `ms` may be negative (past events); parts are of |ms|.
  function diffParts(ms) {
    var abs = Math.abs(ms);
    var days = Math.floor(abs / MS.d);
    var hours = Math.floor((abs % MS.d) / MS.h);
    var minutes = Math.floor((abs % MS.h) / MS.m);
    var seconds = Math.floor((abs % MS.m) / MS.s);
    return { total: ms, past: ms < 0, days: days, hours: hours, minutes: minutes, seconds: seconds };
  }

  // For a yearly-repeat event, find the next occurrence strictly after nowMs.
  // Handles Feb 29 birthdays by falling back to Feb 28 in non-leap years.
  function nextYearlyOccurrence(month, day, hour, minute, fromMs) {
    var from = new Date(fromMs);
    var year = from.getFullYear();
    for (var i = 0; i < 3; i++) {
      var cand = makeValidDate(year + i, month, day, hour, minute);
      if (cand.getTime() > fromMs) return cand.getTime();
    }
    return makeValidDate(year + 3, month, day, hour, minute).getTime();
  }

  function makeValidDate(year, month, day, hour, minute) {
    var d = new Date(year, month, day, hour, minute, 0, 0);
    if (d.getMonth() !== month) { // e.g. Feb 29 in a non-leap year -> use Feb 28
      d = new Date(year, month + 1, 0, hour, minute, 0, 0);
    }
    return d;
  }

  // Resolve an event to its current target time (epoch ms) and whether it is past.
  // event = { datetime: "YYYY-MM-DDTHH:MM", repeatYearly: bool }
  function resolveTarget(event, atMs) {
    var base = parseLocal(event.datetime);
    if (isNaN(base)) return { target: NaN, past: false, rolled: false };
    if (event.repeatYearly) {
      var b = new Date(base);
      var next = nextYearlyOccurrence(b.getMonth(), b.getDate(), b.getHours(), b.getMinutes(), atMs);
      return { target: next, past: false, rolled: next !== base };
    }
    return { target: base, past: base <= atMs, rolled: false };
  }

  // Human "X ago" / "in X" for past events. Returns {value, unit} for i18n.
  function agoParts(pastMs) {
    var abs = Math.abs(pastMs);
    if (abs < MS.m) return { value: Math.max(1, Math.floor(abs / MS.s)), unit: 'seconds' };
    if (abs < MS.h) return { value: Math.floor(abs / MS.m), unit: 'minutes' };
    if (abs < MS.d) return { value: Math.floor(abs / MS.h), unit: 'hours' };
    if (abs < 30 * MS.d) return { value: Math.floor(abs / MS.d), unit: 'days' };
    if (abs < 365 * MS.d) return { value: Math.floor(abs / (30 * MS.d)), unit: 'months' };
    return { value: Math.floor(abs / (365 * MS.d)), unit: 'years' };
  }

  var BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

  // Convert Latin digits in a string to Bengali digits.
  function toBengaliDigits(str) {
    return String(str).replace(/[0-9]/g, function (d) { return BN_DIGITS[+d]; });
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  // Expose a small, testable API on window.CD
  global.CD = {
    MS: MS,
    parseLocal: parseLocal,
    nowMs: nowMs,
    diffParts: diffParts,
    nextYearlyOccurrence: nextYearlyOccurrence,
    resolveTarget: resolveTarget,
    agoParts: agoParts,
    toBengaliDigits: toBengaliDigits,
    pad2: pad2
  };
})(typeof window !== 'undefined' ? window : this);
