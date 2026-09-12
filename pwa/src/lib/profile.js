/**
 * Optional reporter profile, persisted in localStorage.
 *
 * localStorage is fine here (unlike photos): a handful of short strings, and
 * reading it synchronously on first render means the report form can be
 * prefilled without a loading flash. A profile is never required — the report
 * flow works end to end with this returning null.
 */

const KEY = 'hrm-fallen-trees.profile';

/** @typedef {{name:string,contact:string,address:string}} Profile */

/** @returns {Profile|null} */
export function loadProfile() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      name: parsed.name ?? '',
      contact: parsed.contact ?? '',
      address: parsed.address ?? '',
    };
  } catch {
    return null;
  }
}

/** @param {Profile} profile */
export function saveProfile(profile) {
  const clean = {
    name: (profile.name ?? '').trim(),
    contact: (profile.contact ?? '').trim(),
    address: (profile.address ?? '').trim(),
  };
  localStorage.setItem(KEY, JSON.stringify(clean));
  return clean;
}

export function clearProfile() {
  localStorage.removeItem(KEY);
}

export function isProfileEmpty(profile) {
  return !profile || (!profile.name && !profile.contact && !profile.address);
}
