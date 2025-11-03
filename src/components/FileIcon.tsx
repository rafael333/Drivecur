import { FileText, FileSpreadsheet, Presentation, Folder, Image, Archive, Video } from 'lucide-react';
import { getFolderColor } from '../lib/savedFolders';

interface FileIconProps {
  type: string;
  folderId?: string;
}

export function FileIcon({ type, folderId }: FileIconProps) {
  const iconClasses = 'w-6 h-6';

  switch (type) {
    case 'pdf':
      return (
        <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center border border-red-500/30">
          <FileText className={`${iconClasses} text-red-400`} />
        </div>
      );
    case 'pptx':
      return (
        <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center border border-orange-500/30">
          <Presentation className={`${iconClasses} text-orange-400`} />
        </div>
      );
    case 'xlsx':
      return (
        <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center border border-green-500/30">
          <FileSpreadsheet className={`${iconClasses} text-green-400`} />
        </div>
      );
    case 'docx':
      return (
        <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center border border-blue-500/30">
          <FileText className={`${iconClasses} text-blue-400`} />
        </div>
      );
    case 'folder':
      const folderColor = folderId ? getFolderColor(folderId) : null;

      return (
        <div 
          className="w-10 h-10 rounded-lg flex items-center justify-center border"
          style={folderColor ? {
            backgroundColor: `${folderColor}33`,
            borderColor: `${folderColor}4d`
          } : {
            backgroundColor: 'rgba(107, 114, 128, 0.2)',
            borderColor: 'rgba(107, 114, 128, 0.3)'
          }}
        >
          <Folder 
            className={iconClasses}
            style={folderColor ? { color: folderColor } : { color: 'rgb(156, 163, 175)' }}
          />
        </div>
      );
    case 'png':
    case 'jpg':
      return (
        <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center border border-purple-500/30">
          <Image className={`${iconClasses} text-purple-400`} />
        </div>
      );
    case 'zip':
      return (
        <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center border border-yellow-500/30">
          <Archive className={`${iconClasses} text-yellow-400`} />
        </div>
      );
    case 'video':
      return (
        <div className="w-12 h-12 sm:w-10 sm:h-10 bg-pink-500/20 rounded-xl flex items-center justify-center border border-pink-500/30 shadow-lg shadow-pink-500/10">
          <Video className={`w-7 h-7 sm:w-6 sm:h-6 text-pink-400`} />
        </div>
      );
    default:
      return (
        <div className="w-10 h-10 bg-gray-500/20 rounded-lg flex items-center justify-center border border-gray-500/30">
          <FileText className={`${iconClasses} text-gray-400`} />
        </div>
      );
  }
}
