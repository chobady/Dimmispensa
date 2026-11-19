import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/press-start-2p/latin-400.css';
import '@fontsource/jersey-15/latin-400.css';
import './styles.css';
import App from './App.jsx';
import { registerSW } from './lib/push.js';

createRoot(document.getElementById('root')).render(<App />);

// il service worker serve per le notifiche (su iPhone deve esserci già quando l'app è sulla Home)
if (import.meta.env.PROD) registerSW();
