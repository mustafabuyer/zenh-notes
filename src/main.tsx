import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './App.css'
import { useStore } from './store'

// Store'u window objesine ekle (development için)
if (import.meta.env.DEV) {
  (window as any).useStore = useStore;
}

// React.StrictMode geçici olarak kaldırıldı - Excalidraw unmount save sorunu için
ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />
)