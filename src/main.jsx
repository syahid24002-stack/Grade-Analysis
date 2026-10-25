import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { applyTheme } from './lib/theme';
import { AuthProvider } from './lib/auth';
import { FeedbackProvider } from './lib/feedback';
import App from './App';

applyTheme();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <FeedbackProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </FeedbackProvider>
  </StrictMode>,
);
