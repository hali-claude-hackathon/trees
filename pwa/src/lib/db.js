/**
 * Minimal IndexedDB access layer for fallen-tree reports.
 *
 * Photos are stored as Blobs in IndexedDB rather than as base64 strings in
 * localStorage: a single phone photo is commonly 2-5 MB, base64 inflates that
 * by ~33%, and localStorage caps out around 5 MB per origin for the whole
 * store. IndexedDB takes the binary directly and has a far larger quota.
 */

const DB_NAME = 'hrm-fallen-trees';
const DB_VERSION = 1;
const REPORT_STORE = 'reports';

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(REPORT_STORE)) {
        const store = db.createObjectStore(REPORT_STORE, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('IndexedDB upgrade blocked by another tab'));
  });
  return dbPromise;
}

function tx(storeName, mode, run) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, mode);
        const store = transaction.objectStore(storeName);
        let result;
        try {
          result = run(store);
        } catch (err) {
          transaction.abort();
          reject(err);
          return;
        }
        transaction.oncomplete = () => resolve(result && result.__req ? result.__req.result : result);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      })
  );
}

const wrap = (req) => ({ __req: req });

function newId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `r-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * @param {object} report report fields; `photo` must be a Blob and `geo` must
 *   carry lat/lng/accuracy/timestamp.
 * @returns {Promise<object>} the stored record, including its generated id.
 */
export async function addReport(report) {
  const record = {
    ...report,
    id: newId(),
    createdAt: new Date().toISOString(),
  };
  await tx(REPORT_STORE, 'readwrite', (store) => wrap(store.add(record)));
  return record;
}

/** @returns {Promise<object[]>} all reports, newest first. */
export async function listReports() {
  const all = await tx(REPORT_STORE, 'readonly', (store) => wrap(store.getAll()));
  return (all || []).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getReport(id) {
  return tx(REPORT_STORE, 'readonly', (store) => wrap(store.get(id)));
}

export async function clearReports() {
  await tx(REPORT_STORE, 'readwrite', (store) => wrap(store.clear()));
}
