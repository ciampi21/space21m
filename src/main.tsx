import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './lib/i18n'
import { initAcquisitionTracking } from './lib/acquisitionTracking'

// Initialize acquisition tracking on app start
initAcquisitionTracking().catch(error => {
  console.warn('Failed to initialize acquisition tracking:', error);
});

createRoot(document.getElementById("root")!).render(<App />);
