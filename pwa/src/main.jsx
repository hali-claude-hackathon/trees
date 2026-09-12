import React from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.jsx';
import './styles.css';

// Keep the precached app shell fresh without prompting; there is no server-side
// state to reconcile, so taking the newest build on the next load is safe.
registerSW({ immediate: true });

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
