/**
 * Create Challenge View Entry Point
 * Entry point for expanded create challenge view
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from '../App';
import '../base.css';

// Set initial view before app renders
window.__DEVVIT_INITIAL_VIEW__ = 'create';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
