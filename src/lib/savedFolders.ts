export interface SavedFolder {
  id: string;
  name: string;
  link: string;
  addedAt: string;
  color?: string;
}

export const FOLDER_COLOR_OPTIONS = [
  '#FF1744', // Vermelho neon - Vermelho vivo e quente
  '#FFEA00', // Amarelo solar - Amarelo forte e alegre
  '#76FF03', // Verde limão - Verde elétrico e claro
  '#00E5FF', // Ciano - Azul-esverdeado vibrante
  '#304FFE', // Azul royal - Azul puro e intenso
  '#AA00FF', // Roxo violeta - Roxo elétrico
  '#F50057', // Rosa choque - Rosa bem forte
  '#FF6D00', // Laranja vivo - Laranja saturado
  '#1DE9B6', // Turquesa claro - Verde-azulado suave e brilhante
  '#FFC400', // Dourado metálico - Amarelo quente e reluzente
] as const;

export const DEFAULT_FOLDER_COLOR = FOLDER_COLOR_OPTIONS[0];

const STORAGE_KEY = 'google_drive_saved_folders';

export function getSavedFolders(): SavedFolder[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const parsed: SavedFolder[] = stored ? JSON.parse(stored) : [];

    return parsed.map((folder) => ({
      ...folder,
      color: folder.color || DEFAULT_FOLDER_COLOR,
    }));
  } catch {
    return [];
  }
}

