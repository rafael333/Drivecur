import { useState, useEffect, useRef } from 'react';
import { Plus, HardDrive, Users, Clock, Star, Trash2, Folder, FolderOpen, X, User, LogOut, Settings, ChevronDown, Palette, Pin } from 'lucide-react';
import { AddFolderModal } from './AddFolderModal';
import { getSavedFolders, SavedFolder, removeSavedFolder, FOLDER_COLOR_OPTIONS, DEFAULT_FOLDER_COLOR, updateSavedFolderColor, getPinnedFolders, PinnedFolder, unpinFolder, setFolderColor, getFavoritedFolders, FavoritedFolder, unfavoriteFolder, updateFavoritedFolderColor } from '../lib/savedFolders';
import { SiteUser } from '../lib/siteAuth';
import { AccountManager } from './AccountManager';

interface SidebarProps {
  viewMode: 'my-drive' | 'shared-with-me' | 'recent' | 'starred' | 'trash';
  onViewModeChange: (mode: 'my-drive' | 'shared-with-me' | 'recent' | 'starred' | 'trash') => void;
  onFolderClick?: (folderId: string) => void;
  accessToken?: string;
  isOpen?: boolean;
  onClose?: () => void;
  userInfo?: {
    name?: string;
    email?: string;
    picture?: string;
  } | null;
  siteUser?: SiteUser | null;
  onLogout?: () => void;
}

