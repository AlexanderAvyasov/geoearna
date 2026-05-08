import ReactDOM from 'react-dom/client'
import { App } from '@/app/App'
import { initTelegram } from '@lib/telegram'
import '@/styles/global.css'

// Initialize Telegram WebApp
initTelegram()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
