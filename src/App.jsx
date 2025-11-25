import { useEffect } from 'react'
import { WebApp } from '@twa-dev/sdk'
import Game from './components/Game'
import './App.css'

function App() {
  useEffect(() => {
    // Инициализация Telegram Web App
    if (WebApp) {
      WebApp.ready()
      WebApp.expand()
    }
  }, [])

  return (
    <div className="app">
      <Game />
    </div>
  )
}

export default App
