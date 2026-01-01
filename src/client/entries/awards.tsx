/**
 * Awards View Entry Point
 * Entry point for expanded awards view
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from '../App';
import { ToastProvider } from '../components/shared/Toast';
import '../base.css';

// Set initial view before app renders
window.__DEVVIT_INITIAL_VIEW__ = 'awards';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </React.StrictMode>
);
