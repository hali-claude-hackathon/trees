/**
 * Geolocation helpers.
 *
 * Why structured metadata instead of reading EXIF out of the photo: browsers
 * generally strip embedded EXIF GPS tags from images produced by a camera
 * capture (`<input capture>`), and on desktop the user may attach any file at
 * all, so an EXIF GPS tag is neither reliably present nor trustworthy. The
 * practical approach for a web PoC is to take a fix from the Geolocation API at
 * the moment the photo is attached (and again at submit) and store it as
 * structured metadata attached to the photo record. No EXIF parsing is done.
 */

/** @typedef {{lat:number,lng:number,accuracy:number,timestamp:string,source:string}} GeoFix */

export const GEO_ERROR = {
  UNSUPPORTED: 'unsupported',
  PERMISSION_DENIED: 'permission-denied',
  UNAVAILABLE: 'unavailable',
  TIMEOUT: 'timeout',
};

export class GeoError extends Error {
  constructor(kind, message) {
    super(message);
    this.name = 'GeoError';
    this.kind = kind;
  }
}

const MESSAGES = {
  [GEO_ERROR.UNSUPPORTED]:
    'This browser does not support location services, so the report cannot be geotagged.',
  [GEO_ERROR.PERMISSION_DENIED]:
    'Location permission was denied. HRM needs GPS coordinates to find the tree, so the report cannot be submitted without it. Allow location for this site, then retry.',
  [GEO_ERROR.UNAVAILABLE]:
    'Your device could not determine a position right now. Move somewhere with a clearer view of the sky and retry.',
  [GEO_ERROR.TIMEOUT]: 'Timed out waiting for a GPS fix. Please retry.',
};

export function geoErrorMessage(error) {
  return MESSAGES[error?.kind] ?? MESSAGES[GEO_ERROR.UNAVAILABLE];
}

/**
 * Take a single GPS fix.
 *
 * @param {string} source label recorded with the fix ('photo-capture' | 'submit' | 'manual')
 * @returns {Promise<GeoFix>}
 * @throws {GeoError}
 */
export function captureFix(source = 'manual') {
  if (!('geolocation' in navigator)) {
    return Promise.reject(new GeoError(GEO_ERROR.UNSUPPORTED, MESSAGES[GEO_ERROR.UNSUPPORTED]));
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          // Timestamp of the fix itself, not of the form submission.
          timestamp: new Date(position.timestamp).toISOString(),
          source,
        });
      },
      (err) => {
        let kind = GEO_ERROR.UNAVAILABLE;
        if (err.code === 1) kind = GEO_ERROR.PERMISSION_DENIED;
        else if (err.code === 3) kind = GEO_ERROR.TIMEOUT;
        reject(new GeoError(kind, MESSAGES[kind]));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

export function formatFix(fix) {
  if (!fix) return 'No location';
  return `${fix.lat.toFixed(5)}, ${fix.lng.toFixed(5)} (±${Math.round(fix.accuracy)} m)`;
}
