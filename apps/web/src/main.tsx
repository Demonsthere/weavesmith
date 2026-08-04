import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import './styles/tokens.css';
// Page-level, not chart-level: it hides chrome the chart component does not
// own, so it is loaded once here rather than as a side effect of routing.
import './styles/print.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
