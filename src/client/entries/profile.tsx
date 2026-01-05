/**
 * Profile View Entry Point
 * Entry point for expanded profile view
 */

// Import React first to ensure it's available globally
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from '../App';
import { ToastProvider } from '../components/shared/Toast';
import '../base.css';

// Ensure React is available on window for debugging
if (typeof window !== 'undefined') {
  (window as any).React = React;
}

// Set initial view before app renders
window.__DEVVIT_INITIAL_VIEW__ = 'profile';

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
