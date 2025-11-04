import { db } from './firebase';
import { doc, setDoc, getDoc, deleteDoc, collection, getDocs, onSnapshot } from 'firebase/firestore';
import { getCurrentSiteUser } from './siteAuth';

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

// Helper para obter o userId do usuário atual
function getUserId(): string | null {
  const user = getCurrentSiteUser();
  return user?.uid || null;
}

// Helper para remover campos undefined (Firebase não aceita undefined)
function removeUndefinedFields(obj: any): any {
  if (obj === null || obj === undefined) {
    return null;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => removeUndefinedFields(item));
  }
  
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = removeUndefinedFields(value);
      }
    }
    return cleaned;
  }
  
  return obj;
}

// Helper para salvar no Firebase (async)
async function saveToFirebase(collectionName: string, docId: string, data: any): Promise<void> {
  const userId = getUserId();
  if (!userId) {
    console.warn(`[Firebase] ⚠️ Usuário não autenticado, salvando apenas no localStorage para ${collectionName}`);
    console.warn(`[Firebase] ⚠️ Para salvar no Firebase, faça login no site primeiro`);
    return;
  }

  try {
    const docRef = doc(db, 'users', userId, collectionName, docId);
    // Remove campos undefined antes de salvar (Firebase não aceita undefined)
    const cleanedData = removeUndefinedFields(data);
    const dataToSave = {
      ...cleanedData,
      updatedAt: new Date().toISOString(),
    };
    await setDoc(docRef, dataToSave, { merge: true });
    // Invalida cache após salvar
    invalidateCache(collectionName);
    console.log(`[Firebase] ✅ ${collectionName}/${docId} salvo no Firebase`);
    console.log(`[Firebase] 📍 Caminho: users/${userId}/${collectionName}/${docId}`);
    console.log(`[Firebase] 📦 Dados salvos:`, dataToSave);
  } catch (error: any) {
    console.error(`[Firebase] ❌ Erro ao salvar ${collectionName}/${docId}:`, error);
    if (error.code === 'permission-denied') {
      console.error(`[Firebase] ❌ Permissão negada! Verifique as regras do Firestore.`);
      console.error(`[Firebase] 📋 Veja: ATUALIZAR_REGRAS_FIRESTORE.md`);
    }
  }
}

