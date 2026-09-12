import { expect, test } from '@playwright/test';
import { DEV_URL } from '../playwright.config.js';
import { HALIFAX, photoFixture } from './fixtures.js';

/**
 * Every test gets a fresh browser context, so IndexedDB and localStorage start
 * empty and geolocation permission starts ungranted (i.e. denied) unless the
 * test explicitly grants it.
 */

async function grantLocation(context) {
  await context.grantPermissions(['geolocation'], { origin: DEV_URL });
  await context.setGeolocation(HALIFAX);
}

async function fillBasics(page, { description = 'Large maple down across the sidewalk' } = {}) {
  await page.getByTestId('description').fill(description);
  await page.getByTestId('severity').selectOption('high');
  await page.getByTestId('notes').fill('Blocking the bus stop.');
}

test('blocks submission when no photo is attached and explains why', async ({ page, context }) => {
  await grantLocation(context);
  await page.goto('/');

  await fillBasics(page);
  await page.getByTestId('submit-report').click();

  const photoError = page.getByTestId('error-photo');
  await expect(photoError).toBeVisible();
  await expect(photoError).toContainText('A photo is required');
  await expect(page.getByTestId('form-error')).toBeVisible();
  await expect(page.getByTestId('submit-success')).toHaveCount(0);

  // Nothing was written to IndexedDB.
  await page.getByTestId('nav-history').click();
  await expect(page.getByTestId('history-empty')).toBeVisible();
});

test('submits with a photo and a granted geolocation fix, and the report survives reload', async ({
  page,
  context,
}) => {
  await grantLocation(context);
  await page.goto('/');

  await page.getByTestId('address').fill('1749 Argyle St, Halifax');
  await fillBasics(page);
  await page.getByTestId('photo-input').setInputFiles(photoFixture());

  // Preview thumbnail renders the attached image.
  const preview = page.getByTestId('photo-preview');
  await expect(preview).toBeVisible();
  expect(await preview.evaluate((img) => img.naturalWidth)).toBe(64);

  // The geotag is taken at photo-attach time.
  await expect(page.getByTestId('geo-ok')).toBeVisible();
  await expect(page.getByTestId('geo-coords')).toContainText('44.64880, -63.57520');

  await page.getByTestId('submit-report').click();
  await expect(page.getByTestId('submit-success')).toContainText('Report saved on this device');

  await page.getByTestId('nav-history').click();
  await expect(page.getByTestId('history-item')).toHaveCount(1);
  await expect(page.getByTestId('history-location')).toContainText('1749 Argyle St, Halifax');
  await expect(page.getByTestId('history-coords')).toContainText('44.64880, -63.57520');
  const stamp = page.getByTestId('history-timestamp');
  await expect(stamp).toBeVisible();
  const iso = await stamp.getAttribute('datetime');
  expect(Number.isNaN(Date.parse(iso))).toBe(false);

  // Thumbnail is a live object URL built from the stored Blob.
  const thumb = page.getByTestId('history-thumb');
  await expect(thumb).toBeVisible();
  expect(await thumb.evaluate((img) => img.naturalWidth)).toBe(64);

  // --- Round trip through IndexedDB: reload wipes all React state. ---
  await page.reload();
  await page.getByTestId('nav-history').click();
  await expect(page.getByTestId('history-item')).toHaveCount(1);
  await expect(page.getByTestId('history-coords')).toContainText('44.64880, -63.57520');
  const thumbAfter = page.getByTestId('history-thumb');
  await expect(thumbAfter).toBeVisible();
  expect(await thumbAfter.evaluate((img) => img.naturalWidth)).toBe(64);

  // The photo really is a Blob in IndexedDB, not a data URL in React state.
  const stored = await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('hrm-fallen-trees');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const req = open.result.transaction('reports').objectStore('reports').getAll();
          req.onsuccess = () => {
            const rows = req.result;
            resolve(
              rows.map((r) => ({
                isBlob: r.photo instanceof Blob,
                type: r.photo?.type,
                size: r.photo?.size,
                geo: r.geo,
                severity: r.severity,
                reporter: r.reporter,
              }))
            );
          };
          req.onerror = () => reject(req.error);
        };
      })
  );
  expect(stored).toHaveLength(1);
  expect(stored[0].isBlob).toBe(true);
  expect(stored[0].type).toBe('image/png');
  expect(stored[0].size).toBeGreaterThan(0);
  expect(stored[0].geo.lat).toBeCloseTo(44.6488, 4);
  expect(stored[0].geo.lng).toBeCloseTo(-63.5752, 4);
  expect(stored[0].geo.accuracy).toBeGreaterThan(0);
  expect(Number.isNaN(Date.parse(stored[0].geo.timestamp))).toBe(false);
  expect(stored[0].severity).toBe('high');
  expect(stored[0].reporter).toBeNull();

  // Detail view opens and shows the structured geotag.
  await page.getByTestId('view-report').click();
  await expect(page.getByTestId('report-detail')).toBeVisible();
  await expect(page.getByTestId('detail-geo')).toContainText('44.64880, -63.57520');
  await expect(page.getByTestId('detail-reporter')).toContainText('Anonymous');

  // Clearing history is available for demos.
  await page.getByTestId('close-detail').click();
  await page.getByTestId('clear-history').click();
  await expect(page.getByTestId('history-empty')).toBeVisible();
  await page.reload();
  await page.getByTestId('nav-history').click();
  await expect(page.getByTestId('history-empty')).toBeVisible();
});

