import { expect, test } from '@playwright/test';
import { PREVIEW_URL } from '../playwright.config.js';

/**
 * Exercises the real production build served by `vite preview`: manifest,
 * icons, service-worker registration, and an offline reload of the app shell.
 */

test.use({ baseURL: PREVIEW_URL });

async function waitForServiceWorker(page) {
  // `navigator.serviceWorker.ready` resolves once a worker is activated, which
  // is after Workbox's install-time precaching has completed.
  await page.evaluate(() => navigator.serviceWorker.ready);
  // NOTE: waitForFunction does not await a promise returned by the predicate —
  // a returned Promise is simply truthy — so this predicate stays synchronous.
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, {
    timeout: 30_000,
  });
  const state = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    return { active: registration?.active?.scriptURL, state: registration?.active?.state };
  });
  expect(state.state).toBe('activated');
  expect(state.active).toContain('/sw.js');
}

test('serves a valid webmanifest with real icons', async ({ page, request }) => {
  const response = await request.get(`${PREVIEW_URL}/manifest.webmanifest`);
  expect(response.status()).toBe(200);
  const manifest = await response.json();

  expect(manifest.name).toBe('HRM Fallen Tree Reporter');
  expect(manifest.short_name).toBe('Fallen Trees');
  expect(manifest.display).toBe('standalone');
  expect(manifest.start_url).toBe('/');
  expect(manifest.theme_color).toBe('#155724');
  expect(manifest.background_color).toBe('#f4f6f4');

  const sizes = manifest.icons.map((i) => i.sizes);
  expect(sizes).toContain('192x192');
  expect(sizes).toContain('512x512');
  expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true);

  // The document links the manifest so a browser can act on it.
  await page.goto('/');
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);

  // Decode every icon in the browser and assert the real pixel dimensions match
  // what the manifest claims.
  for (const icon of manifest.icons) {
    const [declaredW, declaredH] = icon.sizes.split('x').map(Number);
    const measured = await page.evaluate(
      (src) =>
        new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
          img.onerror = () => reject(new Error(`failed to decode ${src}`));
          img.src = src;
        }),
      `/${icon.src.replace(/^\//, '')}`
    );
    expect(measured, `${icon.src} dimensions`).toEqual({ w: declaredW, h: declaredH });
  }
});

test('registers a service worker and renders the app shell offline after reload', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'HRM Fallen Tree Reporter' })).toBeVisible();
  await waitForServiceWorker(page);

  const precached = await page.evaluate(async () => {
    const names = await caches.keys();
    const out = {};
    for (const name of names) {
      out[name] = (await (await caches.open(name)).keys()).map((r) => new URL(r.url).pathname);
    }
    return out;
  });
  const allCached = Object.values(precached).flat();
  expect(Object.keys(precached).some((name) => name.startsWith('workbox-precache'))).toBe(true);
  expect(allCached).toContain('/index.html');
  expect(allCached.some((p) => p.endsWith('.js'))).toBe(true);
  expect(allCached.some((p) => p.endsWith('.css'))).toBe(true);
  expect(allCached).toContain('/manifest.webmanifest');

  // Kill the network at the browser level and reload: only the service worker
  // can answer now.
  await context.setOffline(true);
  const response = await page.reload();
  expect(page.url()).toContain('4173');

  await expect(page.getByRole('heading', { name: 'HRM Fallen Tree Reporter' })).toBeVisible();
  await expect(page.getByTestId('report-form')).toBeVisible();
  await expect(page.getByTestId('nav-history')).toBeVisible();
  expect(response?.status()).toBe(200);

  await context.setOffline(false);
});
