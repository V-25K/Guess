/**
 * Toast Provider Component
 * Global toast notification management with context
 */

import React from 'react';
import { Toast, ToastType } from './Toast';

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

// Lazy initialize context to ensure React is available
let ToastContext: React.Context<ToastContextType | null> | null = null;

function getToastContext() {
  if (!ToastContext) {
    ToastContext = React.createContext<ToastContextType | null>(null);
  }
  return ToastContext;
}

let toastIdCounter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const showToast = React.useCallback((message: string, type: ToastType = 'info') => {
    const id = `toast-${++toastIdCounter}`;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const dismissToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const Context = getToastContext();

  return (
    <Context.Provider value={{ showToast }}>
      <div className="relative w-full h-full">
        {children}
        {toasts.length > 0 && (
          <div className="absolute bottom-20 left-0 right-0 z-50 flex flex-col items-center gap-2 pointer-events-none">
            {toasts.map((toast) => (
              <Toast
                key={toast.id}
                id={toast.id}
                message={toast.message}
                type={toast.type}
                onDismiss={dismissToast}
              />
            ))}
          </div>
        )}
      </div>
    </Context.Provider>
  );
}

export function useToast() {
  const Context = getToastContext();
  const context = React.useContext(Context);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
