import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'material-symbols/outlined.css';
import './tailwind.css';
import './index.css';

// Glowy shell: radial-gradient body background (see tailwind.css .glow-shell)
document.body.classList.add('glow-shell');
import App from './App.jsx';
import SageWindow from './SageWindow.jsx';
import { ThemeProvider } from './contexts/ThemeContext.jsx';

// A window opened with #sage (see electron/main.js createSageWindow) renders
// only the standalone Sage companion instead of the full dashboard.
const isSageWindow = window.location.hash === '#sage';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      {isSageWindow ? <SageWindow /> : <App />}
    </ThemeProvider>
  </StrictMode>
);
