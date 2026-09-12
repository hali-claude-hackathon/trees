import { useEffect, useMemo, useState } from 'react';
import { clearReports } from '../lib/db.js';
import { formatFix } from '../lib/geo.js';

const SEVERITY_LABEL = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  emergency: 'Emergency',
};

/** Object URLs for the stored photo Blobs, rebuilt whenever the list changes. */
function usePhotoUrls(reports) {
  const ids = useMemo(() => reports.map((r) => r.id).join(','), [reports]);
  const [urls, setUrls] = useState({});

  useEffect(() => {
    const next = {};
    for (const report of reports) {
      if (report.photo instanceof Blob) next[report.id] = URL.createObjectURL(report.photo);
    }
    setUrls(next);
    return () => Object.values(next).forEach((url) => URL.revokeObjectURL(url));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);

  return urls;
}

export default function HistoryView({ reports, loaded, onChanged }) {
  const [openId, setOpenId] = useState(null);
  const urls = usePhotoUrls(reports);
  const open = reports.find((r) => r.id === openId) ?? null;

  if (!loaded) {
    return (
      <section className="card">
        <p data-testid="history-loading">Loading your reports…</p>
      </section>
    );
  }

  return (
    <section className="card">
      <h2>My reports</h2>
      <p className="hint">
        Stored in this browser&rsquo;s IndexedDB. In a real deployment these would sync to HRM&rsquo;s
        311 system; this proof of concept keeps them local.
      </p>

      {reports.length === 0 ? (
        <p data-testid="history-empty">No reports yet. Submit one from the Report tab.</p>
      ) : (
        <ul className="history" data-testid="history-list">
          {reports.map((report) => (
            <li key={report.id} className="history-item" data-testid="history-item">
              <img
                className="thumb"
                data-testid="history-thumb"
                src={urls[report.id]}
                alt={`Photo for report ${report.id.slice(0, 8)}`}
              />
              <div className="history-body">
                <p className="history-location" data-testid="history-location">
                  {report.address || 'No address given'}
                  <br />
                  <small data-testid="history-coords">{formatFix(report.geo)}</small>
                </p>
                <p className="history-meta">
                  <span className={`pill pill-${report.severity}`}>
                    {SEVERITY_LABEL[report.severity] ?? report.severity}
                  </span>{' '}
                  <time dateTime={report.createdAt} data-testid="history-timestamp">
                    {new Date(report.createdAt).toLocaleString()}
                  </time>
                </p>
                <p className="history-desc">{report.description}</p>
                <button
                  type="button"
                  className="secondary"
                  data-testid="view-report"
                  onClick={() => setOpenId(report.id)}
                >
                  View details
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {open ? (
        <div className="detail" data-testid="report-detail">
          <h3>Report {open.id.slice(0, 8)}</h3>
          <img className="detail-photo" src={urls[open.id]} alt="Reported fallen tree" />
          <dl>
            <dt>Submitted</dt>
            <dd data-testid="detail-created">{new Date(open.createdAt).toLocaleString()}</dd>
            <dt>Address</dt>
            <dd data-testid="detail-address">{open.address || '—'}</dd>
            <dt>GPS fix</dt>
            <dd data-testid="detail-geo">
              {formatFix(open.geo)}
              <br />
              <small>
                taken {new Date(open.geo.timestamp).toLocaleString()} (source: {open.geo.source})
              </small>
            </dd>
            <dt>Severity</dt>
            <dd data-testid="detail-severity">{SEVERITY_LABEL[open.severity] ?? open.severity}</dd>
            <dt>Description</dt>
            <dd data-testid="detail-description">{open.description}</dd>
            <dt>Notes</dt>
            <dd data-testid="detail-notes">{open.notes || '—'}</dd>
            <dt>Reporter</dt>
            <dd data-testid="detail-reporter">
              {open.reporter ? `${open.reporter.name || 'unnamed'} ${open.reporter.contact}` : 'Anonymous'}
            </dd>
          </dl>
          <button type="button" className="secondary" data-testid="close-detail" onClick={() => setOpenId(null)}>
            Close
          </button>
        </div>
      ) : null}

      {reports.length > 0 ? (
        <button
          type="button"
          className="danger"
          data-testid="clear-history"
          onClick={async () => {
            await clearReports();
            setOpenId(null);
            await onChanged();
          }}
        >
          Clear all reports
        </button>
      ) : null}
    </section>
  );
}
