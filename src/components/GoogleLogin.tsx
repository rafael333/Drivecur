import { useState } from 'react';
import { LogIn, AlertCircle, ArrowLeft } from 'lucide-react';
import { SiteUser } from '../lib/siteAuth';

interface GoogleLoginProps {
  onLoginSuccess: (token: string, userInfo: any) => void;
  siteUser?: SiteUser | null;
  onBackToSite?: () => void;
}

export function GoogleLogin({ onLoginSuccess, siteUser, onBackToSite }: GoogleLoginProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Verifica se a variável de ambiente está configurada
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  // Debug: log no console (remover em produção)
  if (typeof window !== 'undefined') {
    console.log('Client ID configurado:', clientId ? 'Sim' : 'Não');
  }

  if (!clientId || clientId === 'cole_seu_client_id_aqui') {
    return (
      <div className="min-h-screen bg-[#0f0f0f] text-white flex items-center justify-center p-8">
        <div className="max-w-md w-full bg-[#1a1a1a] rounded-xl p-8 border border-gray-800">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold mb-4 text-center">Configuração Necessária</h2>
          <p className="text-gray-400 mb-4">
            Para usar o Google Drive, você precisa configurar a variável de ambiente:
          </p>
          <div className="bg-[#0f0f0f] p-4 rounded border border-gray-700 mb-4">
            <code className="text-sm text-green-400">VITE_GOOGLE_CLIENT_ID</code>
          </div>
          <p className="text-sm text-gray-500">
            Crie um arquivo <code className="text-gray-400">.env</code> na raiz do projeto e adicione sua chave do Google OAuth.
          </p>
          {onBackToSite && (
            <button
              onClick={onBackToSite}
              className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </button>
          )}
        </div>
      </div>
    );
  }

  const handleLogin = () => {
    setLoading(true);
    setError(null);

    const redirectUri = window.location.origin;
    const scope = 'https://www.googleapis.com/auth/drive.readonly';
    // Usa 'code' para obter refresh token (permite renovação automática)
    // 'offline' garante que recebemos refresh token
    const responseType = 'code';
    const accessType = 'offline'; // Obrigatório para receber refresh token
    const prompt = 'consent'; // Garante que sempre pede consentimento e retorna refresh token
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=${responseType}&scope=${encodeURIComponent(scope)}&access_type=${accessType}&prompt=${prompt}`;

    // Redireciona para a página de autenticação do Google
    window.location.href = authUrl;
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white flex items-center justify-center p-8">
      <div className="max-w-md w-full">
        <div className="bg-[#1a1a1a] rounded-xl p-8 border border-gray-800">
          {siteUser && (
            <div className="mb-6 pb-6 border-b border-gray-800">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-white">
                    {(siteUser.name || siteUser.email?.split('@')[0] || 'U').charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">
                    {siteUser.name || siteUser.email}
                  </p>
                  <p className="text-xs text-gray-400">Logado no site</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col items-center mb-6">
            <LogIn className="w-12 h-12 text-blue-500 mb-4" />
            <h1 className="text-2xl font-semibold mb-2">Conecte-se ao Google Drive</h1>
            <p className="text-gray-400 text-center text-sm">
              {siteUser 
                ? `Olá, ${siteUser.name || siteUser.email?.split('@')[0]}! Agora conecte sua conta Google Drive para acessar seus arquivos.`
                : 'Faça login com sua conta Google para acessar seus arquivos'
              }
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded text-red-400 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-white text-gray-900 rounded-lg px-6 py-3 font-medium hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 mb-4"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
                Conectando...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Entrar com Google
              </>
            )}
          </button>

          {onBackToSite && (
            <button
              onClick={onBackToSite}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-800 transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar e trocar de conta
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
