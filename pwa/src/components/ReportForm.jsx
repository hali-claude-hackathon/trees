import { useEffect, useRef, useState } from 'react';
import { addReport } from '../lib/db.js';
import { captureFix, formatFix, geoErrorMessage } from '../lib/geo.js';
import { isProfileEmpty } from '../lib/profile.js';

const SEVERITIES = [
  ['low', 'Low — tree is down but clear of paths and roads'],
  ['medium', 'Medium — partly blocking a sidewalk or driveway'],
  ['high', 'High — blocking a road or leaning on a structure'],
  ['emergency', 'Emergency — on power lines or a vehicle'],
];

export default function ReportForm({ profile, onSubmitted }) {
  const [address, setAddress] = useState(profile?.address ?? '');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState('medium');
  const [notes, setNotes] = useState('');

  const [photo, setPhoto] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(null);

  const [fix, setFix] = useState(null);
  const [geoError, setGeoError] = useState(null);
  const [geoBusy, setGeoBusy] = useState(false);

  const [errors, setErrors] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);

  const fileRef = useRef(null);

  // The profile is optional; when one exists we prefill the address so a repeat
  // reporter does not retype it. An empty profile leaves the form untouched.
  useEffect(() => {
    if (profile?.address) setAddress((current) => current || profile.address);
  }, [profile]);

  // Object URLs are revoked explicitly when the preview is replaced or cleared
  // rather than from an effect cleanup: under StrictMode an effect cleanup fires
  // immediately after mount, which would revoke a URL still on screen.

  async function takeFix(source) {
    setGeoBusy(true);
    try {
      const next = await captureFix(source);
      setFix(next);
      setGeoError(null);
      return next;
    } catch (err) {
      setFix(null);
      setGeoError(err);
      return null;
    } finally {
      setGeoBusy(false);
    }
  }

  function onPhotoChange(event) {
    const file = event.target.files?.[0] ?? null;
    setSuccess(null);
    setPhoto(file);
    setPhotoUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return file ? URL.createObjectURL(file) : null;
    });
    if (file) {
      // Take the geotag as the photo is attached. Browsers strip embedded EXIF
      // GPS from camera captures for privacy (and a desktop user can attach any
      // file), so a Geolocation API fix recorded alongside the photo is the
      // practical way to know where the tree is. No EXIF parsing is attempted.
      takeFix('photo-capture');
    }
  }

  function clearPhoto() {
    setPhoto(null);
    setPhotoUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return null;
    });
    if (fileRef.current) fileRef.current.value = '';
  }

  async function onSubmit(event) {
    event.preventDefault();
    setSuccess(null);
    const found = [];

    if (!photo) {
      found.push({
        field: 'photo',
        message:
          'A photo is required. HRM crews triage fallen trees from the photo, so a report cannot be submitted without one.',
      });
    }
    if (!description.trim()) {
      found.push({ field: 'description', message: 'Please describe what you are reporting.' });
    }

    // Refresh the fix at submit time so the stored coordinates are current. If
    // the refresh fails but the photo-capture fix is still held, that earlier
    // fix is used; if there is no fix at all, the report is blocked.
    let currentFix = fix;
    const refreshed = await takeFix('submit');
    if (refreshed) currentFix = refreshed;
    else if (currentFix) setGeoError(null);

    if (!currentFix) {
      found.push({
        field: 'geo',
        message: 'A GPS location is required before this report can be submitted.',
      });
    }

    setErrors(found);
    if (found.length > 0) return;

    setSubmitting(true);
    try {
      const record = await addReport({
        address: address.trim(),
        description: description.trim(),
        severity,
        notes: notes.trim(),
        photo,
        photoName: photo.name,
        photoType: photo.type || 'image/jpeg',
        photoSize: photo.size,
        // Structured geotag metadata attached to the photo record.
        geo: currentFix,
        reporter: isProfileEmpty(profile)
          ? null
          : { name: profile.name, contact: profile.contact, address: profile.address },
      });
      setSuccess(record);
      setDescription('');
      setNotes('');
      setSeverity('medium');
      setAddress(profile?.address ?? '');
      clearPhoto();
      setFix(null);
      if (onSubmitted) await onSubmitted(record);
    } catch (err) {
      setErrors([{ field: 'save', message: `Could not save the report: ${err.message}` }]);
    } finally {
      setSubmitting(false);
    }
  }

  const errorFor = (field) => errors.find((e) => e.field === field);

  return (
    <form className="card" data-testid="report-form" onSubmit={onSubmit} noValidate>
      <h2>Report a fallen tree</h2>

      {isProfileEmpty(profile) ? (
        <p className="hint" data-testid="anonymous-hint">
          Reporting anonymously. A profile is optional — you can add one under Profile to prefill
          this form next time.
        </p>
      ) : (
        <p className="hint" data-testid="profile-hint">
          Reporting as <strong>{profile.name || 'unnamed reporter'}</strong>
          {profile.contact ? ` (${profile.contact})` : ''}.
        </p>
      )}

      <fieldset>
        <legend>Where is it?</legend>
        <label htmlFor="address">Street address or nearest intersection</label>
        <input
          id="address"
          data-testid="address"
          type="text"
          autoComplete="street-address"
          placeholder="e.g. 1749 Argyle St, Halifax"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
        <button
          type="button"
          className="secondary"
          data-testid="use-location"
          disabled={geoBusy}
          onClick={async () => {
            const next = await takeFix('manual');
            if (next && !address.trim()) setAddress(formatFix(next));
          }}
        >
          {geoBusy ? 'Locating…' : 'Use my current location'}
        </button>
        <p className="hint">
          An address is helpful but optional; the GPS fix below is what is required.
        </p>
      </fieldset>

      <fieldset>
        <legend>
          Photo <span className="required">required</span>
        </legend>
        <input
          ref={fileRef}
          id="photo"
          data-testid="photo-input"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onPhotoChange}
        />
        {photoUrl ? (
          <div className="preview">
            <img data-testid="photo-preview" src={photoUrl} alt="Preview of the attached photo" />
            <button type="button" className="secondary" data-testid="remove-photo" onClick={clearPhoto}>
              Remove photo
            </button>
          </div>
        ) : (
          <p className="hint" data-testid="photo-empty-hint">
            No photo attached yet. On a phone this opens the camera.
          </p>
        )}
        {errorFor('photo') ? (
          <p className="error" data-testid="error-photo" role="alert">
            {errorFor('photo').message}
          </p>
        ) : null}
      </fieldset>

      <fieldset>
        <legend>
          GPS geotag <span className="required">required</span>
        </legend>
        <p className="hint">
          Coordinates are read from this device&rsquo;s location services and stored with the photo.
        </p>
        {fix ? (
          <p className="ok" data-testid="geo-ok">
            Geotagged: <span data-testid="geo-coords">{formatFix(fix)}</span>
            <br />
            <small>Fix taken {new Date(fix.timestamp).toLocaleString()}</small>
          </p>
        ) : (
          <p className="hint" data-testid="geo-pending">
            {geoBusy ? 'Getting a GPS fix…' : 'No GPS fix yet.'}
          </p>
        )}
        {geoError ? (
          <div className="error" data-testid="geo-error" role="alert">
            <strong>Location unavailable.</strong> {geoErrorMessage(geoError)}
          </div>
        ) : null}
        {errorFor('geo') ? (
          <p className="error" data-testid="error-geo" role="alert">
            {errorFor('geo').message}
          </p>
        ) : null}
        <button
          type="button"
          className="secondary"
          data-testid="retry-location"
          disabled={geoBusy}
          onClick={() => takeFix('manual')}
        >
          {geoBusy ? 'Retrying…' : 'Retry location'}
        </button>
      </fieldset>

      <fieldset>
        <legend>What is the problem?</legend>
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          data-testid="description"
          rows="3"
          placeholder="e.g. Large maple down across the sidewalk after the storm"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        {errorFor('description') ? (
          <p className="error" data-testid="error-description" role="alert">
            {errorFor('description').message}
          </p>
        ) : null}

        <label htmlFor="severity">Severity</label>
        <select
          id="severity"
          data-testid="severity"
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
        >
          {SEVERITIES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <label htmlFor="notes">Notes (optional)</label>
        <textarea
          id="notes"
          data-testid="notes"
          rows="2"
          placeholder="Anything else a crew should know"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </fieldset>

      {errorFor('save') ? (
        <p className="error" data-testid="error-save" role="alert">
          {errorFor('save').message}
        </p>
      ) : null}

      <div aria-live="polite">
        {errors.length > 0 ? (
          <p className="error" data-testid="form-error">
            This report cannot be submitted yet — see the {errors.length} problem
            {errors.length === 1 ? '' : 's'} highlighted above.
          </p>
        ) : null}
        {success ? (
          <p className="ok" data-testid="submit-success">
            Report saved on this device. Reference {success.id.slice(0, 8)}.
          </p>
        ) : null}
      </div>

      <button type="submit" data-testid="submit-report" disabled={submitting}>
        {submitting ? 'Saving…' : 'Submit report'}
      </button>
    </form>
  );
}
