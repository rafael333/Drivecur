import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { FileList } from './components/FileList';
import { FileDetails } from './components/FileDetails';
import { FileViewer } from './components/FileViewer';
import { SiteLogin } from './components/SiteLogin';
import { GoogleLogin } from './components/GoogleLogin';
import { DownloadProgress } from './components/DownloadProgress';
import { FileItem } from './types';
import { useDownloads } from './hooks/useDownloads';
import { getAccessToken, getUserInfo, clearAuth, saveAuth, getAuthFromFirestore, validateToken, isTokenExpired, attemptSilentLogin } from './lib/googleAuth';
import { exchangeCodeForTokens, refreshAccessToken } from './lib/googleAuthBackend';
import { getCurrentSiteUser, onAuthStateChange, SiteUser } from './lib/siteAuth';
import { signOut } from 'firebase/auth';
import { auth } from './lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { db } from './lib/firebase';

function App() {
  console.log('[App] Componente App iniciado');
  
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Gerenciamento de downloads
  const {
    downloads,
    addDownload,
    updateProgress,
    completeDownload,
    errorDownload,
    removeDownload,
  } = useDownloads();
  
  // Gerencia abertura/fechamento do FileDetails baseado na seleção
  useEffect(() => {
    if (selectedFile && !viewerOpen) {
      // Em mobile, abre FileDetails quando seleciona arquivo
      // Em desktop, mantém o estado atual (não força abertura)
      if (window.innerWidth < 1024) {
        setDetailsOpen(true);
      }
    } else if (!selectedFile) {
      setDetailsOpen(false);
    }
  }, [selectedFile, viewerOpen]);
  
  // Autenticação em duas etapas
  const [isSiteAuthenticated, setIsSiteAuthenticated] = useState(false);
  const [isGoogleAuthenticated, setIsGoogleAuthenticated] = useState(false);
  const [siteUser, setSiteUser] = useState<SiteUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [googleUserInfo, setGoogleUserInfo] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'my-drive' | 'shared-with-me' | 'shared-drives' | 'recent' | 'starred' | 'trash'>('my-drive');
  
  // Estados para verificar inicialização
  const [authInitialized, setAuthInitialized] = useState(false);
  const [googleAuthLoading, setGoogleAuthLoading] = useState(false); // Não inicia em loading

  // Observa mudanças no estado de autenticação do Firebase
  // E verifica se já existe um usuário logado (persistência)
  useEffect(() => {
    // Verifica se já existe um usuário logado imediatamente
    // Isso verifica o estado persistido do Firebase sem esperar o callback
    const checkAuth = () => {
      const currentUser = getCurrentSiteUser();
      if (currentUser) {
        console.log('[App] Usuário já logado encontrado (persistência):', currentUser.email);
        setIsSiteAuthenticated(true);
        setSiteUser(currentUser);
        setAuthInitialized(true);
        return true;
      }
      return false;
    };

    // Verifica imediatamente
    const hasUser = checkAuth();
    
    // Se não encontrou, configura listener (pode levar um pouco mais)
    // Mas marca como inicializado após um pequeno delay para evitar flash
    if (!hasUser) {
      // Observa mudanças no estado de autenticação
      const unsubscribe = onAuthStateChange((user) => {
      if (user) {
          console.log('[App] Usuário autenticado:', user.email);
        setIsSiteAuthenticated(true);
        setSiteUser(user);
      } else {
          console.log('[App] Usuário deslogado');
        setIsSiteAuthenticated(false);
        setSiteUser(null);
      }
        // Marca como inicializado quando o estado mudar
        setAuthInitialized(true);
      });

      // Se após 100ms ainda não tiver usuário, marca como inicializado mesmo assim
      // Isso evita ficar preso no loading se realmente não houver usuário
      const timeoutId = setTimeout(() => {
        if (!getCurrentSiteUser()) {
          setAuthInitialized(true);
        }
      }, 100);

      return () => {
        unsubscribe();
        clearTimeout(timeoutId);
      };
    }

    return undefined;
  }, []);

  // Verifica autenticação do Google Drive (após login no site)
  useEffect(() => {
    if (!isSiteAuthenticated || !siteUser) {
      setGoogleAuthLoading(false);
      return;
    }

    // Função para verificar e carregar tokens
    const loadGoogleAuth = async () => {
      // Primeiro, verifica se há código ou token na URL (callback do OAuth)
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const searchParams = new URLSearchParams(window.location.search);
      const urlCode = searchParams.get('code'); // Código OAuth (novo fluxo)
      const urlToken = params.get('access_token'); // Token direto (fluxo antigo - fallback)
      const urlError = params.get('error') || searchParams.get('error');
      const urlState = searchParams.get('state'); // State para identificar se é para adicionar conta
      
      // IMPORTANTE: Limpa a URL imediatamente para evitar loops
      const hasOAuthParams = urlCode || urlToken || urlError;
      if (hasOAuthParams) {
        // Remove os parâmetros da URL imediatamente após detectá-los
        window.history.replaceState({}, document.title, window.location.pathname);
      }
      
      // Só mostra loading se for callback OAuth
      if (urlCode || urlToken) {
        setGoogleAuthLoading(true);
      }

      // Trata erros do OAuth
      if (urlError) {
        // Decodifica o erro para exibir mensagem mais clara
        let errorMessage = urlError;
        let redirectUriUsed = window.location.origin;
        
        // Tenta decodificar o erro da URL
        try {
          const errorParam = searchParams.get('error');
          if (errorParam) {
            errorMessage = decodeURIComponent(errorParam);
          }
          
          // Verifica se é redirect_uri_mismatch
          if (errorMessage.includes('redirect_uri_mismatch') || urlError.includes('redirect_uri_mismatch')) {
            const currentOrigin = window.location.origin;
            console.error('═══════════════════════════════════════════════════════════');
            console.error('❌ ERRO: redirect_uri_mismatch');
            console.error('═══════════════════════════════════════════════════════════');
            console.error('📍 O redirect_uri usado foi:', currentOrigin);
            console.error('🌐 URL completa:', window.location.href);
            console.error('📡 Protocolo:', window.location.protocol);
            console.error('🏠 Hostname:', window.location.hostname);
            console.error('🚪 Porta:', window.location.port || '(padrão)');
            console.error('═══════════════════════════════════════════════════════════');
            console.error('');
            console.error('⚠️ ⚠️ ⚠️  SOLUÇÃO ⚠️ ⚠️ ⚠️');
            console.error('📋 Adicione esta URL EXATA no Google Cloud Console:');
            console.error('📋', currentOrigin);
            console.error('');
            console.error('Como fazer:');
            console.error('1. Vá em https://console.cloud.google.com/');
            console.error('2. APIs e Serviços > Credenciais');
            console.error('3. Clique no seu OAuth Client ID');
            console.error('4. Em "URIs de redirecionamento autorizados"');
            console.error('5. Adicione EXATAMENTE:', currentOrigin);
            console.error('6. Salve e aguarde alguns segundos');
            console.error('7. Tente novamente');
            console.error('═══════════════════════════════════════════════════════════');
            
            alert(
              `❌ Erro: redirect_uri_mismatch\n\n` +
              `O redirect_uri usado foi:\n` +
              `📍 ${currentOrigin}\n\n` +
              `📋 SOLUÇÃO:\n\n` +
              `1. Vá no Google Cloud Console\n` +
              `2. APIs e Serviços > Credenciais\n` +
              `3. Clique no seu OAuth Client ID\n` +
              `4. Em "URIs de redirecionamento autorizados"\n` +
              `5. Adicione EXATAMENTE: ${currentOrigin}\n` +
              `6. Salve e aguarde alguns segundos\n` +
              `7. Tente novamente\n\n` +
              `💡 Veja o console (F12) para mais detalhes.`
            );
          } else {
            console.error('[Google Auth] Erro OAuth:', errorMessage);
            alert(`❌ Erro ao fazer login: ${errorMessage}\n\nVerifique o console (F12) para mais detalhes.`);
          }
        } catch (e) {
          console.error('[Google Auth] Erro ao processar erro OAuth:', e);
          alert(`❌ Erro ao fazer login no Google Drive.\n\nVerifique o console (F12) para mais detalhes.`);
        }
        
        // Limpa a URL
        window.history.replaceState({}, document.title, window.location.pathname);
        setGoogleAuthLoading(false);
        // Continua o fluxo normalmente, vai mostrar a tela de login do Google
      } else if (urlCode) {
        // NOVO FLUXO: Troca código por tokens (com refresh token)
        window.history.replaceState({}, document.title, window.location.pathname);
        
        try {
          setGoogleAuthLoading(true);
          console.log('[Google Auth] Código OAuth recebido, trocando por tokens...');
          console.log('[Google Auth] Código (primeiros 20 chars):', urlCode.substring(0, 20) + '...');
          console.log('[Google Auth] Redirect URI:', window.location.origin);
          
          // Troca o código por tokens usando o backend
          const tokens = await exchangeCodeForTokens(urlCode, window.location.origin);
          
          if (!tokens) {
            console.error('[Google Auth] ❌ Erro ao trocar código por tokens');
            console.error('[Google Auth] Verifique:');
            console.error('[Google Auth] 1. Backend está rodando? (npm run server)');
            console.error('[Google Auth] 2. Client ID e Secret estão no .env?');
            console.error('[Google Auth] 3. Backend consegue acessar as variáveis de ambiente?');
            alert('❌ Erro ao fazer login no Google Drive!\n\nVerifique:\n1. Backend está rodando? (npm run server)\n2. Console do navegador para mais detalhes');
            setGoogleAuthLoading(false);
            return;
          }
          
          const { accessToken, refreshToken, expiresIn } = tokens;
          
          // Busca informações do usuário usando o token recém-obtido
          let userInfo: { name: string; email: string; picture?: string } | null = null;
          
          try {
            // Aguarda um pouco para garantir que o token está pronto
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            
            if (userResponse.ok) {
              const user = await userResponse.json();
              userInfo = {
                name: user.name || '',
                email: user.email || '',
                picture: user.picture,
              };
              setGoogleUserInfo(user);
              console.log('[Google Auth] ✅ Informações do usuário obtidas:', userInfo.name);
            } else {
              // Se falhar, tenta a API v1
              const userResponseV1 = await fetch('https://www.googleapis.com/oauth2/v1/userinfo', {
                headers: { Authorization: `Bearer ${accessToken}` },
              });
              
              if (userResponseV1.ok) {
                const user = await userResponseV1.json();
                userInfo = {
                  name: user.name || '',
                  email: user.email || '',
                  picture: user.picture,
                };
                setGoogleUserInfo(user);
                console.log('[Google Auth] ✅ Informações do usuário obtidas via API v1');
              } else {
                // Se ambas falharem, busca via Drive API
                try {
                  const driveResponse = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
                    headers: { Authorization: `Bearer ${accessToken}` },
                  });
                  
                  if (driveResponse.ok) {
                    const driveData = await driveResponse.json();
                    userInfo = {
                      name: driveData.user?.displayName || 'Usuário Google',
                      email: driveData.user?.emailAddress || 'usuario@google.com',
                      picture: driveData.user?.photoLink,
                    };
                    setGoogleUserInfo(userInfo);
                    console.log('[Google Auth] ✅ Informações do usuário obtidas via Drive API');
                  }
                } catch (driveError) {
                  console.warn('[Google Auth] ⚠️ Não foi possível obter informações do usuário');
                }
              }
            }
          } catch (error) {
            console.error('[Google Auth] Erro ao buscar informações do usuário:', error);
          }
          
          if (!userInfo) {
            userInfo = {
              name: 'Usuário Google',
              email: 'usuario@google.com',
            };
            console.warn('[Google Auth] ⚠️ Usando informações padrão do usuário');
          }
          
          // Verifica se é para adicionar uma nova conta (múltiplas contas)
          const isAddingAccount = urlState === 'add_account';
          
          if (isAddingAccount) {
            // IMPORTANTE: Ao adicionar nova conta, verifica se já existe uma conta padrão
            // Se existir, mantém ela e adiciona a nova na subcoleção
            // Se não existir, salva como conta padrão E na subcoleção
            const { saveMultipleAccounts } = await import('./lib/googleAuth');
            const { getAuthFromFirestore } = await import('./lib/googleAuth');
            
            // Verifica se já existe uma conta padrão
            const existingAuth = await getAuthFromFirestore(siteUser.uid);
            
            if (existingAuth.token && existingAuth.user) {
              // Já existe uma conta padrão - apenas adiciona a nova na subcoleção
              console.log('[Google Auth] Conta padrão já existe, adicionando nova conta na subcoleção...');
              await saveMultipleAccounts(
                accessToken,
                userInfo,
                siteUser.uid,
                refreshToken,
                expiresIn,
                false // Não marca como ativa automaticamente ao adicionar
              );
              console.log('[Google Auth] ✅ Nova conta adicionada com sucesso!');
              
              // IMPORTANTE: Limpa a URL imediatamente para evitar loop
              window.history.replaceState({}, document.title, window.location.pathname);
              
              // Pergunta se o usuário quer usar a nova conta imediatamente
              const useNewAccount = confirm(
                '✅ Conta do Google Drive adicionada com sucesso!\n\n' +
                'Deseja usar esta conta agora?\n\n' +
                '• Sim: Esta conta será ativada agora\n' +
                '• Não: Mantém a conta atual ativa\n\n' +
                'Você pode gerenciar suas contas em "Minhas Contas" no menu do perfil.'
              );
              
              if (useNewAccount) {
                // Ativa a nova conta imediatamente
                const accountId = userInfo.email.replace(/[^a-zA-Z0-9]/g, '_');
                const accountRef = doc(db, 'users', siteUser.uid, 'googleDriveAccounts', accountId);
                
                // Marca a nova conta como ativa
                await setDoc(accountRef, { isActive: true }, { merge: true });
                
                // Atualiza o googleDriveTokens com a nova conta
                await saveAuth(accessToken, userInfo, siteUser.uid, refreshToken, expiresIn);
                
                // Atualiza os estados da aplicação
                setAccessToken(accessToken);
                setIsGoogleAuthenticated(true);
                setGoogleUserInfo(userInfo);
                
                console.log('[Google Auth] ✅ Nova conta ativada e em uso!');
              } else {
                // Mantém a conta padrão ativa, apenas recarrega para limpar URL completamente
                setTimeout(() => {
                  window.location.reload();
                }, 500);
              }
            } else {
              // Não existe conta padrão - salva como conta padrão e na subcoleção
              console.log('[Google Auth] Primeira conta, salvando como conta padrão e na subcoleção...');
              
              // Salva como conta padrão
              await saveAuth(accessToken, userInfo, siteUser.uid, refreshToken, expiresIn);
              
              // Também salva na subcoleção
              await saveMultipleAccounts(
                accessToken,
                userInfo,
                siteUser.uid,
                refreshToken,
                expiresIn,
                true // Marca como ativa já que é a primeira conta
              );
              
              setAccessToken(accessToken);
              setIsGoogleAuthenticated(true);
              setGoogleUserInfo(userInfo);
              
              console.log('[Google Auth] ✅ Primeira conta salva com sucesso!');
            }
          } else {
            // Login normal - verifica se já existe conta padrão
            const { getAuthFromFirestore } = await import('./lib/googleAuth');
            const existingAuth = await getAuthFromFirestore(siteUser.uid);
            
            if (existingAuth.token && existingAuth.user && existingAuth.user.email !== userInfo.email) {
              // Já existe uma conta padrão diferente - adiciona a nova na subcoleção ao invés de substituir
              console.log('[Google Auth] Conta padrão já existe com email diferente, adicionando nova conta na subcoleção...');
              const { saveMultipleAccounts } = await import('./lib/googleAuth');
              await saveMultipleAccounts(
                accessToken,
                userInfo,
                siteUser.uid,
                refreshToken,
                expiresIn,
                false // Não marca como ativa automaticamente
              );
              console.log('[Google Auth] ✅ Nova conta adicionada na subcoleção!');
              alert('✅ Conta do Google Drive adicionada com sucesso!\n\nVocê pode gerenciar suas contas em "Minhas Contas" no menu do perfil.');
              
              // Não altera a conta ativa
              // Não atualiza setAccessToken, setIsGoogleAuthenticated, setGoogleUserInfo
            } else {
              // Não existe conta padrão OU é a mesma conta - salva normalmente (substitui ou cria)
              await saveAuth(accessToken, userInfo, siteUser.uid, refreshToken, expiresIn);
              setAccessToken(accessToken);
              setIsGoogleAuthenticated(true);
              setGoogleUserInfo(userInfo);
            }
          }
          
          console.log('[Google Auth] ✅ Login com refresh token realizado com sucesso!');
          console.log('[Google Auth] Refresh token salvo - token será renovado automaticamente quando expirar!');
        } catch (error) {
          console.error('[Google Auth] Erro no callback OAuth:', error);
        } finally {
          setGoogleAuthLoading(false);
        }
        
        return;
      } else if (urlToken) {
        // Limpa a URL
        window.history.replaceState({}, document.title, window.location.pathname);
        
        setAccessToken(urlToken);
        setIsGoogleAuthenticated(true);
        
        // Busca informações do usuário e salva
        let userInfo: { name: string; email: string; picture?: string } | null = null;
        
        try {
          // Tenta a API v2 primeiro
          let userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: {
              Authorization: `Bearer ${urlToken}`,
            },
          });
          
          if (userResponse.ok) {
            const user = await userResponse.json();
            userInfo = {
              name: user.name || '',
              email: user.email || '',
              picture: user.picture,
            };
            setGoogleUserInfo(user);
          } else {
            // Se falhar, tenta a API v1
            const userResponseV1 = await fetch('https://www.googleapis.com/oauth2/v1/userinfo', {
              headers: {
                Authorization: `Bearer ${urlToken}`,
              },
            });
            
            if (userResponseV1.ok) {
              const user = await userResponseV1.json();
              userInfo = {
                name: user.name || '',
                email: user.email || '',
                picture: user.picture,
              };
              setGoogleUserInfo(user);
            } else {
              // Usa informações padrão
              userInfo = {
                name: 'Usuário Google',
                email: 'usuario@google.com',
              };
            }
          }
        } catch (error: any) {
          // Usa informações padrão em caso de erro
          userInfo = {
            name: 'Usuário Google',
            email: 'usuario@google.com',
          };
        }
        
        // Salva o token independente de ter conseguido as informações do usuário
        try {
            // Extrai expires_in da URL se disponível
            const expiresInParam = params.get('expires_in');
            const expiresIn = expiresInParam ? parseInt(expiresInParam, 10) : 3600; // Padrão 1 hora
            
            if (userInfo) {
              await saveAuth(urlToken, userInfo, siteUser.uid, undefined, expiresIn);
            } else {
              await saveAuth(urlToken, {
                name: 'Usuário Google',
                email: 'usuario@google.com',
              }, siteUser.uid, undefined, expiresIn);
            }
        } catch (saveError: any) {
          // Erro ao salvar - não crítico, continua com o token
        }
        
        setGoogleAuthLoading(false);
        return;
      }

      // PRIORIDADE 1: Busca no localStorage primeiro (mais rápido, sem rede)
      let token: string | null = null;
      let user: { name: string; email: string; picture?: string } | null = null;

      const localToken = getAccessToken();
      const localUser = getUserInfo();

      if (localToken && localUser) {
        // Valida apenas se necessário (usa cache para evitar verificação repetida)
        const isValid = await validateToken(localToken, true);
        
        if (isValid) {
          token = localToken;
          user = localUser;
          
          // Se temos uid, salva no Firestore em background (sem bloquear)
          if (siteUser.uid) {
            saveAuth(localToken, localUser, siteUser.uid).catch(() => {
              // Falha silenciosa - não crítico se não salvar no Firestore
            });
          }
        } else {
          // Token inválido/expirado - tenta renovar usando refresh token
          const localRefreshToken = localStorage.getItem('google_refresh_token');
          
          if (localRefreshToken) {
            console.log('[Google Auth] Token expirado, tentando renovar com refresh token...');
            
            try {
              const refreshed = await refreshAccessToken(localRefreshToken);
              
              if (refreshed && refreshed.accessToken) {
                // Renovação bem-sucedida!
                console.log('[Google Auth] ✅ Token renovado automaticamente!');
                token = refreshed.accessToken;
                user = localUser;
                
                // Salva o novo token
                if (siteUser.uid) {
                  await saveAuth(refreshed.accessToken, localUser, siteUser.uid, localRefreshToken, refreshed.expiresIn);
                }
                
                localStorage.setItem('google_drive_token', refreshed.accessToken);
              } else {
                // Renovação falhou, limpa tokens
                await clearAuth();
              }
            } catch (error) {
              console.error('[Google Auth] Erro ao renovar token:', error);
              await clearAuth();
            }
          } else {
            // Não há refresh token, limpa
            await clearAuth();
          }
        }
      }

      // PRIORIDADE 2: Se não encontrou no localStorage, busca no Firestore
      if (!token || !user) {
        if (siteUser.uid) {
          try {
            const firestoreAuth = await getAuthFromFirestore(siteUser.uid);
          
            if (firestoreAuth.token && firestoreAuth.user) {
              // Valida apenas se necessário (usa cache)
              const isValid = await validateToken(firestoreAuth.token, true);
              
              if (isValid) {
                token = firestoreAuth.token;
                user = firestoreAuth.user;
                // Atualiza o localStorage também para próxima vez
                localStorage.setItem('google_drive_token', token);
                localStorage.setItem('google_user', JSON.stringify(user));
                if (firestoreAuth.refreshToken) {
                  localStorage.setItem('google_refresh_token', firestoreAuth.refreshToken);
                }
              } else {
                // Token inválido/expirado - tenta renovar
                if (firestoreAuth.refreshToken) {
                  console.log('[Google Auth] Token do Firestore expirado, tentando renovar...');
                  
                  try {
                    const refreshed = await refreshAccessToken(firestoreAuth.refreshToken);
                    
                    if (refreshed && refreshed.accessToken) {
                      console.log('[Google Auth] ✅ Token renovado automaticamente!');
                      token = refreshed.accessToken;
                      user = firestoreAuth.user;
                      
                      // Salva o novo token
                      await saveAuth(refreshed.accessToken, firestoreAuth.user, siteUser.uid, firestoreAuth.refreshToken, refreshed.expiresIn);
                      
                      localStorage.setItem('google_drive_token', refreshed.accessToken);
                      localStorage.setItem('google_user', JSON.stringify(firestoreAuth.user));
                      localStorage.setItem('google_refresh_token', firestoreAuth.refreshToken);
                    } else {
                      // Renovação falhou, remove
                      await clearAuth();
                    }
                  } catch (error) {
                    console.error('[Google Auth] Erro ao renovar token:', error);
                    await clearAuth();
                  }
                } else {
                  // Não há refresh token, remove
                  await clearAuth();
                }
              }
            }
          } catch (error) {
            // Erro ao buscar do Firestore - não crítico
          }
        }
      }

      // Se encontrou token válido, usa ele
      if (token && user) {
        setAccessToken(token);
        setIsGoogleAuthenticated(true);
        setGoogleUserInfo(user);
      }
      
      // Marca como finalizado o carregamento do Google Auth
      setGoogleAuthLoading(false);
    };

    // Executa imediatamente (Firebase já está pronto se siteUser existe)
    loadGoogleAuth();
  }, [isSiteAuthenticated, siteUser]);

  const handleSiteLoginSuccess = (user: SiteUser) => {
    setSiteUser(user);
    setIsSiteAuthenticated(true);
  };

  const handleGoogleLoginSuccess = (token: string, user: any) => {
    setAccessToken(token);
    setGoogleUserInfo(user);
    setIsGoogleAuthenticated(true);
  };


  const handleLogout = async () => {
    // Logout completo: limpa site e Google
    try {
      // Logout do Firebase
      await signOut(auth);
    } catch (err) {
      console.error('Erro ao fazer logout do Firebase:', err);
    }
    
    // Logout do Google Drive (remove do localStorage e Firestore)
    await clearAuth();
    setAccessToken(null);
    setGoogleUserInfo(null);
    setSiteUser(null);
    setIsSiteAuthenticated(false);
    setIsGoogleAuthenticated(false);
  };

  // Mostra tela de loading enquanto inicializa o Firebase Auth
  // Isso evita "piscar" a tela de login quando já está logado
  if (!authInitialized) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Carregando...</p>
        </div>
      </div>
    );
  }

  // Etapa 1: Login no site
  if (!isSiteAuthenticated) {
    return <SiteLogin onLoginSuccess={handleSiteLoginSuccess} />;
  }

  // Mostra loading enquanto verifica tokens do Google Drive
  // Isso evita mostrar a tela de GoogleLogin desnecessariamente
  if (googleAuthLoading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Verificando autenticação do Google Drive...</p>
        </div>
      </div>
    );
  }

  // Etapa 2: Login no Google Drive (após login no site)
  if (!isGoogleAuthenticated) {
    return (
      <GoogleLogin 
        onLoginSuccess={handleGoogleLoginSuccess}
        siteUser={siteUser}
        onBackToSite={async () => {
          try {
            await signOut(auth);
          } catch (err) {
            console.error('Erro ao fazer logout do Firebase:', err);
          }
          setIsSiteAuthenticated(false);
          setSiteUser(null);
        }}
      />
    );
  }

  const handleSavedFolderClick = (folderId: string) => {
    // Volta para "Meu Drive" e navega para a pasta salva
    setViewMode('my-drive');
    // Passa o folderId para o FileList navegar diretamente para essa pasta
    // Isso será tratado no FileList
    const event = new CustomEvent('openSavedFolder', { detail: { folderId } });
    window.dispatchEvent(event);
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white flex w-full max-w-full overflow-x-hidden">
      {/* Overlay para mobile quando sidebar está aberta */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      <Sidebar 
        viewMode={viewMode}
        onViewModeChange={(mode) => {
          setViewMode(mode);
          setSelectedFile(null); // Limpa seleção ao mudar de visualização
          setSidebarOpen(false); // Fecha sidebar em mobile ao mudar modo
        }}
        onFolderClick={handleSavedFolderClick}
        accessToken={accessToken || undefined}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        userInfo={googleUserInfo}
        siteUser={siteUser}
        onLogout={handleLogout}
      />

      <div className="flex-1 flex flex-col">
        <Header 
          searchQuery={searchQuery} 
          setSearchQuery={setSearchQuery}
          userInfo={googleUserInfo}
          siteUser={siteUser}
          onLogout={handleLogout}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        />

        <div className="flex-1 flex overflow-hidden relative">
          {accessToken ? (
            <>
              <FileList
                selectedFile={selectedFile}
                setSelectedFile={setSelectedFile}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                accessToken={accessToken}
                viewMode={viewMode}
                onViewFile={(file) => {
                  setSelectedFile(file);
                  setViewerOpen(true);
                }}
                onDownloadStart={addDownload}
                onDownloadProgress={updateProgress}
                onDownloadComplete={completeDownload}
                onDownloadError={errorDownload}
              />

              {/* Overlay para mobile quando FileDetails está aberto */}
              {detailsOpen && selectedFile && !viewerOpen && (
                <>
                  <div 
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setDetailsOpen(false)}
                  />
                  <FileDetails
                    file={selectedFile}
                    onClose={() => setDetailsOpen(false)}
                    onView={() => setViewerOpen(true)}
                    accessToken={accessToken || undefined}
                    onDownloadStart={addDownload}
                    onDownloadProgress={updateProgress}
                    onDownloadComplete={completeDownload}
                    onDownloadError={errorDownload}
                  />
                </>
              )}

              {viewerOpen && selectedFile && accessToken && (
                <FileViewer
                  file={selectedFile}
                  accessToken={accessToken}
                  onClose={() => setViewerOpen(false)}
                />
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-gray-400">Carregando...</div>
            </div>
          )}
        </div>
      </div>
      
      {/* Componente de progresso de downloads */}
      <DownloadProgress downloads={downloads} onClose={removeDownload} />
    </div>
  );
}

export default App;
