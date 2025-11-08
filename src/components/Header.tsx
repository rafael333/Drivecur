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
      <header className="h-14 sm:h-16 border-b border-gray-800 flex items-center px-3 sm:px-6 gap-3 relative z-30 bg-[#0f0f0f]">
        {/* Menu hamburger - Mobile */}
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 hover:bg-gray-800 active:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
            aria-label="Abrir menu"
          >
            <Menu className="w-5 h-5 text-gray-400" />
          </button>
        )}
        
        {/* Desktop: Campo de pesquisa completo */}
        <div className="hidden sm:block flex-1 min-w-0 max-w-2xl">
          <div className="relative">
            <button
              onClick={() => setShowSearchModal(true)}
              className="absolute left-4 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-800 active:bg-gray-700 rounded transition-colors z-10"
              aria-label="Expandir pesquisa"
            >
              <Search className="w-5 h-5 text-gray-500" />
            </button>
            <input
              type="text"
              placeholder="Pesquisar"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setShowSearchModal(true)}
              className="w-full bg-[#1a1a1a] border border-gray-800 rounded-lg pl-12 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent placeholder-gray-500"
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
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            onClick={() => setShowSearchModal(false)}
          />
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 sm:pt-32 px-4">
            <div 
              className="w-full max-w-2xl bg-[#1a1a1a] border border-gray-800 rounded-2xl shadow-2xl p-4 sm:p-6 fade-in"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <Search className="w-6 h-6 text-gray-400 flex-shrink-0" />
                <input
                  ref={searchModalInputRef}
                  type="text"
                  placeholder="Pesquisar no Drive..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent text-white text-lg sm:text-xl placeholder-gray-500 focus:outline-none"
                  autoFocus
                />
                <button
                  onClick={() => setShowSearchModal(false)}
                  className="p-2 hover:bg-gray-800 active:bg-gray-700 rounded-lg transition-colors"
                  aria-label="Fechar pesquisa"
                >
                  <X className="w-5 h-5 text-gray-400" />
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
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowUserSidebar(false)}
          />
          <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-80 bg-[#1a1a1a] border-l border-gray-800 flex flex-col transform transition-transform duration-300 ease-in-out translate-x-0">
            <div className="p-4 sm:p-6 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Conta</h2>
              <button
                onClick={() => setShowUserSidebar(false)}
                className="p-2 hover:bg-gray-800 active:bg-gray-700 rounded-lg transition-colors"
                aria-label="Fechar menu"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Informações do usuário ocultadas */}
              
              <div className="py-2">
                <button
                  onClick={() => {
                    setShowUserSidebar(false);
                    setShowAccountManager(true);
                  }}
                  className="w-full px-4 sm:px-6 py-3 text-left text-sm text-gray-300 hover:bg-gray-800 active:bg-gray-700 transition-colors flex items-center gap-3"
                >
                  <User className="w-5 h-5 text-gray-400" />
                  <span>Minhas Contas</span>
                </button>

                <button
                  onClick={() => {
                    setShowUserSidebar(false);
                  }}
                  className="w-full px-4 sm:px-6 py-3 text-left text-sm text-gray-300 hover:bg-gray-800 active:bg-gray-700 transition-colors flex items-center gap-3"
                >
                  <Settings className="w-5 h-5 text-gray-400" />
                  <span>Configurações</span>
                </button>

                {onLogout && (
                  <button
                    onClick={() => {
                      onLogout();
                      setShowUserSidebar(false);
                    }}
                    className="w-full px-4 sm:px-6 py-3 text-left text-sm text-red-400 hover:bg-red-500/10 active:bg-red-500/20 transition-colors flex items-center gap-3 mt-2 border-t border-gray-800"
                  >
                    <LogOut className="w-5 h-5 text-red-400" />
                    <span>Sair</span>
                  </button>
                )}
              </div>
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
