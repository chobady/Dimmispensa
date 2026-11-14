import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/press-start-2p/latin-400.css';
import '@fontsource/pixelify-sans/latin-400.css';
import '@fontsource/pixelify-sans/latin-500.css';
import '@fontsource/pixelify-sans/latin-600.css';
import '@fontsource/pixelify-sans/latin-700.css';
import './styles.css';
import App from './App.jsx';
import { registerSW } from './lib/push.js';

createRoot(document.getElementById('root')).render(<App />);

// il service worker serve per le notifiche (su iPhone deve esserci già quando l'app è sulla Home)
if (import.meta.env.PROD) registerSW();
