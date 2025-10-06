import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import OmnIA from './OmnIA.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <OmnIA />
  </StrictMode>,
)