test('blocks submission when geolocation is denied, surfaces it, and recovers on retry', async ({
  page,
  context,
}) => {
  // No grantPermissions: Chromium denies the geolocation request.
  await page.goto('/');

  await fillBasics(page);
  await page.getByTestId('photo-input').setInputFiles(photoFixture());

  const geoError = page.getByTestId('geo-error');
  await expect(geoError).toBeVisible();
  await expect(geoError).toContainText('Location permission was denied');
  await expect(page.getByTestId('geo-ok')).toHaveCount(0);

  await page.getByTestId('submit-report').click();
  await expect(page.getByTestId('error-geo')).toContainText('A GPS location is required');
  await expect(page.getByTestId('submit-success')).toHaveCount(0);

  await page.getByTestId('nav-history').click();
  await expect(page.getByTestId('history-empty')).toBeVisible();
  await page.getByTestId('nav-report').click();

  // The denial path is recoverable: grant the permission and use the visible
  // "Retry location" affordance.
  await grantLocation(context);
  await page.getByTestId('retry-location').click();
  await expect(page.getByTestId('geo-ok')).toBeVisible();
  await expect(page.getByTestId('geo-error')).toHaveCount(0);

  await page.getByTestId('submit-report').click();
  await expect(page.getByTestId('submit-success')).toBeVisible();
  await page.getByTestId('nav-history').click();
  await expect(page.getByTestId('history-item')).toHaveCount(1);
});

test('profile is optional, prefills the form on a fresh visit, and can be cleared', async ({
  page,
  context,
}) => {
  await grantLocation(context);
  await page.goto('/');

  // Anonymous by default.
  await expect(page.getByTestId('anonymous-hint')).toBeVisible();
  await expect(page.getByTestId('address')).toHaveValue('');

  await page.getByTestId('nav-profile').click();
  await expect(page.getByTestId('profile-optional-note')).toContainText('never need a profile');
  await page.getByTestId('profile-name').fill('Sam Tester');
  await page.getByTestId('profile-contact').fill('sam@example.com');
  await page.getByTestId('profile-address').fill('5251 Duke St, Halifax');
  await page.getByTestId('save-profile').click();
  await expect(page.getByTestId('profile-status')).toContainText('Profile saved');

  // Fresh visit: the form is prefilled from the stored profile.
  await page.reload();
  await expect(page.getByTestId('profile-hint')).toContainText('Sam Tester');
  await expect(page.getByTestId('address')).toHaveValue('5251 Duke St, Halifax');

  // A report submitted with a profile carries the reporter details.
  await page.getByTestId('description').fill('Spruce down on the verge');
  await page.getByTestId('photo-input').setInputFiles(photoFixture());
  await page.getByTestId('submit-report').click();
  await expect(page.getByTestId('submit-success')).toBeVisible();
  await page.getByTestId('nav-history').click();
  await page.getByTestId('view-report').click();
  await expect(page.getByTestId('detail-reporter')).toContainText('Sam Tester');

  // Clearing the profile returns the app to the anonymous state, across reload.
  await page.getByTestId('nav-profile').click();
  await page.getByTestId('clear-profile').click();
  await expect(page.getByTestId('profile-status')).toContainText('reporting anonymously');
  await page.reload();
  await expect(page.getByTestId('anonymous-hint')).toBeVisible();
  await expect(page.getByTestId('address')).toHaveValue('');
});

test('anonymous user with no profile can complete the whole flow', async ({ page, context }) => {
  await grantLocation(context);
  await page.goto('/');

  const hasProfile = await page.evaluate(() => localStorage.getItem('hrm-fallen-trees.profile'));
  expect(hasProfile).toBeNull();
  await expect(page.getByTestId('anonymous-hint')).toBeVisible();

  await page.getByTestId('description').fill('Tree across Chebucto Rd');
  await page.getByTestId('photo-input').setInputFiles(photoFixture());
  await page.getByTestId('submit-report').click();
  await expect(page.getByTestId('submit-success')).toBeVisible();

  await page.getByTestId('nav-history').click();
  await expect(page.getByTestId('history-item')).toHaveCount(1);
  await page.getByTestId('view-report').click();
  await expect(page.getByTestId('detail-reporter')).toHaveText('Anonymous');
});
