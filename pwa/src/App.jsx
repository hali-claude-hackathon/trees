import { useCallback, useEffect, useState } from 'react';
import ReportForm from './components/ReportForm.jsx';
import HistoryView from './components/HistoryView.jsx';
import ProfilePanel from './components/ProfilePanel.jsx';
import { loadProfile } from './lib/profile.js';
import { listReports } from './lib/db.js';

const TABS = [
  ['report', 'Report a tree'],
  ['history', 'My reports'],
  ['profile', 'Profile'],
];

export default function App() {
  const [tab, setTab] = useState('report');
  const [profile, setProfile] = useState(() => loadProfile());
  const [reports, setReports] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const refreshReports = useCallback(async () => {
    const rows = await listReports();
    setReports(rows);
    setLoaded(true);
  }, []);

  useEffect(() => {
    refreshReports().catch((err) => {
      console.error('Failed to read reports from IndexedDB', err);
      setLoaded(true);
    });
  }, [refreshReports]);

  return (
    <div className="app">
      <header className="app-header">
        <img className="app-logo" src="/icons/icon-192.png" alt="" width="40" height="40" />
        <div>
          <h1>HRM Fallen Tree Reporter</h1>
          <p className="tagline">
            Halifax Regional Municipality &middot; proof of concept &middot; reports stay on this
            device
          </p>
        </div>
      </header>

      <nav className="tabs" aria-label="Sections">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            data-testid={`nav-${id}`}
            className={tab === id ? 'tab tab-active' : 'tab'}
            aria-current={tab === id ? 'page' : undefined}
            onClick={() => setTab(id)}
          >
            {label}
            {id === 'history' && loaded ? (
              <span className="badge" data-testid="history-count">
                {reports.length}
              </span>
            ) : null}
          </button>
        ))}
      </nav>

      {/* Panels stay mounted and are hidden rather than unmounted, so glancing
          at "My reports" mid-report does not discard the photo, the GPS fix and
          everything typed so far. */}
      <main>
        <div hidden={tab !== 'report'}>
          <ReportForm profile={profile} onSubmitted={refreshReports} />
        </div>
        <div hidden={tab !== 'history'}>
          <HistoryView reports={reports} loaded={loaded} onChanged={refreshReports} />
        </div>
        <div hidden={tab !== 'profile'}>
          <ProfilePanel profile={profile} onChange={setProfile} />
        </div>
      </main>

      <footer className="app-footer">
        <p>
          This proof of concept never sends anything to a server. Reports and photos are stored in
          this browser only.
        </p>
      </footer>
    </div>
  );
}
