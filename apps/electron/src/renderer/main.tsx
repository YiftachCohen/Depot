import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider as JotaiProvider, useAtomValue } from 'jotai'
import App from './App'
import { ThemeProvider } from './context/ThemeContext'
import { windowWorkspaceIdAtom } from './atoms/sessions'
import { Toaster } from '@/components/ui/sonner'
import './index.css'

if (import.meta.env.DEV) {
  // DEBUG: Test if contextmenu events fire at all in Electron
  document.addEventListener('contextmenu', (e) => {
    console.log('[GLOBAL] contextmenu event fired on', (e.target as HTMLElement)?.tagName, e.clientX, e.clientY)
  })
}

/**
 * Minimal fallback UI shown when the entire React tree crashes.
 */
function CrashFallback() {
  return (
    <div className="flex flex-col items-center justify-center h-screen font-sans text-foreground/50 gap-3">
      <p className="text-base font-medium">Something went wrong</p>
      <p className="text-[13px]">Please restart the app.</p>
      <button
        onClick={() => window.location.reload()}
        className="mt-2 px-4 py-1.5 rounded-md bg-background shadow-minimal text-[13px] text-foreground/70 cursor-pointer"
      >
        Reload
      </button>
    </div>
  )
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback
    }
    return this.props.children
  }
}

/**
 * Root component - loads workspace ID for theme context and renders App
 * App.tsx handles window mode detection internally (main vs tab-content)
 */
function Root() {
  // Shared atom — written by App on init & workspace switch, read here for ThemeProvider
  const workspaceId = useAtomValue(windowWorkspaceIdAtom)

  return (
    <ThemeProvider activeWorkspaceId={workspaceId}>
      <App />
      <Toaster />
    </ThemeProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary fallback={<CrashFallback />}>
      <JotaiProvider>
        <Root />
      </JotaiProvider>
    </ErrorBoundary>
  </React.StrictMode>
)