// Helper para salvar coleção completa no Firebase
async function saveCollectionToFirebase(collectionName: string, items: any[]): Promise<void> {
  const userId = getUserId();
  if (!userId) {
    console.warn(`[Firebase] Usuário não autenticado, salvando apenas no localStorage para ${collectionName}`);
    return;
  }

  try {
    const batch = items.map(item => {
      const docRef = doc(db, 'users', userId, collectionName, item.id);
      // Remove campos undefined antes de salvar
      const cleanedItem = removeUndefinedFields(item);
      return setDoc(docRef, {
        ...cleanedItem,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    });
    await Promise.all(batch);
    console.log(`[Firebase] ✅ ${items.length} itens de ${collectionName} salvos no Firebase`);
  } catch (error) {
    console.error(`[Firebase] ❌ Erro ao salvar coleção ${collectionName}:`, error);
  }
}

// Cache para evitar múltiplas requisições ao Firebase
const firebaseCache: Record<string, { data: any[]; timestamp: number }> = {};
const CACHE_DURATION = 10000; // 10 segundos de cache

// Fila de requisições pendentes para evitar múltiplas chamadas simultâneas
const pendingRequests: Record<string, Promise<any[]>> = {};

// Helper para buscar do Firebase (com proteção contra requisições simultâneas)
async function getFromFirebase(collectionName: string, useCache: boolean = true): Promise<any[]> {
  const userId = getUserId();
  if (!userId) {
    console.log(`[Firebase] ⚠️ Usuário não autenticado, usando apenas localStorage para ${collectionName}`);
    return [];
  }

  const cacheKey = `${userId}/${collectionName}`;

  // Verifica cache
  if (useCache && firebaseCache[cacheKey]) {
    const cacheAge = Date.now() - firebaseCache[cacheKey].timestamp;
    if (cacheAge < CACHE_DURATION) {
      // Log apenas se cache for muito antigo (para debug)
      if (cacheAge > 1000) {
        console.log(`[Firebase] 📦 Cache usado para ${collectionName} (${Math.round(cacheAge / 1000)}s atrás)`);
      }
      return firebaseCache[cacheKey].data;
    } else {
      // Cache expirado, remove
      delete firebaseCache[cacheKey];
    }
  }

  // Se já existe uma requisição pendente para esta coleção, retorna a mesma Promise
  if (pendingRequests[cacheKey]) {
    // Log apenas em modo debug (não necessário para produção)
    // console.log(`[Firebase] ⏳ Reutilizando requisição pendente para ${collectionName}`);
    return pendingRequests[cacheKey];
  }

  // Cria nova requisição
  const requestPromise = (async () => {
    try {
      const collectionRef = collection(db, 'users', userId, collectionName);
      const snapshot = await getDocs(collectionRef);
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Atualiza cache
      firebaseCache[cacheKey] = {
        data: items,
        timestamp: Date.now(),
      };
      
      console.log(`[Firebase] ✅ ${items.length} itens de ${collectionName} carregados do Firebase`);
      return items;
    } catch (error: any) {
      console.error(`[Firebase] ❌ Erro ao buscar ${collectionName}:`, error);
      if (error.code === 'permission-denied') {
        console.error(`[Firebase] ❌ Permissão negada! Verifique as regras do Firestore.`);
        console.error(`[Firebase] 📋 Veja: ATUALIZAR_REGRAS_FIRESTORE.md`);
      }
      return [];
    } finally {
      // Remove da fila de requisições pendentes
      delete pendingRequests[cacheKey];
    }
  })();

  // Adiciona à fila de requisições pendentes
  pendingRequests[cacheKey] = requestPromise;

  return requestPromise;
}

// Função para invalidar cache (chamar após salvar/deletar)
function invalidateCache(collectionName: string): void {
  const userId = getUserId();
  if (userId) {
    const cacheKey = `${userId}/${collectionName}`;
    delete firebaseCache[cacheKey];
    console.log(`[Firebase] 🔄 Cache invalidado para ${collectionName}`);
  }
}

// Helper para deletar do Firebase
async function deleteFromFirebase(collectionName: string, docId: string): Promise<void> {
  const userId = getUserId();
  if (!userId) {
    console.warn(`[Firebase] ⚠️ Usuário não autenticado, deletando apenas do localStorage para ${collectionName}`);
    return;
  }

  try {
    const docRef = doc(db, 'users', userId, collectionName, docId);
    await deleteDoc(docRef);
    // Invalida cache após deletar
    invalidateCache(collectionName);
    console.log(`[Firebase] ✅ ${collectionName}/${docId} deletado do Firebase`);
    console.log(`[Firebase] 📍 Caminho: users/${userId}/${collectionName}/${docId}`);
  } catch (error: any) {
    console.error(`[Firebase] ❌ Erro ao deletar ${collectionName}/${docId}:`, error);
    if (error.code === 'permission-denied') {
      console.error(`[Firebase] ❌ Permissão negada! Verifique as regras do Firestore.`);
      console.error(`[Firebase] 📋 Veja: ATUALIZAR_REGRAS_FIRESTORE.md`);
    }
  }
}

// Função para sincronizar do Firebase para localStorage
async function syncFromFirebase(collectionName: string, storageKey: string): Promise<void> {
  const firebaseItems = await getFromFirebase(collectionName);
  if (firebaseItems.length > 0) {
    localStorage.setItem(storageKey, JSON.stringify(firebaseItems));
    console.log(`[Sync] ✅ ${collectionName} sincronizado do Firebase para localStorage`);
  }
}

// Função para carregar pastas salvas (com sync do Firebase)
export async function getSavedFolders(forceRefresh: boolean = false): Promise<SavedFolder[]> {
  // Primeiro tenta carregar do Firebase se o usuário estiver logado
  const userId = getUserId();
  if (userId) {
    try {
      const firebaseFolders = await getFromFirebase('savedFolders', !forceRefresh);
      if (firebaseFolders.length > 0 || forceRefresh) {
        // Atualiza localStorage com dados do Firebase
        localStorage.setItem(STORAGE_KEY, JSON.stringify(firebaseFolders));
        return firebaseFolders.map((folder: any) => ({
          ...folder,
          color: folder.color || DEFAULT_FOLDER_COLOR,
        }));
      }
    } catch (error) {
      console.warn('[getSavedFolders] Erro ao buscar do Firebase, usando localStorage:', error);
    }
  }

  // Fallback para localStorage (versão síncrona)
  return getSavedFoldersSync();
}

// Versão síncrona para compatibilidade (usa localStorage)
export function getSavedFoldersSync(): SavedFolder[] {
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

export async function saveFolder(folder: SavedFolder): Promise<void> {
  const folders = await getSavedFolders();
  // Verifica se já existe (evita duplicatas)
  if (!folders.find(f => f.id === folder.id)) {
    const folderToSave = {
      ...folder,
      color: folder.color || DEFAULT_FOLDER_COLOR,
    };
    folders.push(folderToSave);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(folders));
    
    // Salva no Firebase também
    await saveToFirebase('savedFolders', folder.id, folderToSave);
  }
}

export async function removeSavedFolder(folderId: string): Promise<void> {
  const folders = await getSavedFolders();
  const filtered = folders.filter(f => f.id !== folderId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  
  // Remove do Firebase também
  await deleteFromFirebase('savedFolders', folderId);
}

export async function updateSavedFolderColor(folderId: string, color: string): Promise<void> {
  const folders = await getSavedFolders();
  const updated = folders.map((folder) =>
    folder.id === folderId
      ? { ...folder, color }
      : folder
  );

  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  
  // Atualiza no Firebase também
  const folder = updated.find(f => f.id === folderId);
  if (folder) {
    await saveToFirebase('savedFolders', folderId, folder);
  }
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

export async function getPinnedFolders(forceRefresh: boolean = false): Promise<PinnedFolder[]> {
  // Primeiro tenta carregar do Firebase se o usuário estiver logado
  const userId = getUserId();
  if (userId) {
    try {
      const firebasePinned = await getFromFirebase('pinnedFolders', !forceRefresh);
      // Sempre atualiza localStorage com dados do Firebase (mesmo se vazio)
      if (firebasePinned.length > 0 || forceRefresh) {
        localStorage.setItem(PINNED_FOLDERS_STORAGE_KEY, JSON.stringify(firebasePinned));
      }
      return firebasePinned.length > 0 ? firebasePinned : getPinnedFoldersSync();
    } catch (error) {
      console.warn('[getPinnedFolders] Erro ao buscar do Firebase, usando localStorage:', error);
    }
  }

  // Fallback para localStorage
  return getPinnedFoldersSync();
}

export function getPinnedFoldersSync(): PinnedFolder[] {
  try {
    const stored = localStorage.getItem(PINNED_FOLDERS_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    // Garante que é um array válido
    if (Array.isArray(parsed)) {
      return parsed.filter(folder => folder && folder.id && typeof folder.id === 'string');
    }
    return [];
  } catch {
    return [];
  }
}

export async function isFolderPinned(folderId: string): Promise<boolean> {
  const pinned = await getPinnedFolders();
  return pinned.some(f => f.id === folderId);
}

export function isFolderPinnedSync(folderId: string): boolean {
  if (!folderId || typeof folderId !== 'string') return false;
  const pinned = getPinnedFoldersSync();
  return pinned.some(f => f && f.id === folderId);
}

export async function pinFolder(folderId: string, folderName?: string): Promise<void> {
  const pinned = await getPinnedFolders();
  if (!pinned.find(f => f.id === folderId)) {
    const folderColor = getFolderColor(folderId);
    const pinnedFolder: PinnedFolder = {
      id: folderId,
      name: folderName || `Pasta ${folderId.substring(0, 8)}...`,
      pinnedAt: new Date().toISOString(),
      // Só inclui color se existir (não usa undefined)
      ...(folderColor ? { color: folderColor } : {}),
    };
    pinned.push(pinnedFolder);
    localStorage.setItem(PINNED_FOLDERS_STORAGE_KEY, JSON.stringify(pinned));
    
    // Salva no Firebase também (remove undefined automaticamente)
    await saveToFirebase('pinnedFolders', folderId, pinnedFolder);
  }
}

export async function unpinFolder(folderId: string): Promise<void> {
  const pinned = await getPinnedFolders();
  const filtered = pinned.filter(f => f.id !== folderId);
  localStorage.setItem(PINNED_FOLDERS_STORAGE_KEY, JSON.stringify(filtered));
  
  // Remove do Firebase também
  await deleteFromFirebase('pinnedFolders', folderId);
}

export async function updatePinnedFolderName(folderId: string, name: string): Promise<void> {
  const pinned = await getPinnedFolders();
  const updated = pinned.map(f => 
    f.id === folderId ? { ...f, name } : f
  );
  localStorage.setItem(PINNED_FOLDERS_STORAGE_KEY, JSON.stringify(updated));
  
  // Atualiza no Firebase também
  const folder = updated.find(f => f.id === folderId);
  if (folder) {
    await saveToFirebase('pinnedFolders', folderId, folder);
  }
}

export async function togglePinFolder(folderId: string, folderName?: string): Promise<boolean> {
  const isPinned = await isFolderPinned(folderId);
  if (isPinned) {
    await unpinFolder(folderId);
    return false;
  } else {
    await pinFolder(folderId, folderName);
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
    if (!stored) return new Set();
    const parsed = JSON.parse(stored);
    // Garante que é um array válido antes de criar o Set
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter(id => typeof id === 'string' && id.length > 0));
    }
    return new Set();
  } catch {
    return new Set();
  }
}

export async function getFavoritedFolders(forceRefresh: boolean = false): Promise<FavoritedFolder[]> {
  // Primeiro tenta carregar do Firebase se o usuário estiver logado
  const userId = getUserId();
  if (userId) {
    try {
      const firebaseFavorited = await getFromFirebase('favoritedFolders', !forceRefresh);
      // Atualiza localStorage com dados do Firebase (mesmo se vazio, mas só se houver dados ou for refresh forçado)
      if (firebaseFavorited.length > 0 || forceRefresh) {
        localStorage.setItem(FAVORITED_FOLDERS_STORAGE_KEY, JSON.stringify(firebaseFavorited));
        // Sincroniza também o Set de favoritos
        const favoriteIds = firebaseFavorited.map((f: any) => f.id);
        localStorage.setItem(FAVORITE_FOLDERS_STORAGE_KEY, JSON.stringify(favoriteIds));
      }
      return firebaseFavorited.length > 0 ? firebaseFavorited : getFavoritedFoldersSync();
    } catch (error) {
      console.warn('[getFavoritedFolders] Erro ao buscar do Firebase, usando localStorage:', error);
    }
  }

  // Fallback para localStorage (versão síncrona)
  return getFavoritedFoldersSync();
}

export function getFavoritedFoldersSync(): FavoritedFolder[] {
  try {
    const stored = localStorage.getItem(FAVORITED_FOLDERS_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    // Garante que é um array válido
    if (Array.isArray(parsed)) {
      return parsed.filter(folder => folder && folder.id && typeof folder.id === 'string');
    }
    return [];
  } catch {
    return [];
  }
}

export async function isFolderFavorite(folderId: string): Promise<boolean> {
  return getFavoriteFolders().has(folderId);
}

export function isFolderFavoriteSync(folderId: string): boolean {
  if (!folderId || typeof folderId !== 'string') return false;
  return getFavoriteFolders().has(folderId);
}

export async function favoriteFolder(folderId: string, folderName?: string): Promise<void> {
  const favorites = getFavoriteFolders();
  favorites.add(folderId);
  localStorage.setItem(FAVORITE_FOLDERS_STORAGE_KEY, JSON.stringify(Array.from(favorites)));
  
  // Também adiciona aos favoritos com metadados
  const favoritedFolders = await getFavoritedFolders();
  if (!favoritedFolders.find(f => f.id === folderId)) {
    const folderColor = getFolderColor(folderId);
    const favoritedFolder: FavoritedFolder = {
      id: folderId,
      name: folderName || `Pasta ${folderId.substring(0, 8)}...`,
      favoritedAt: new Date().toISOString(),
      // Só inclui color se existir (não usa undefined)
      ...(folderColor ? { color: folderColor } : {}),
    };
    favoritedFolders.push(favoritedFolder);
    localStorage.setItem(FAVORITED_FOLDERS_STORAGE_KEY, JSON.stringify(favoritedFolders));
    
    // Salva no Firebase também (remove undefined automaticamente)
    await saveToFirebase('favoritedFolders', folderId, favoritedFolder);
  }
}

export async function unfavoriteFolder(folderId: string): Promise<void> {
  const favorites = getFavoriteFolders();
  favorites.delete(folderId);
  localStorage.setItem(FAVORITE_FOLDERS_STORAGE_KEY, JSON.stringify(Array.from(favorites)));
  
  // Remove dos favoritos com metadados
  const favoritedFolders = await getFavoritedFolders();
  const filtered = favoritedFolders.filter(f => f.id !== folderId);
  localStorage.setItem(FAVORITED_FOLDERS_STORAGE_KEY, JSON.stringify(filtered));
  
  // Remove do Firebase também
  await deleteFromFirebase('favoritedFolders', folderId);
}

export async function updateFavoritedFolderName(folderId: string, name: string): Promise<void> {
  const favoritedFolders = await getFavoritedFolders();
  const updated = favoritedFolders.map(f => 
    f.id === folderId ? { ...f, name } : f
  );
  localStorage.setItem(FAVORITED_FOLDERS_STORAGE_KEY, JSON.stringify(updated));
  
  // Atualiza no Firebase também
  const folder = updated.find(f => f.id === folderId);
  if (folder) {
    await saveToFirebase('favoritedFolders', folderId, folder);
  }
}

export async function updateFavoritedFolderColor(folderId: string, color: string): Promise<void> {
  const favoritedFolders = await getFavoritedFolders();
  const updated = favoritedFolders.map(f => 
    f.id === folderId ? { ...f, color } : f
  );
  localStorage.setItem(FAVORITED_FOLDERS_STORAGE_KEY, JSON.stringify(updated));
  
  // Atualiza no Firebase também
  const folder = updated.find(f => f.id === folderId);
  if (folder) {
    await saveToFirebase('favoritedFolders', folderId, folder);
  }
}

export async function toggleFavoriteFolder(folderId: string, folderName?: string): Promise<boolean> {
  const isFavorite = await isFolderFavorite(folderId);
  if (isFavorite) {
    await unfavoriteFolder(folderId);
    return false;
  } else {
    await favoriteFolder(folderId, folderName);
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

