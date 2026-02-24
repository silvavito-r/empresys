import { Component, type ErrorInfo, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { AlertTriangle, RefreshCw, LogOut } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary capturou um erro:', error, info)
  }

  handleReload = () => {
    window.location.reload()
  }

  handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-md border border-red-100 max-w-md w-full p-8 space-y-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="h-7 w-7 text-red-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Algo deu errado</h1>
              <p className="text-sm text-gray-500 mt-1">
                Ocorreu um erro inesperado na aplicação.
              </p>
            </div>
          </div>

          {this.state.error && (
            <details className="rounded-lg bg-gray-50 border text-xs">
              <summary className="px-3 py-2 cursor-pointer text-gray-500 select-none">
                Detalhes do erro
              </summary>
              <pre className="px-3 pb-3 overflow-auto text-red-700 whitespace-pre-wrap break-all">
                {this.state.error.message}
              </pre>
            </details>
          )}

          <div className="flex flex-col gap-3">
            <button
              onClick={this.handleReload}
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Recarregar página
            </button>
            <button
              onClick={this.handleSignOut}
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sair da conta
            </button>
          </div>

          <p className="text-xs text-center text-gray-400">
            Se o problema persistir após recarregar, use "Sair da conta" para redefinir a sessão.
          </p>
        </div>
      </div>
    )
  }
}