export function saveFolder(folder: SavedFolder): void {
  const folders = getSavedFolders();
  // Verifica se já existe (evita duplicatas)
  if (!folders.find(f => f.id === folder.id)) {
    folders.push({
      ...folder,
      color: folder.color || DEFAULT_FOLDER_COLOR,
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(folders));
  }
}

export function removeSavedFolder(folderId: string): void {
  const folders = getSavedFolders();
  const filtered = folders.filter(f => f.id !== folderId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

export function updateSavedFolderColor(folderId: string, color: string): void {
  const folders = getSavedFolders();
  const updated = folders.map((folder) =>
    folder.id === folderId
      ? { ...folder, color }
      : folder
  );

  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

// Extrai o ID da pasta de diferentes formatos de link do Google Drive
export function extractFolderIdFromLink(link: string): string | null {
  try {
    // Formato 1: https://drive.google.com/drive/folders/FOLDER_ID
    let match = link.match(/drive\.google\.com\/drive\/folders\/([a-zA-Z0-9_-]+)/);
    if (match) return match[1];

    // Formato 2: https://drive.google.com/open?id=FOLDER_ID
    match = link.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match) return match[1];

    // Formato 3: Apenas o ID (se o usuário colar só o ID)
    if (/^[a-zA-Z0-9_-]+$/.test(link.trim())) {
      return link.trim();
    }

    return null;
  } catch {
    return null;
  }
}

// Sistema de cores para pastas gerais (não apenas as salvas)
const FOLDER_COLORS_STORAGE_KEY = 'google_drive_folder_colors';

export function getFolderColor(folderId: string): string | null {
  try {
    const stored = localStorage.getItem(FOLDER_COLORS_STORAGE_KEY);
    if (!stored) return null;
    const colors: Record<string, string> = JSON.parse(stored);
    return colors[folderId] || null;
  } catch {
    return null;
  }
}

export function setFolderColor(folderId: string, color: string): void {
  try {
    const stored = localStorage.getItem(FOLDER_COLORS_STORAGE_KEY);
    const colors: Record<string, string> = stored ? JSON.parse(stored) : {};
    colors[folderId] = color;
    localStorage.setItem(FOLDER_COLORS_STORAGE_KEY, JSON.stringify(colors));
  } catch {
    // Ignora erros
  }
}

export function removeFolderColor(folderId: string): void {
  try {
    const stored = localStorage.getItem(FOLDER_COLORS_STORAGE_KEY);
    if (!stored) return;
    const colors: Record<string, string> = JSON.parse(stored);
    delete colors[folderId];
    localStorage.setItem(FOLDER_COLORS_STORAGE_KEY, JSON.stringify(colors));
  } catch {
    // Ignora erros
  }
}

export function getAllFolderColors(): Record<string, string> {
  try {
    const stored = localStorage.getItem(FOLDER_COLORS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

// Sistema de pastas fixadas
export interface PinnedFolder {
  id: string;
  name: string;
  pinnedAt: string;
  color?: string;
}

const PINNED_FOLDERS_STORAGE_KEY = 'google_drive_pinned_folders';

export function getPinnedFolders(): PinnedFolder[] {
  try {
    const stored = localStorage.getItem(PINNED_FOLDERS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function isFolderPinned(folderId: string): boolean {
  const pinned = getPinnedFolders();
  return pinned.some(f => f.id === folderId);
}

export function pinFolder(folderId: string, folderName?: string): void {
  const pinned = getPinnedFolders();
  if (!pinned.find(f => f.id === folderId)) {
    pinned.push({
      id: folderId,
      name: folderName || `Pasta ${folderId.substring(0, 8)}...`,
      pinnedAt: new Date().toISOString(),
      color: getFolderColor(folderId) || undefined,
    });
    localStorage.setItem(PINNED_FOLDERS_STORAGE_KEY, JSON.stringify(pinned));
  }
}

export function unpinFolder(folderId: string): void {
  const pinned = getPinnedFolders();
  const filtered = pinned.filter(f => f.id !== folderId);
  localStorage.setItem(PINNED_FOLDERS_STORAGE_KEY, JSON.stringify(filtered));
}

export function updatePinnedFolderName(folderId: string, name: string): void {
  const pinned = getPinnedFolders();
  const updated = pinned.map(f => 
    f.id === folderId ? { ...f, name } : f
  );
  localStorage.setItem(PINNED_FOLDERS_STORAGE_KEY, JSON.stringify(updated));
}

export function togglePinFolder(folderId: string, folderName?: string): boolean {
  const isPinned = isFolderPinned(folderId);
  if (isPinned) {
    unpinFolder(folderId);
    return false;
  } else {
    pinFolder(folderId, folderName);
    return true;
  }
}

// Sistema de pastas favoritas (separado do starred do Google Drive)
const FAVORITE_FOLDERS_STORAGE_KEY = 'google_drive_favorite_folders';
const FAVORITED_FOLDERS_STORAGE_KEY = 'google_drive_favorited_folders_list';

export interface FavoritedFolder {
  id: string;
  name: string;
  favoritedAt: string;
  color?: string;
}

export function getFavoriteFolders(): Set<string> {
  try {
    const stored = localStorage.getItem(FAVORITE_FOLDERS_STORAGE_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

export function getFavoritedFolders(): FavoritedFolder[] {
  try {
    const stored = localStorage.getItem(FAVORITED_FOLDERS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function isFolderFavorite(folderId: string): boolean {
  return getFavoriteFolders().has(folderId);
}

export function favoriteFolder(folderId: string, folderName?: string): void {
  const favorites = getFavoriteFolders();
  favorites.add(folderId);
  localStorage.setItem(FAVORITE_FOLDERS_STORAGE_KEY, JSON.stringify(Array.from(favorites)));
  
  // Também adiciona aos favoritos com metadados
  const favoritedFolders = getFavoritedFolders();
  if (!favoritedFolders.find(f => f.id === folderId)) {
    favoritedFolders.push({
      id: folderId,
      name: folderName || `Pasta ${folderId.substring(0, 8)}...`,
      favoritedAt: new Date().toISOString(),
      color: getFolderColor(folderId) || undefined,
    });
    localStorage.setItem(FAVORITED_FOLDERS_STORAGE_KEY, JSON.stringify(favoritedFolders));
  }
}

export function unfavoriteFolder(folderId: string): void {
  const favorites = getFavoriteFolders();
  favorites.delete(folderId);
  localStorage.setItem(FAVORITE_FOLDERS_STORAGE_KEY, JSON.stringify(Array.from(favorites)));
  
  // Remove dos favoritos com metadados
  const favoritedFolders = getFavoritedFolders();
  const filtered = favoritedFolders.filter(f => f.id !== folderId);
  localStorage.setItem(FAVORITED_FOLDERS_STORAGE_KEY, JSON.stringify(filtered));
}

export function updateFavoritedFolderName(folderId: string, name: string): void {
  const favoritedFolders = getFavoritedFolders();
  const updated = favoritedFolders.map(f => 
    f.id === folderId ? { ...f, name } : f
  );
  localStorage.setItem(FAVORITED_FOLDERS_STORAGE_KEY, JSON.stringify(updated));
}

export function updateFavoritedFolderColor(folderId: string, color: string): void {
  const favoritedFolders = getFavoritedFolders();
  const updated = favoritedFolders.map(f => 
    f.id === folderId ? { ...f, color } : f
  );
  localStorage.setItem(FAVORITED_FOLDERS_STORAGE_KEY, JSON.stringify(updated));
}

export function toggleFavoriteFolder(folderId: string, folderName?: string): boolean {
  const isFavorite = isFolderFavorite(folderId);
  if (isFavorite) {
    unfavoriteFolder(folderId);
    return false;
  } else {
    favoriteFolder(folderId, folderName);
    return true;
  }
}

// ========== Sistema para ARQUIVOS (não apenas pastas) ==========

// Sistema de cores de texto para arquivos
const FILE_TEXT_COLORS_STORAGE_KEY = 'google_drive_file_text_colors';

export function getFileTextColor(fileId: string): string | null {
  try {
    const stored = localStorage.getItem(FILE_TEXT_COLORS_STORAGE_KEY);
    if (!stored) return null;
    const colors: Record<string, string> = JSON.parse(stored);
    return colors[fileId] || null;
  } catch {
    return null;
  }
}

export function setFileTextColor(fileId: string, color: string): void {
  try {
    const stored = localStorage.getItem(FILE_TEXT_COLORS_STORAGE_KEY);
    const colors: Record<string, string> = stored ? JSON.parse(stored) : {};
    colors[fileId] = color;
    localStorage.setItem(FILE_TEXT_COLORS_STORAGE_KEY, JSON.stringify(colors));
  } catch {
    // Ignora erros
  }
}

export function removeFileTextColor(fileId: string): void {
  try {
    const stored = localStorage.getItem(FILE_TEXT_COLORS_STORAGE_KEY);
    if (!stored) return;
    const colors: Record<string, string> = JSON.parse(stored);
    delete colors[fileId];
    localStorage.setItem(FILE_TEXT_COLORS_STORAGE_KEY, JSON.stringify(colors));
  } catch {
    // Ignora erros
  }
}

// Sistema de favoritos para arquivos (separado do starred do Google Drive)
const FAVORITE_FILES_STORAGE_KEY = 'google_drive_favorite_files';

export function getFavoriteFiles(): Set<string> {
  try {
    const stored = localStorage.getItem(FAVORITE_FILES_STORAGE_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

export function isFileFavorite(fileId: string): boolean {
  return getFavoriteFiles().has(fileId);
}

export function favoriteFile(fileId: string): void {
  const favorites = getFavoriteFiles();
  favorites.add(fileId);
  localStorage.setItem(FAVORITE_FILES_STORAGE_KEY, JSON.stringify(Array.from(favorites)));
}

export function unfavoriteFile(fileId: string): void {
  const favorites = getFavoriteFiles();
  favorites.delete(fileId);
  localStorage.setItem(FAVORITE_FILES_STORAGE_KEY, JSON.stringify(Array.from(favorites)));
}

export function toggleFavoriteFile(fileId: string): boolean {
  const isFavorite = isFileFavorite(fileId);
  if (isFavorite) {
    unfavoriteFile(fileId);
    return false;
  } else {
    favoriteFile(fileId);
    return true;
  }
}

// Exporta as opções de cor para usar em arquivos também
export const FILE_COLOR_OPTIONS = FOLDER_COLOR_OPTIONS;

