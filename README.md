# Countdown Hub BD — কাউন্টডাউন হাব

A free, fully offline event countdown hub. Add birthdays, exams, Eid, or any
moment that matters and watch it tick down live — in English or বাংলা.

## Problem

Important dates sneak up on people. Phone reminders get dismissed, calendar
apps need accounts and sync, and most countdown tools are ad-covered or
online-only. Countdown Hub is a tiny offline page that does one job well:
show exactly how long until (or since) your events.

## Features

- **Events** — name, date + time, category color, optional yearly repeat; sorted by nearest
- **Live countdowns** — days : hours : minutes : seconds, ticking every second
- **Yearly auto-roll** — birthdays and annual events roll to their next occurrence automatically (Feb 29 → Feb 28 in non-leap years)
- **Past events** — show "3 days ago" instead of a negative timer
- **Reminders** — optional per-event reminder 1 day / 1 hour before, via the browser Notification API, with an on-page fallback when notifications are blocked or unsupported
- **Hero card** — the nearest upcoming event featured with big digits
- **Bilingual UI** — full EN ⇄ বাংলা toggle, with optional Bengali digits (১২৩)
- **Offline persistence** — everything in `localStorage`; JSON export / import
- **Sample data** — one-click realistic sample events

## Stack

Vanilla HTML + CSS + JavaScript. No build step, no framework, no backend,
no dependencies, zero network requests.

## Prerequisites

Any modern browser (Chrome, Edge, Firefox, Safari). For development/testing:
Node.js 18+ and `puppeteer-core` (test only), plus a Chromium binary.

## Install

No install. Open `index.html` directly, or serve the folder:

```bash
cd countdown-hub-bd
python3 -m http.server 8000
# open http://localhost:8000
```

## Dev commands

There is no build. The deterministic test hook is a query parameter:

```
http://localhost:8000/?now=2026-10-11T02:00
```

`?now=<local ISO datetime>` freezes "now" for repeatable tests. It is
documented here and never used by the production UI.

## Env

None. There are no API keys, no backend, no `.env`.

## Testing

Real headless-Chromium tests via `puppeteer-core` (test script lives outside
the repo, in `/tmp`):

```bash
cd /tmp/ch-test
node test.js   # 23 checks: countdown math, ticking, yearly roll, past "ago",
               # delete, notification granted/denied paths, export/import
               # round-trip, reload persistence, BN/EN + digits, mobile 390px
```

Results: **23/23 passed, 0 console/page errors** (2026-10-11).

## Deployment

GitHub Pages compatible: static files, relative paths, no server code.
Enable Pages on `main` / root.

## Limitations (honest)

- **Reminders need the tab open.** The Notification API can only fire while
  this page is loaded in the browser; there is no service worker or
  background delivery. The app checks due reminders on load and every minute.
  If notifications are blocked/unsupported, reminders appear as on-page
  alerts instead — never silently dropped.
- **Yearly repeat** rolls to the next occurrence strictly after "now"; an
  event happening at this exact minute counts as due.
- **Data is per-browser** `localStorage` (no sync); JSON export is the backup path.
- Countdowns use the device's local timezone.

## Status

Built 2026-10-11 (MUSE PROJECT FACTORY Ω run #23). Tested green, ready for
GitHub Pages deployment.
