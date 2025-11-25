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

    // Отключаем закрытие Telegram Mini App при смахивании вниз
    // Используем нативный API Telegram WebApp (доступен с версии 7.7)
    try {
      if (window.Telegram && window.Telegram.WebApp) {
        const tg = window.Telegram.WebApp
        // Метод отключает вертикальные свайпы, предотвращая закрытие приложения
        if (typeof tg.disableVerticalSwipes === 'function') {
          tg.disableVerticalSwipes()
        }
      }
    } catch (error) {
      console.log('Telegram WebApp API недоступен:', error)
    }

    // Дополнительная защита через CSS и предотвращение touch-событий
    // Предотвращаем pull-to-refresh и закрытие при свайпе вниз
    let touchStartY = 0

    const handleTouchStart = (e) => {
      if (e.touches && e.touches[0]) {
        touchStartY = e.touches[0].clientY
      }
    }

    const handleTouchMove = (e) => {
      if (!e.touches || !e.touches[0]) return
      
      const touchCurrentY = e.touches[0].clientY
      const deltaY = touchCurrentY - touchStartY
      
      // Если свайп вниз в верхней части экрана (в начале страницы) - предотвращаем
      // Это блокирует pull-to-refresh и закрытие mini app
      if (window.scrollY === 0 && deltaY > 0 && deltaY > 30) {
        e.preventDefault()
        e.stopPropagation()
        return false
      }
    }

    // Добавляем обработчики для предотвращения закрытия
    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchmove', handleTouchMove, { passive: false })
    
    // CSS защита на уровне body
    document.body.style.overscrollBehaviorY = 'none'
    
    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
    }
  }, [])

  return (
    <div className="app">
      <Game />
    </div>
  )
}

export default App
