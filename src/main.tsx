import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element not found')
}

createRoot(rootElement).render(<App />)

const shouldRegisterServiceWorker = (() => {
  if (!('serviceWorker' in navigator)) {
    return false
  }

  if (import.meta.env.PROD) {
    return true
  }

  const { hostname, protocol } = window.location

  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1'
  const isSecure = window.isSecureContext || protocol === 'https:'

  return isLocalhost || isSecure
})()

if (shouldRegisterServiceWorker) {
  const registerServiceWorker = async () => {
    try {
      const existingRegistration = await navigator.serviceWorker.getRegistration('/')
      const registration =
        existingRegistration ??
        (await navigator.serviceWorker.register('/sw.js', { scope: '/' }))

      try {
        await registration.update()
      } catch (updateError) {
        if (import.meta.env.DEV) {
          console.warn('Service worker update check failed', updateError)
        }
      }
    } catch (error) {
      console.error('Service worker registration failed', error)
    }
  }

  void registerServiceWorker()
}
