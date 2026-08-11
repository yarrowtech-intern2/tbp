import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeProvider'
import { NotificationCenterProvider } from './context/NotificationCenter'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <NotificationCenterProvider>
          <App />
        </NotificationCenterProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
)
