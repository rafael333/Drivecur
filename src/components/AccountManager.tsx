import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Check, Loader2 } from 'lucide-react';
import { auth } from '../lib/firebase';
import { db } from '../lib/firebase';
import { collection, doc, getDocs, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { exchangeCodeForTokens } from '../lib/googleAuthBackend';

interface GoogleDriveAccount {
  id: string;
  email: string;
  name: string;
  picture?: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  savedAt: string;
  isActive?: boolean;
}

interface AccountManagerProps {
  onClose: () => void;
  onAccountSwitch?: (account: GoogleDriveAccount) => void;
}

export function AccountManager({ onClose, onAccountSwitch }: AccountManagerProps) {
  const [accounts, setAccounts] = useState<GoogleDriveAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingAccount, setAddingAccount] = useState(false);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const accountsList: GoogleDriveAccount[] = [];

      // Busca a conta padrão (googleDriveTokens)
      try {
        const defaultAccountRef = doc(db, 'googleDriveTokens', currentUser.uid);
        const defaultAccountDoc = await getDoc(defaultAccountRef);
        if (defaultAccountDoc.exists()) {
          const data = defaultAccountDoc.data();
          accountsList.push({
            id: 'default',
            email: data.userInfo?.email || '',
            name: data.userInfo?.name || '',
            picture: data.userInfo?.picture,
            accessToken: data.accessToken || '',
            refreshToken: data.refreshToken,
            expiresAt: data.expiresAt,
            savedAt: data.savedAt || new Date().toISOString(),
            isActive: true, // Conta padrão sempre aparece como ativa se existe
          });
        }
      } catch (error) {
        console.warn('Erro ao buscar conta padrão:', error);
      }

      // Busca todas as contas do usuário na subcoleção
      try {
        const accountsRef = collection(db, 'users', currentUser.uid, 'googleDriveAccounts');
        const snapshot = await getDocs(accountsRef);
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          accountsList.push({
            id: doc.id,
            email: data.userInfo?.email || '',
            name: data.userInfo?.name || '',
            picture: data.userInfo?.picture,
            accessToken: data.accessToken || '',
            refreshToken: data.refreshToken,
            expiresAt: data.expiresAt,
            savedAt: data.savedAt || new Date().toISOString(),
            isActive: data.isActive || false,
          });
        });
      } catch (error) {
        console.warn('Erro ao buscar contas na subcoleção:', error);
      }

      setAccounts(accountsList);
    } catch (error) {
      console.error('Erro ao carregar contas:', error);
    } finally {
      setLoading(false);
    }
  };

  const addNewAccount = async () => {
    try {
      setAddingAccount(true);
      
      // Determina o redirect_uri corretamente (mesma lógica do googleAuthBackend)
      let redirectUri: string;
      if (import.meta.env.VITE_GOOGLE_REDIRECT_URI) {
        redirectUri = import.meta.env.VITE_GOOGLE_REDIRECT_URI;
        console.log('[AccountManager] ✅ Usando VITE_GOOGLE_REDIRECT_URI da variável de ambiente:', redirectUri);
      } else {
        // Usa o mesmo domínio/protocolo da página atual
        redirectUri = window.location.origin;
        console.log('[AccountManager] ✅ Usando window.location.origin:', redirectUri);
      }
      
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
      const scope = 'https://www.googleapis.com/auth/drive';
      
      // Debug: log detalhado do redirect_uri usado
      console.log('═══════════════════════════════════════════════════════════');
      console.log('🔍 [AccountManager] DEBUG - Adicionando nova conta Google');
      console.log('═══════════════════════════════════════════════════════════');
      console.log('📍 redirect_uri usado:', redirectUri);
      console.log('🌐 window.location.origin:', window.location.origin);
      console.log('🔗 window.location.href:', window.location.href);
      console.log('📡 window.location.protocol:', window.location.protocol);
      console.log('🏠 window.location.hostname:', window.location.hostname);
      console.log('🚪 window.location.port:', window.location.port);
      console.log('🔑 Client ID configurado:', clientId ? 'Sim' : 'Não');
      console.log('═══════════════════════════════════════════════════════════');
      console.log('');
      console.log('⚠️ ⚠️ ⚠️  ATENÇÃO: COPY ESTA URL ⚠️ ⚠️ ⚠️');
      console.log('📋 Adicione esta URL nas URIs de redirecionamento no Google Cloud Console:');
      console.log('📋', redirectUri);
      console.log('⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️');
      console.log('');
      
      // Valida se o redirect_uri está correto
      if (!redirectUri || redirectUri === '') {
        console.error('❌ Erro: redirect_uri está vazio!');
        alert('❌ Erro: redirect_uri não pode ser vazio!\n\nVerifique as configurações.');
        setAddingAccount(false);
        return;
      }
      
      // Verifica se é uma URL válida
      try {
        new URL(redirectUri);
      } catch (e) {
        console.error('❌ Erro: redirect_uri inválido:', redirectUri);
        alert(`❌ Erro: redirect_uri inválido: ${redirectUri}\n\nVerifique as configurações.`);
        setAddingAccount(false);
        return;
      }
      
      if (!clientId) {
        console.error('❌ Erro: VITE_GOOGLE_CLIENT_ID não configurado!');
        alert('❌ Erro: VITE_GOOGLE_CLIENT_ID não está configurado!\n\nConfigure no arquivo .env');
        setAddingAccount(false);
        return;
      }
      
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: scope,
        access_type: 'offline',
        prompt: 'consent',
        state: 'add_account', // Identifica que é para adicionar nova conta
      }).toString()}`;
      
      console.log('🔗 URL de autenticação gerada (ocultando client_id):', authUrl.replace(/client_id=[^&]+/, 'client_id=***'));
      console.log('');
      console.log('⏱️  Redirecionando para Google em 2 segundos...');
      console.log('');
      
      // Mostra alerta com o redirect_uri antes de redirecionar
      const userConfirmed = confirm(
        `⚠️ IMPORTANTE!\n\n` +
        `O redirect_uri que será usado é:\n` +
        `📍 ${redirectUri}\n\n` +
        `📋 ANTES DE CONTINUAR:\n\n` +
        `1. Copy a URL acima (${redirectUri})\n` +
        `2. Vá no Google Cloud Console\n` +
        `3. APIs e Serviços > Credenciais\n` +
        `4. Clique no seu OAuth Client ID\n` +
        `5. Em "URIs de redirecionamento autorizados"\n` +
        `6. Adicione EXATAMENTE: ${redirectUri}\n` +
        `7. Salve e aguarde alguns segundos\n\n` +
        `✅ Já adicionou no Google Cloud Console?\n\n` +
        `Clique OK para continuar ou Cancelar para cancelar.`
      );
      
      if (!userConfirmed) {
        setAddingAccount(false);
        return;
      }
      
      // Aguarda um pouco para garantir que salvou no Google Cloud Console
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      window.location.href = authUrl;
    } catch (error) {
      console.error('❌ Erro ao adicionar conta:', error);
      alert(`❌ Erro ao adicionar conta: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      setAddingAccount(false);
    }
  };

  const removeAccount = async (accountId: string) => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      if (accountId === 'default') {
        // Remove a conta padrão
        const defaultAccountRef = doc(db, 'googleDriveTokens', currentUser.uid);
        await deleteDoc(defaultAccountRef);
      } else {
        // Remove da subcoleção
        const accountRef = doc(db, 'users', currentUser.uid, 'googleDriveAccounts', accountId);
        await deleteDoc(accountRef);
      }
      
      setAccounts(accounts.filter(acc => acc.id !== accountId));
    } catch (error) {
      console.error('Erro ao remover conta:', error);
    }
  };

  const switchAccount = async (account: GoogleDriveAccount) => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      // Desativa todas as contas da subcoleção
      try {
        const accountsRef = collection(db, 'users', currentUser.uid, 'googleDriveAccounts');
        const snapshot = await getDocs(accountsRef);
        
        const updatePromises = snapshot.docs.map(doc => {
          return setDoc(doc.ref, { isActive: false }, { merge: true });
        });

        await Promise.all(updatePromises);
      } catch (error) {
        console.warn('Erro ao desativar contas:', error);
      }

      // Ativa a conta selecionada
      if (account.id === 'default') {
        // A conta padrão já está ativa (está no googleDriveTokens)
        // Não precisa fazer nada
      } else {
        const activeAccountRef = doc(db, 'users', currentUser.uid, 'googleDriveAccounts', account.id);
        await setDoc(activeAccountRef, { isActive: true }, { merge: true });
        
        // Também atualiza o googleDriveTokens para manter compatibilidade
        const defaultAccountRef = doc(db, 'googleDriveTokens', currentUser.uid);
        await setDoc(defaultAccountRef, {
          accessToken: account.accessToken,
          refreshToken: account.refreshToken,
          expiresAt: account.expiresAt,
          userInfo: {
            name: account.name,
            email: account.email,
            picture: account.picture,
          },
          savedAt: new Date().toISOString(),
        });
      }

      // IMPORTANTE: Valida o token antes de trocar de conta
      try {
        const testResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${account.accessToken}` },
        });

        if (!testResponse.ok && testResponse.status === 401) {
          console.warn('[switchAccount] Token da conta está inválido ou expirado');
          
          // Se tiver refresh token, tenta renovar
          if (account.refreshToken) {
            const { refreshAccessToken } = await import('../lib/googleAuthBackend');
            const refreshed = await refreshAccessToken(account.refreshToken);
            
            if (refreshed && refreshed.accessToken) {
              console.log('[switchAccount] ✅ Token renovado automaticamente!');
              // Atualiza o token da conta
              account.accessToken = refreshed.accessToken;
              
              // Atualiza no Firestore
              if (account.id === 'default') {
                const defaultAccountRef = doc(db, 'googleDriveTokens', currentUser.uid);
                await setDoc(defaultAccountRef, {
                  accessToken: refreshed.accessToken,
                  refreshToken: account.refreshToken,
                  expiresAt: Date.now() + (refreshed.expiresIn * 1000),
                  userInfo: {
                    name: account.name,
                    email: account.email,
                    picture: account.picture,
                  },
                  savedAt: new Date().toISOString(),
                }, { merge: true });
              } else {
                const accountRef = doc(db, 'users', currentUser.uid, 'googleDriveAccounts', account.id);
                await setDoc(accountRef, {
                  accessToken: refreshed.accessToken,
                  expiresAt: Date.now() + (refreshed.expiresIn * 1000),
                }, { merge: true });
                
                // Atualiza também o googleDriveTokens
                const defaultAccountRef = doc(db, 'googleDriveTokens', currentUser.uid);
                await setDoc(defaultAccountRef, {
                  accessToken: refreshed.accessToken,
                  refreshToken: account.refreshToken,
                  expiresAt: Date.now() + (refreshed.expiresIn * 1000),
                  userInfo: {
                    name: account.name,
                    email: account.email,
                    picture: account.picture,
                  },
                  savedAt: new Date().toISOString(),
                });
              }
            } else {
              console.error('[switchAccount] ❌ Não foi possível renovar o token');
              alert('❌ Token da conta está inválido e não foi possível renovar. Por favor, faça login novamente com esta conta.');
              return;
            }
          } else {
            console.error('[switchAccount] ❌ Token inválido e não há refresh token');
            alert('❌ Token da conta está inválido. Por favor, faça login novamente com esta conta.');
            return;
          }
        }
      } catch (error) {
        console.error('[switchAccount] Erro ao validar token:', error);
        // Continua mesmo se der erro na validação (pode ser erro de rede)
      }

      // Atualiza localStorage para uso imediato
      localStorage.setItem('google_drive_token', account.accessToken);
      localStorage.setItem('google_user', JSON.stringify({
        name: account.name,
        email: account.email,
        picture: account.picture,
      }));

      if (account.refreshToken) {
        localStorage.setItem('google_refresh_token', account.refreshToken);
      }

      console.log('[switchAccount] ✅ Conta trocada com sucesso! Token e dados atualizados.');

      // Chama callback para atualizar o estado na aplicação
      if (onAccountSwitch) {
        onAccountSwitch(account);
      }

      await loadAccounts();
    } catch (error) {
      console.error('Erro ao trocar conta:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div 
        className="w-full max-w-2xl bg-[#1a1a1a] border border-gray-800 rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-gray-800 flex items-center justify-between flex-shrink-0">
          <h2 className="text-xl font-semibold text-white">Contas do Google Drive</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 active:bg-gray-700 rounded-lg transition-colors touch-manipulation"
            aria-label="Fechar"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
            </div>
          ) : (
            <>
              {/* Botão adicionar conta */}
              <button
                onClick={addNewAccount}
                disabled={addingAccount}
                className="w-full mb-4 p-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 text-white rounded-lg flex items-center justify-center gap-3 font-medium transition-colors touch-manipulation"
              >
                {addingAccount ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Conectando...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5" />
                    <span>Adicionar Conta do Google Drive</span>
                  </>
                )}
              </button>

              {/* Lista de contas */}
              {accounts.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-400 mb-2">Nenhuma conta conectada</p>
                  <p className="text-gray-500 text-sm">Adicione uma conta do Google Drive para começar</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {accounts.map((account) => (
                    <div
                      key={account.id}
                      className={`p-4 border rounded-lg transition-colors ${
                        account.isActive
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-gray-800 bg-[#1f1f1f] hover:bg-[#252525]'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        {account.picture ? (
                          <img
                            src={account.picture}
                            alt={account.name}
                            className="w-10 h-10 rounded-full flex-shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-medium text-gray-300">
                              {account.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-white truncate">{account.name}</p>
                          <p className="text-sm text-gray-400 truncate">{account.email}</p>
                          {account.isActive && (
                            <span className="inline-flex items-center gap-1 text-xs text-blue-400">
                              <Check className="w-3 h-3" />
                              Conta ativa
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {!account.isActive && (
                            <button
                              onClick={() => switchAccount(account)}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors touch-manipulation"
                            >
                              Usar
                            </button>
                          )}
                          {accounts.length > 1 && (
                            <button
                              onClick={() => removeAccount(account.id)}
                              className="p-2 hover:bg-red-500/10 active:bg-red-500/20 rounded-lg transition-colors touch-manipulation"
                              title="Remover conta"
                            >
                              <Trash2 className="w-5 h-5 text-red-400" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

