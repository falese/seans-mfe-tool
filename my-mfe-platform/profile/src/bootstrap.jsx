import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const mount = async (containerId) => {
  const container = document.getElementById(containerId);
  if (!container) return null;

  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  return root;
};

// Mount immediately if we're running in standalone mode (not loaded via Module Federation)
if (!window.__POWERED_BY_FEDERATION__) {
  mount('root');
}

export default App;
export { mount };

/* MFE-GENERATOR:START */ /* MFE-GENERATOR:ID:exports */
// Export components for Module Federation
/* MFE-GENERATOR:END */
