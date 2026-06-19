import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { setAuthToken } from './lib/api'

// Extract token synchronously before rendering to ensure API calls have it
const params = new URLSearchParams(window.location.search);
const urlToken = params.get('token');
if (urlToken) {
  setAuthToken(urlToken);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
