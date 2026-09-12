# HRM Fallen Tree Reporter (PWA proof of concept)

A small installable Progressive Web App for reporting fallen trees in Halifax
Regional Municipality. It is a hackathon proof of concept: **there is no
backend**. "Submitting" a report writes it to the browser's own storage and it
shows up in a local history list — nothing is sent over the network.

This directory is self-contained. It shares no tooling with the Python scraper
at the repository root; it has its own `package.json` and its own toolchain.

## What it does

- **Report form** — address (typed, or filled from the device's current
  position), description, severity, and free-text notes.
- **Photo is required.** The file input uses `accept="image/*"
  capture="environment"`, so a phone offers the camera directly. A preview
  thumbnail is shown, and submission is blocked with an explanation until a
  photo is attached.
- **GPS geotag is required.** A fix is taken from the Geolocation API when the
  photo is attached and refreshed at submit time, and stored as structured
  metadata (`lat`, `lng`, `accuracy`, fix `timestamp`, and which step produced
  it) on the report record. If permission is denied or no fix is available the
  app says so prominently and refuses the submission — an untagged report is
  never silently accepted — and a **Retry location** button makes the denial
  path recoverable.

  Why structured metadata rather than reading EXIF out of the image: browsers
  generally strip embedded EXIF GPS from camera captures for privacy, and on
  desktop a user may attach any file at all, so an EXIF GPS tag is neither
  reliably present nor trustworthy. No EXIF parsing is done.
- **Optional profile** — name, contact, default address, kept in
  `localStorage`. It prefills the report form when present and can be edited or
  cleared at any time. It is entirely optional: the whole report flow works for
  an anonymous user with no profile, and reports then record the reporter as
  *Anonymous*.
- **Local report history** — a list of submitted reports with photo thumbnail,
  location, GPS coordinates and timestamp, a detail view, and a "Clear all
  reports" button that is handy between demos.
- **Installable and offline-capable** — `manifest.webmanifest` with 192/512 and
  maskable icons, and a Workbox service worker that precaches the app shell so
  the app still loads with no network.

## Where data lives

| Data | Store | Why |
| --- | --- | --- |
| Reports, including the photo as a `Blob` | IndexedDB (`hrm-fallen-trees` / `reports`) | A phone photo is commonly several MB; base64 in `localStorage` would inflate it ~33% and blow the ~5 MB origin quota. |
| Reporter profile (three short strings) | `localStorage` (`hrm-fallen-trees.profile`) | Tiny, and reading it synchronously lets the form prefill without a flash. |

## Setup

Requires Node 24 (see `.github/workflows/pwa-ci.yml`) and npm.

```sh
cd pwa
npm install
```

## Run

```sh
npm run dev        # dev server on http://localhost:5173
npm run build      # production build into pwa/dist/
npm run preview    # serve the built dist/ on http://localhost:4173
npm run icons      # regenerate public/icons/*.png from scripts/generate-icons.mjs
```

The service worker is only active in a production build, so test installability
and offline behaviour against `npm run build && npm run preview`.

## Tests

An end-to-end Playwright suite drives the real app in Chromium:

```sh
npx playwright install chromium   # once
npm run test:e2e
```

`playwright.config.js` starts both servers itself — the dev server on 5173 for
the behavioural specs, and a production build served on 4173 for the
service-worker/offline spec.

The suite covers: submission blocked without a photo; a successful submission
with a granted geolocation fix; submission blocked and surfaced when
geolocation is denied, then recovering via **Retry location**; the report
appearing in history with thumbnail, location and timestamp and surviving a
page reload (asserted right down to the stored value being a `Blob` in
IndexedDB); the profile prefilling a fresh visit and the anonymous path
completing end to end; a valid manifest whose icons decode at the dimensions
they claim; and an offline reload of the built app rendering from the
precached shell.

## How to demo this

1. `npm run build && npm run preview`, then open <http://localhost:4173> in
   Chrome. Allow location when prompted.
2. **Show the guard rails first.** On the Report tab, type a description and hit
   **Submit report** with no photo — the form refuses and tells you why. Deny
   location in the browser's site settings and try again to see the location
   banner and the blocked submission, then allow it and press **Retry
   location**.
3. **File a report.** Attach a photo (on a phone this opens the camera), watch
   the GPS fix appear with its accuracy and the time of the fix, and submit.
4. **Show it arrived.** Switch to **My reports** — thumbnail, address,
   coordinates and timestamp. Open **View details** for the full structured
   geotag. Reload the page: it is still there, because it round-tripped through
   IndexedDB rather than living in React state.
5. **Show the profile is optional.** The first report was anonymous. Fill in the
   Profile tab, reload, and the report form is prefilled and reports now carry
   your details. **Clear profile** puts it back to anonymous.
6. **Show it installs and works offline.** Chrome's address bar offers an
   install icon. Once installed (or just in the tab), switch DevTools ▸ Network
   to *Offline* and reload — the shell still renders, and the history is intact.
7. **Clear all reports** on the History tab resets the demo.

## Known limitations (it is a proof of concept)

- Nothing is ever transmitted; there is no HRM 311 integration.
- Reports are per-browser and per-device, with no export.
- No map picker; the address is free text, and the coordinates come from the
  device rather than from geocoding the address.
- No photo downscaling before storage, so very large photos consume the origin
  quota faster than they need to.
