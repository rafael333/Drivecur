import { useState } from 'react';
import { LogIn, Mail, Lock, User, AlertCircle } from 'lucide-react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { firebaseUserToSiteUser, SiteUser } from '../lib/siteAuth';

interface SiteLoginProps {
  onLoginSuccess: (user: SiteUser) => void;
}

export function SiteLogin({ onLoginSuccess }: SiteLoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Verifica se o Firebase está configurado
  // Aceita valores padrão configurados no firebase.ts se não houver .env
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAhMFwzQIwzvzkQPRfEIsniirMnZhZR9Qk";
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "app--drive.firebaseapp.com";
  
  const isFirebaseConfigured = 
    apiKey &&
    apiKey !== "cole_sua_api_key_aqui" &&
    authDomain &&
    authDomain !== "seu-projeto.firebaseapp.com";

  if (!isFirebaseConfigured) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] text-white flex items-center justify-center p-8">
        <div className="max-w-md w-full bg-[#1a1a1a] rounded-xl p-8 border border-gray-800">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold mb-4 text-center">Firebase não configurado</h2>
          <p className="text-gray-400 mb-4">
            Para usar o login com Firebase, você precisa configurar as variáveis de ambiente:
          </p>
          <div className="bg-[#0f0f0f] p-4 rounded border border-gray-700 mb-4 space-y-2 text-sm">
            <code className="text-green-400 block">VITE_FIREBASE_API_KEY</code>
            <code className="text-green-400 block">VITE_FIREBASE_AUTH_DOMAIN</code>
            <code className="text-green-400 block">VITE_FIREBASE_PROJECT_ID</code>
            <code className="text-green-400 block">VITE_FIREBASE_STORAGE_BUCKET</code>
            <code className="text-green-400 block">VITE_FIREBASE_MESSAGING_SENDER_ID</code>
            <code className="text-green-400 block">VITE_FIREBASE_APP_ID</code>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Crie um arquivo <code className="text-gray-400">.env</code> na raiz do projeto e adicione suas credenciais do Firebase.
          </p>
          <p className="text-sm text-gray-500">
            Obtenha as credenciais no{' '}
            <a 
              href="https://console.firebase.google.com/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline"
            >
              Firebase Console
            </a>
            {' '}em Project Settings &gt; General &gt; Your apps &gt; Web app
          </p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Validação básica
      if (!email.trim()) {
        setError('Por favor, insira um email');
        setLoading(false);
        return;
      }

      if (!password.trim()) {
        setError('Por favor, insira uma senha');
        setLoading(false);
        return;
      }

      if (password.length < 6) {
        setError('A senha deve ter pelo menos 6 caracteres');
        setLoading(false);
        return;
      }

      if (isSignUp && !name.trim()) {
        setError('Por favor, insira um nome');
        setLoading(false);
        return;
      }

      let userCredential;

      if (isSignUp) {
        // Criar nova conta
        userCredential = await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );

        // Atualiza o perfil com o nome
        if (userCredential.user && name.trim()) {
          await updateProfile(userCredential.user, {
            displayName: name.trim(),
          });
        }
      } else {
        // Fazer login
        userCredential = await signInWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );
      }

      // Converte para SiteUser e chama o callback
      const siteUser = firebaseUserToSiteUser(userCredential.user);
      onLoginSuccess(siteUser);
    } catch (err: any) {
      console.error('Erro de autenticação:', err);
      
      // Mensagens de erro amigáveis
      let errorMessage = 'Erro ao fazer login. Tente novamente.';
      
      switch (err.code) {
        case 'auth/email-already-in-use':
          errorMessage = 'Este email já está cadastrado. Faça login ou use outro email.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Email inválido. Verifique e tente novamente.';
          break;
        case 'auth/weak-password':
          errorMessage = 'Senha muito fraca. Use pelo menos 6 caracteres.';
          break;
        case 'auth/user-not-found':
          errorMessage = 'Usuário não encontrado. Verifique o email ou crie uma conta.';
          break;
        case 'auth/wrong-password':
          errorMessage = 'Senha incorreta. Tente novamente.';
          break;
        case 'auth/invalid-credential':
          errorMessage = 'Email ou senha incorretos. Verifique e tente novamente.';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Muitas tentativas. Aguarde um momento e tente novamente.';
          break;
        default:
          errorMessage = err.message || errorMessage;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white flex items-center justify-center p-8">
      <div className="max-w-md w-full">
        <div className="bg-[#1a1a1a] rounded-xl p-8 border border-gray-800">
          <div className="flex flex-col items-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 via-green-500 to-yellow-500 rounded-full flex items-center justify-center mb-4">
              <LogIn className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-semibold mb-2">
              {isSignUp ? 'Criar Conta' : 'Entrar'}
            </h1>
            <p className="text-gray-400 text-center text-sm">
              {isSignUp 
                ? 'Crie sua conta para acessar o gerenciador de arquivos'
                : 'Faça login para acessar o gerenciador de arquivos'
              }
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded text-red-400 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nome
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome"
                    className="w-full bg-[#0f0f0f] border border-gray-800 rounded-lg pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full bg-[#0f0f0f] border border-gray-800 rounded-lg pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#0f0f0f] border border-gray-800 rounded-lg pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-6 py-3 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {isSignUp ? 'Criando conta...' : 'Entrando...'}
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  {isSignUp ? 'Criar Conta' : 'Entrar'}
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
              }}
              className="text-sm text-gray-400 hover:text-gray-300 transition-colors"
            >
              {isSignUp ? (
                <>Já tem uma conta? <span className="text-blue-400">Fazer login</span></>
              ) : (
                <>Não tem uma conta? <span className="text-blue-400">Criar conta</span></>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