export function Sidebar({ viewMode, onViewModeChange, onFolderClick, accessToken, isOpen = false, onClose, userInfo, siteUser, onLogout }: SidebarProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [savedFolders, setSavedFolders] = useState<SavedFolder[]>([]);
  const [pinnedFolders, setPinnedFolders] = useState<PinnedFolder[]>([]);
  const [favoritedFolders, setFavoritedFolders] = useState<FavoritedFolder[]>([]);
  const [showUserSidebar, setShowUserSidebar] = useState(false);
  const [showAccountManager, setShowAccountManager] = useState(false);
  const [activeColorPicker, setActiveColorPicker] = useState<string | null>(null);
  const [folderMenuOpen, setFolderMenuOpen] = useState<string | null>(null);
  const sidebarRef = useRef<HTMLDivElement | null>(null);
  
  // Prioriza informações do Google (mais completas), mas mostra do site como fallback
  const displayName = userInfo?.name || siteUser?.name || (siteUser?.email ? siteUser.email.split('@')[0] : null) || 'Usuário';
  const displayEmail = userInfo?.email || siteUser?.email || '';
  const displayPicture = userInfo?.picture || undefined;

  useEffect(() => {
    // Carrega pastas salvas
    setSavedFolders(getSavedFolders());
    // Carrega pastas fixadas
    setPinnedFolders(getPinnedFolders());
    // Carrega pastas favoritadas
    setFavoritedFolders(getFavoritedFolders());
  }, [showAddModal]);

  // Escuta eventos de mudança de pastas fixadas e favoritadas
  useEffect(() => {
    const handlePinnedFolderChange = () => {
      // Atualiza tanto pastas fixadas quanto salvas para garantir sincronização
      setPinnedFolders(getPinnedFolders());
      setSavedFolders(getSavedFolders());
    };

    const handleFavoriteFolderChange = () => {
      // Atualiza pastas favoritadas
      setFavoritedFolders(getFavoritedFolders());
    };

    window.addEventListener('pinnedFolderChanged', handlePinnedFolderChange);
    window.addEventListener('folderColorChanged', handlePinnedFolderChange);
    window.addEventListener('favoriteFolderChanged', handleFavoriteFolderChange);
    return () => {
      window.removeEventListener('pinnedFolderChanged', handlePinnedFolderChange);
      window.removeEventListener('folderColorChanged', handlePinnedFolderChange);
      window.removeEventListener('favoriteFolderChanged', handleFavoriteFolderChange);
    };
  }, []);

  useEffect(() => {
    if (!activeColorPicker && !folderMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        setActiveColorPicker(null);
        setFolderMenuOpen(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeColorPicker, folderMenuOpen]);

  const menuItems = [
    { icon: HardDrive, label: 'Meu Drive', mode: 'my-drive' as const },
    { icon: Users, label: 'Compartilhados comigo', mode: 'shared-with-me' as const },
    { icon: Clock, label: 'Recentes', mode: 'recent' as const },
    { icon: Star, label: 'Favoritos', mode: 'starred' as const },
    { icon: Trash2, label: 'Lixeira', mode: 'trash' as const },
  ];

  const handleFolderAdded = (folder: SavedFolder) => {
    setSavedFolders(getSavedFolders());
  };

  const isMobile = () => {
    return window.innerWidth < 1024; // lg breakpoint
  };

  const handleFolderClick = (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveColorPicker(null);
    
    // No mobile, abre o menu de opções; no desktop, abre a pasta diretamente
    if (isMobile()) {
      setFolderMenuOpen((prev) => (prev === folderId ? null : folderId));
    } else {
      if (onFolderClick) {
        onFolderClick(folderId);
      }
    }
  };

  const handleOpenFolder = (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFolderMenuOpen(null);
    if (onFolderClick) {
      onFolderClick(folderId);
    }
  };

  const handleRemoveFolder = (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeSavedFolder(folderId);
    setSavedFolders(getSavedFolders());
    setActiveColorPicker(null);
    setFolderMenuOpen(null);
  };

  const handleUnpinFolder = (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    unpinFolder(folderId);
    setPinnedFolders(getPinnedFolders());
    setActiveColorPicker(null);
    setFolderMenuOpen(null);
  };

  const handleUnfavoriteFolder = (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    unfavoriteFolder(folderId);
    setFavoritedFolders(getFavoritedFolders());
    setActiveColorPicker(null);
    setFolderMenuOpen(null);
  };

  const handleColorChange = (folderId: string, color: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Atualiza cor tanto para pastas salvas, fixadas quanto favoritadas
    setFolderColor(folderId, color);
    updateSavedFolderColor(folderId, color);
    updateFavoritedFolderColor(folderId, color);
    setSavedFolders(getSavedFolders());
    setPinnedFolders(getPinnedFolders());
    setFavoritedFolders(getFavoritedFolders());
    setActiveColorPicker(null);
    setFolderMenuOpen(null);
    window.dispatchEvent(new CustomEvent('folderColorChanged', { detail: { folderId, color } }));
  };

  const handleOpenColorPicker = (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFolderMenuOpen(null);
    setActiveColorPicker((prev) => (prev === folderId ? null : folderId));
  };

  return (
    <div
      ref={sidebarRef}
      className={`
      fixed lg:static inset-y-0 left-0 z-50
      w-64 bg-[#1a1a1a] border-r border-gray-800 
      flex flex-col transform transition-transform duration-300 ease-in-out
      ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
    `}
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-6 lg:justify-start lg:gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 via-green-500 to-yellow-500 rounded-lg flex items-center justify-center">
              <HardDrive className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-semibold">Google Drive</span>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-2 hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="Fechar menu"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg flex items-center gap-3 font-medium transition-colors"
        >
          <Plus className="w-5 h-5" />
          Novo
        </button>
      </div>

      <nav className="flex-1 px-3 space-y-1 flex flex-col overflow-hidden min-h-0">
        <div className="flex-1 overflow-y-auto space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.label}
              onClick={() => onViewModeChange(item.mode)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                viewMode === item.mode
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </button>
          ))}

          <div className="pt-6 pb-2 px-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Pastas</h3>
          </div>

          {(() => {
            // Combina pastas salvas e fixadas, evitando duplicatas
            const savedIds = new Set(savedFolders.map(f => f.id));
            const allFolders: Array<SavedFolder | PinnedFolder & { isPinned?: boolean }> = [
              ...savedFolders,
              ...pinnedFolders.filter(pf => !savedIds.has(pf.id)).map(pf => ({ ...pf, isPinned: true }))
            ];

            if (allFolders.length === 0) {
              return (
                <div className="px-4 py-3 text-center">
                  <p className="text-xs text-gray-500">
                    Nenhuma pasta adicionada.<br />
                    Clique em "Novo" para adicionar uma.
                  </p>
                </div>
              );
            }

            return allFolders.map((folder) => {
              const isPinnedOnly = 'isPinned' in folder && folder.isPinned;
              const folderId = folder.id;
              const folderName = folder.name;
              const folderColor = 'color' in folder ? (folder.color || DEFAULT_FOLDER_COLOR) : (isPinnedOnly ? (folder.color || DEFAULT_FOLDER_COLOR) : DEFAULT_FOLDER_COLOR);

              return (
                <div
                  key={folderId}
                  className="group relative flex items-center gap-2 px-4 py-2.5 rounded-lg text-gray-400 hover:bg-gray-800/50 hover:text-white transition-colors"
                >
                  <button
                    onClick={(e) => handleFolderClick(folderId, e)}
                    className="flex-1 flex items-center gap-3 text-left"
                  >
                    <div
                      className="w-8 h-8 rounded-lg border border-gray-800/60 flex items-center justify-center bg-[#0f0f0f]"
                      style={{ boxShadow: `0 0 0 1px ${folderColor}33` }}
                    >
                      <Folder className="w-4 h-4 flex-shrink-0" style={{ color: folderColor }} />
                    </div>
                    <span className="font-medium truncate flex items-center gap-2">
                      {folderName}
                      {isPinnedOnly && (
                        <Pin className="w-3 h-3 text-blue-400 flex-shrink-0" title="Fixada" />
                      )}
                    </span>
                  </button>
                  
                  {/* Botões de ação - apenas visíveis no desktop com hover */}
                  <button
                    onClick={(e) => handleOpenColorPicker(folderId, e)}
                    className="opacity-0 group-hover:opacity-100 lg:block hidden p-1 hover:bg-gray-800/70 rounded transition-all"
                    title="Alterar cor"
                  >
                    <Palette className="w-4 h-4" style={{ color: folderColor }} />
                  </button>
                  {isPinnedOnly ? (
                    <button
                      onClick={(e) => handleUnpinFolder(folderId, e)}
                      className="opacity-0 group-hover:opacity-100 lg:block hidden p-1 hover:bg-red-600/20 rounded transition-all"
                      title="Desfixar pasta"
                    >
                      <Pin className="w-4 h-4 text-blue-400 hover:text-red-400" />
                    </button>
                  ) : (
                    <button
                      onClick={(e) => handleRemoveFolder(folderId, e)}
                      className="opacity-0 group-hover:opacity-100 lg:block hidden p-1 hover:bg-red-600/20 rounded transition-all"
                      title="Remover pasta"
                    >
                      <X className="w-4 h-4 text-gray-400 hover:text-red-400" />
                    </button>
                  )}

                  {/* Menu mobile - aparece quando folderMenuOpen === folderId */}
                  {folderMenuOpen === folderId && (
                    <>
                      <div 
                        className="fixed inset-0 bg-black/50 z-[60] lg:hidden"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFolderMenuOpen(null);
                        }}
                      />
                      <div
                        className="absolute right-0 top-full mt-1 bg-[#1f1f1f] border border-gray-800 rounded-lg shadow-xl z-[61] lg:hidden min-w-[200px]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="p-2">
                          <button
                            onClick={(e) => handleOpenFolder(folderId, e)}
                            className="w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-gray-800 active:bg-gray-700 rounded-lg transition-colors flex items-center gap-3 touch-manipulation"
                          >
                            <FolderOpen className="w-5 h-5 text-gray-400" />
                            <span>Abrir pasta</span>
                          </button>
                          <button
                            onClick={(e) => handleOpenColorPicker(folderId, e)}
                            className="w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-gray-800 active:bg-gray-700 rounded-lg transition-colors flex items-center gap-3 touch-manipulation"
                          >
                            <Palette className="w-5 h-5" style={{ color: folderColor }} />
                            <span>Mudar cor</span>
                          </button>
                          {isPinnedOnly ? (
                            <button
                              onClick={(e) => handleUnpinFolder(folderId, e)}
                              className="w-full px-4 py-3 text-left text-sm text-red-400 hover:bg-red-500/10 active:bg-red-500/20 rounded-lg transition-colors flex items-center gap-3 touch-manipulation"
                            >
                              <Pin className="w-5 h-5 text-red-400" />
                              <span>Desfixar pasta</span>
                            </button>
                          ) : (
                            <button
                              onClick={(e) => handleRemoveFolder(folderId, e)}
                              className="w-full px-4 py-3 text-left text-sm text-red-400 hover:bg-red-500/10 active:bg-red-500/20 rounded-lg transition-colors flex items-center gap-3 touch-manipulation"
                            >
                              <X className="w-5 h-5 text-red-400" />
                              <span>Remover pasta</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Seletor de cores - aparece quando activeColorPicker === folderId */}
                  {activeColorPicker === folderId && (
                    <div
                      className="absolute right-4 top-full mt-2 bg-[#1f1f1f] border border-gray-800 rounded-lg shadow-xl p-3 z-50"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <p className="text-xs text-gray-400 mb-2">Escolha uma cor</p>
                      <div className="grid grid-cols-5 gap-2">
                        {FOLDER_COLOR_OPTIONS.map((color) => (
                          <button
                            key={color}
                            onClick={(e) => handleColorChange(folderId, color, e)}
                            className={`w-8 h-8 rounded-lg border-2 transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#1f1f1f] focus:ring-blue-500 ${
                              folderColor === color ? 'border-white' : 'border-transparent'
                            }`}
                            style={{ backgroundColor: color }}
                            title={`Usar cor ${color}`}
                            type="button"
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </div>

        {/* Avatar do usuário - Mobile: aparece no final do nav */}
        <div className="flex-shrink-0 pt-4 pb-4 border-t border-gray-800 lg:hidden">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowUserSidebar(!showUserSidebar);
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-gray-400 hover:bg-gray-800/50 hover:text-white lg:hidden"
            aria-label="Menu do usuário"
          >
            {displayPicture ? (
              <img
                src={displayPicture}
                alt={displayName}
                className="w-8 h-8 rounded-full flex-shrink-0"
                style={{ display: 'inline-block' }}
              />
            ) : (
              <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-medium text-gray-300">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <span className="font-medium flex-1 text-left truncate">{displayName}</span>
            <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${showUserSidebar ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </nav>

      {accessToken && (
        <AddFolderModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onFolderAdded={handleFolderAdded}
          accessToken={accessToken}
        />
      )}

      {/* Menu lateral do usuário - Mobile */}
      {showUserSidebar && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 z-[70] lg:hidden"
            onClick={(e) => {
              e.stopPropagation();
              setShowUserSidebar(false);
            }}
            style={{ cursor: 'pointer' }}
          />
          <div 
            className={`
              fixed inset-y-0 right-0 z-[71] lg:hidden
              w-full sm:w-80 bg-[#1a1a1a] border-l border-gray-800
              flex flex-col transform transition-transform duration-300 ease-in-out
              ${showUserSidebar ? 'translate-x-0' : 'translate-x-full'}
            `}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sm:p-6 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Conta</h2>
              <button
                onClick={() => setShowUserSidebar(false)}
                className="p-2 hover:bg-gray-800 active:bg-gray-700 rounded-lg transition-colors touch-manipulation"
                aria-label="Fechar menu"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Informações do usuário */}
              <div className="p-4 sm:p-6 border-b border-gray-800">
                <div className="flex items-center gap-4">
                  {displayPicture ? (
                    <img
                      src={displayPicture}
                      alt={displayName}
                      className="w-16 h-16 rounded-full"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center">
                      <span className="text-2xl font-medium text-gray-300">
                        {displayName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-white truncate">{displayName}</h3>
                    {displayEmail && (
                      <p className="text-sm text-gray-400 truncate mt-1">{displayEmail}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Menu de opções */}
              <div className="py-2">
                <button
                  onClick={() => {
                    setShowUserSidebar(false);
                    setShowAccountManager(true);
                  }}
                  className="w-full px-4 sm:px-6 py-3 text-left text-sm text-gray-300 hover:bg-gray-800 active:bg-gray-700 transition-colors flex items-center gap-3 touch-manipulation"
                >
                  <User className="w-5 h-5 text-gray-400" />
                  <span>Minhas Contas</span>
                </button>

                <button
                  onClick={() => {
                    // TODO: Implementar tela de configurações
                    setShowUserSidebar(false);
                  }}
                  className="w-full px-4 sm:px-6 py-3 text-left text-sm text-gray-300 hover:bg-gray-800 active:bg-gray-700 transition-colors flex items-center gap-3 touch-manipulation"
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
                    className="w-full px-4 sm:px-6 py-3 text-left text-sm text-red-400 hover:bg-red-500/10 active:bg-red-500/20 transition-colors flex items-center gap-3 touch-manipulation mt-2 border-t border-gray-800"
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
    </div>
  );
}
