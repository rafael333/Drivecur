import { useState, useEffect, useRef } from 'react';
import { Search, User, LogOut, Menu, ChevronDown, X, Settings } from 'lucide-react';
import { SiteUser } from '../lib/siteAuth';
import { AccountManager } from './AccountManager';

interface HeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  userInfo?: {
    name?: string;
    email?: string;
    picture?: string;
  } | null;
  siteUser?: SiteUser | null;
  onLogout?: () => void;
  onMenuClick?: () => void;
}

export function Header({ searchQuery, setSearchQuery, userInfo, siteUser, onLogout, onMenuClick }: HeaderProps) {
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showUserSidebar, setShowUserSidebar] = useState(false);
  const [showAccountManager, setShowAccountManager] = useState(false);
  const searchModalInputRef = useRef<HTMLInputElement>(null);

  // Prioriza informações do Firebase (siteUser), usa Google como fallback
  const displayName = siteUser?.name || userInfo?.name || (siteUser?.email ? siteUser.email.split('@')[0] : null) || (userInfo?.email ? userInfo.email.split('@')[0] : null) || 'Usuário';
  const displayEmail = siteUser?.email || userInfo?.email || '';
  const displayPicture = siteUser?.photoURL || userInfo?.picture || undefined;

  useEffect(() => {
    if (showSearchModal && searchModalInputRef.current) {
      searchModalInputRef.current.focus();
    }
  }, [showSearchModal]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowSearchModal(false);
        setShowUserSidebar(false);
        setShowAccountManager(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  return (
    <>
      <header className="h-14 sm:h-16 border-b border-app-glassBorder flex items-center px-3 sm:px-6 gap-3 relative z-30 glass-panel shadow-none rounded-none w-full sticky top-0 transition-all duration-300">
        {/* Menu hamburger - Mobile */}
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 hover:bg-app-glassHover active:bg-gray-800 rounded-xl transition-all flex-shrink-0"
            aria-label="Abrir menu"
          >
            <Menu className="w-5 h-5 text-gray-300" />
          </button>
        )}

        {/* Desktop: Campo de pesquisa completo */}
        <div className="hidden sm:block flex-1 min-w-0 max-w-2xl mx-auto transition-all duration-300">
          <div className="relative group">
            <button
              onClick={() => setShowSearchModal(true)}
              className="absolute left-4 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 group-hover:text-app-primary transition-colors z-10"
              aria-label="Expandir pesquisa"
            >
              <Search className="w-5 h-5" />
            </button>
            <input
              type="text"
              placeholder="Pesquisar no Drive"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setShowSearchModal(true)}
              className="w-full bg-app-surface border border-gray-800 rounded-2xl pl-12 pr-4 py-2.5 text-sm text-app-textPrimary focus:outline-none focus:ring-2 focus:ring-app-primary/50 focus:border-app-primary/30 transition-all placeholder-gray-500 shadow-inner"
            />
          </div>
        </div>

        {/* Mobile: Ícone de pesquisa */}
        <button
          onClick={() => setShowSearchModal(true)}
          className="sm:hidden p-2 hover:bg-gray-800 active:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
          aria-label="Pesquisar"
        >
          <Search className="w-5 h-5 text-gray-400" />
        </button>

        {/* Avatar do usuário - Desktop */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowUserSidebar(!showUserSidebar);
          }}
          className="hidden sm:flex items-center gap-2 p-1 hover:bg-gray-800 active:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
          aria-label="Menu do usuário"
        >
          {displayPicture ? (
            <img
              src={displayPicture}
              alt={displayName}
              className="w-10 h-10 rounded-full flex-shrink-0"
            />
          ) : (
            <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-medium text-gray-300">
                {displayName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${showUserSidebar ? 'rotate-180' : ''}`} />
        </button>
      </header>

      {/* Modal de pesquisa expandida */}
      {showSearchModal && (
        <>
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 animate-fade-in"
            onClick={() => setShowSearchModal(false)}
          />
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 sm:pt-24 px-4 pointer-events-none">
            <div
              className="w-full max-w-2xl bg-app-surface/90 backdrop-blur-xl border border-app-glassBorder rounded-3xl shadow-2xl p-4 sm:p-6 animate-slide-up pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-2">
                <Search className="w-6 h-6 text-app-primary flex-shrink-0" />
                <input
                  ref={searchModalInputRef}
                  type="text"
                  placeholder="Pesquisar no Drive..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent text-app-textPrimary text-lg sm:text-xl placeholder-gray-500 focus:outline-none"
                  autoFocus
                />
                <button
                  onClick={() => setShowSearchModal(false)}
                  className="p-2 hover:bg-app-glassHover rounded-full transition-colors bg-gray-800/50"
                  aria-label="Fechar pesquisa"
                >
                  <X className="w-5 h-5 text-gray-300" />
                </button>
              </div>
              {searchQuery && (
                <div className="text-sm text-gray-400 mt-2">
                  Pesquisando por: <span className="text-white font-medium">{searchQuery}</span>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Menu lateral do usuário */}
      {showUserSidebar && (
        <>
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 animate-fade-in"
            onClick={() => setShowUserSidebar(false)}
          />
          <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-80 bg-app-surface/95 backdrop-blur-xl border-l border-app-glassBorder flex flex-col transform transition-transform duration-300 ease-out translate-x-0 shadow-2xl">
            <div className="p-4 sm:p-6 border-b border-app-glassBorder flex items-center justify-between">
              <h2 className="text-lg font-semibold text-app-textPrimary">Sua Conta</h2>
              <button
                onClick={() => setShowUserSidebar(false)}
                className="p-2 hover:bg-app-glassHover rounded-full transition-colors bg-gray-800/30"
                aria-label="Fechar menu"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
              <button
                onClick={() => {
                  setShowUserSidebar(false);
                  setShowAccountManager(true);
                }}
                className="w-full px-4 py-3 text-left text-sm text-app-textPrimary hover:bg-app-glassHover active:scale-[0.98] rounded-2xl transition-all flex items-center gap-3 border border-transparent hover:border-app-glassBorder"
              >
                <div className="w-8 h-8 rounded-full bg-app-primary/10 flex items-center justify-center text-app-primary">
                  <User className="w-4 h-4" />
                </div>
                <span className="font-medium">Minhas Contas</span>
              </button>

              <button
                onClick={() => {
                  setShowUserSidebar(false);
                }}
                className="w-full px-4 py-3 text-left text-sm text-app-textPrimary hover:bg-app-glassHover active:scale-[0.98] rounded-2xl transition-all flex items-center gap-3 border border-transparent hover:border-app-glassBorder"
              >
                <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-gray-300">
                  <Settings className="w-4 h-4" />
                </div>
                <span className="font-medium">Configurações</span>
              </button>

              {onLogout && (
                <div className="pt-4 mt-2 border-t border-app-glassBorder">
                  <button
                    onClick={() => {
                      onLogout();
                      setShowUserSidebar(false);
                    }}
                    className="w-full px-4 py-3 text-left text-sm text-app-danger hover:bg-app-danger/10 active:scale-[0.98] rounded-2xl transition-all flex items-center gap-3"
                  >
                    <div className="w-8 h-8 rounded-full bg-app-danger/10 flex items-center justify-center text-app-danger">
                      <LogOut className="w-4 h-4" />
                    </div>
                    <span className="font-medium">Sair</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Account Manager */}
      {showAccountManager && (
        <AccountManager
          onClose={() => setShowAccountManager(false)}
          onAccountSwitch={(account) => {
            // Aguarda um pouco para garantir que tudo foi salvo antes de recarregar
            setTimeout(() => {
              // Recarrega a página para aplicar a nova conta
              window.location.reload();
            }, 500);
          }}
        />
      )}
    </>
  );
}
