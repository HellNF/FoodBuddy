import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import FocusMiniWidget from './components/FocusMiniWidget';
import WidgetPreviewPage from './pages/WidgetPreviewPage';

const root = document.getElementById('root');
if (!root) throw new Error('No #root element found');

const hash = window.location.hash;
const isMiniFocus = hash === '#mini-focus';
const isWidgetPreview = hash === '#widget-preview';

createRoot(root).render(
  <StrictMode>
    {isMiniFocus ? <FocusMiniWidget /> :
     isWidgetPreview ? <WidgetPreviewPage /> :
     <App />}
  </StrictMode>,
);
