import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// Initialize the shell application
const mount = () => {
  const container = document.getElementById('root');
  const root = createRoot(container);
  
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
};

// Handle mounting for local development and production
if (process.env.NODE_ENV === 'development') {
  const devRoot = document.getElementById('root');
  if (devRoot) {
    mount();
  }
}

export { mount };