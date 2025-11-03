import { useEffect, useState } from 'react';
import { X, AlertCircle, Loader2, CheckCircle2, Palette } from 'lucide-react';
import { extractFolderIdFromLink, SavedFolder, saveFolder, FOLDER_COLOR_OPTIONS, DEFAULT_FOLDER_COLOR } from '../lib/savedFolders';

interface AddFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFolderAdded: (folder: SavedFolder) => void;
  accessToken: string;
}

export function AddFolderModal({ isOpen, onClose, onFolderAdded, accessToken }: AddFolderModalProps) {
  const [folderLink, setFolderLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [selectedColor, setSelectedColor] = useState<string>(DEFAULT_FOLDER_COLOR);

  useEffect(() => {
    if (isOpen) {
      setSelectedColor(DEFAULT_FOLDER_COLOR);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAdd = async () => {
    if (!folderLink.trim()) {
      setError('Por favor, insira um link de pasta');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Extrai o ID da pasta do link
      const folderId = extractFolderIdFromLink(folderLink.trim());
      
      if (!folderId) {
        setError('Link inválido. Use um link do Google Drive no formato:\ndrive.google.com/drive/folders/ID');
        setLoading(false);
        return;
      }

      // Busca informações da pasta via API com parâmetros para pastas compartilhadas
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,mimeType,owners,shared&supportsAllDrives=true&includeItemsFromAllDrives=true`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Erro ao buscar informações da pasta');
      }

      const folderData = await response.json();

      // Verifica se é realmente uma pasta
      if (folderData.mimeType !== 'application/vnd.google-apps.folder') {
        setError('O link fornecido não é de uma pasta');
        setLoading(false);
        return;
      }

      // Cria o objeto da pasta salva
      const savedFolder: SavedFolder = {
        id: folderData.id,
        name: folderData.name,
        link: folderLink.trim(),
        addedAt: new Date().toISOString(),
        color: selectedColor,
      };

      // Salva a pasta
      saveFolder(savedFolder);
      
      setSuccess(true);
      setFolderLink('');
      setSelectedColor(DEFAULT_FOLDER_COLOR);
      
      // Aguarda um pouco para mostrar mensagem de sucesso
      setTimeout(() => {
        onFolderAdded(savedFolder);
        onClose();
        setSuccess(false);
      }, 1000);

    } catch (err: any) {
      console.error('Erro ao adicionar pasta:', err);
      setError(err.message || 'Erro ao adicionar pasta. Verifique se você tem acesso a esta pasta.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setFolderLink('');
      setError(null);
      setSuccess(false);
      setSelectedColor(DEFAULT_FOLDER_COLOR);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-[#1a1a1a] rounded-xl border border-gray-800 w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">Adicionar Pasta</h2>
          <button
            onClick={handleClose}
            disabled={loading}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Cor da pasta
          </label>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Palette className="w-4 h-4" />
              <span>Escolha uma cor para destacar esta pasta.</span>
            </div>
            <div className="grid grid-cols-5 sm:grid-cols-8 gap-2">
              {FOLDER_COLOR_OPTIONS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  disabled={loading}
                  className={`w-8 h-8 rounded-lg border-2 transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#1a1a1a] focus:ring-blue-500 ${
                    selectedColor === color ? 'border-white' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color }}
                  title={`Selecionar cor ${color}`}
                />
              ))}
            </div>
          </div>
        </div>

        <p className="text-gray-400 text-sm mb-4">
          Cole o link de uma pasta do Google Drive para adicioná-la aos seus atalhos
        </p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Link da Pasta
          </label>
          <input
            type="text"
            value={folderLink}
            onChange={(e) => {
              setFolderLink(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !loading) {
                handleAdd();
              }
            }}
            placeholder="https://drive.google.com/drive/folders/..."
            disabled={loading}
            className="w-full bg-[#0f0f0f] border border-gray-800 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent disabled:opacity-50"
          />
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded text-red-400 text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span className="whitespace-pre-line">{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-900/20 border border-green-800 rounded text-green-400 text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>Pasta adicionada com sucesso!</span>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleClose}
            disabled={loading}
            className="flex-1 bg-[#202020] hover:bg-[#252525] text-white px-4 py-3 rounded-lg font-medium transition-colors border border-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
          <button
            onClick={handleAdd}
            disabled={loading || !folderLink.trim()}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Adicionando...
              </>
            ) : (
              'Adicionar'
            )}
          </button>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-800">
          <p className="text-xs text-gray-500">
            <strong>Formatos aceitos:</strong><br />
            • https://drive.google.com/drive/folders/FOLDER_ID<br />
            • https://drive.google.com/open?id=FOLDER_ID<br />
            • Apenas o ID da pasta
          </p>
        </div>
      </div>
    </div>
  );
}

