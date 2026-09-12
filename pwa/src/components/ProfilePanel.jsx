import { useState } from 'react';
import { clearProfile, isProfileEmpty, saveProfile } from '../lib/profile.js';

export default function ProfilePanel({ profile, onChange }) {
  const [name, setName] = useState(profile?.name ?? '');
  const [contact, setContact] = useState(profile?.contact ?? '');
  const [address, setAddress] = useState(profile?.address ?? '');
  const [status, setStatus] = useState(null);

  return (
    <section className="card" data-testid="profile-panel">
      <h2>
        Profile <span className="optional">optional</span>
      </h2>
      <p className="hint" data-testid="profile-optional-note">
        You never need a profile to report a tree — everything works anonymously. Fill this in only
        if you want the report form prefilled and your contact details attached so HRM can follow
        up.
      </p>

      <label htmlFor="profile-name">Name</label>
      <input
        id="profile-name"
        data-testid="profile-name"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <label htmlFor="profile-contact">Email or phone</label>
      <input
        id="profile-contact"
        data-testid="profile-contact"
        type="text"
        value={contact}
        onChange={(e) => setContact(e.target.value)}
      />

      <label htmlFor="profile-address">Default address</label>
      <input
        id="profile-address"
        data-testid="profile-address"
        type="text"
        autoComplete="street-address"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
      />

      <div className="row">
        <button
          type="button"
          data-testid="save-profile"
          onClick={() => {
            const saved = saveProfile({ name, contact, address });
            onChange(saved);
            setStatus('Profile saved on this device.');
          }}
        >
          Save profile
        </button>
        <button
          type="button"
          className="danger"
          data-testid="clear-profile"
          onClick={() => {
            clearProfile();
            onChange(null);
            setName('');
            setContact('');
            setAddress('');
            setStatus('Profile cleared. You are reporting anonymously.');
          }}
        >
          Clear profile
        </button>
      </div>

      <p aria-live="polite" className="ok" data-testid="profile-status">
        {status ?? (isProfileEmpty(profile) ? 'No profile saved — reporting anonymously.' : '')}
      </p>
    </section>
  );
}
