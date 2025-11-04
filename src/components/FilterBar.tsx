import { FileText, Video, Image, Folder } from 'lucide-react';
import { FilterType } from '../types';

interface FilterBarProps {
  filter: FilterType;
  setFilter: (filter: FilterType) => void;
}

const filters = [
  { type: 'all' as FilterType, label: 'Todos', icon: FileText },
  { type: 'pdf' as FilterType, label: 'PDF', icon: FileText },
  { type: 'video' as FilterType, label: 'Vídeo', icon: Video },
  { type: 'image' as FilterType, label: 'Imagem', icon: Image },
  { type: 'folder' as FilterType, label: 'Pasta', icon: Folder },
];

export function FilterBar({ filter, setFilter }: FilterBarProps) {
  return (
    <div className="px-3 sm:px-6 pb-4">
      {/* Mobile: Scroll horizontal com snap */}
      <div className="relative w-full">
        <div 
          className="overflow-x-auto pb-3 scrollbar-hide sm:pb-2 -mx-3 sm:mx-0 px-3 sm:px-0"
          style={{ 
            WebkitOverflowScrolling: 'touch',
            scrollBehavior: 'smooth',
            overflowY: 'hidden',
            overflowX: 'auto'
          }}
        >
          <div className="flex gap-2 flex-nowrap sm:flex-wrap" style={{ width: 'max-content', minWidth: '100%' }}>
            {filters.map((f, index) => {
              const Icon = f.icon;
              return (
                <button
                  key={f.type}
                  onClick={() => setFilter(f.type)}
                  className={`flex items-center gap-2 px-4 sm:px-4 py-2.5 sm:py-2 rounded-2xl sm:rounded-lg font-medium text-sm transition-all duration-200 whitespace-nowrap shrink-0 touch-manipulation active:scale-95 snap-start ${
                    filter === f.type
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                      : 'bg-[#1a1a1a] text-gray-400 hover:bg-[#202020] hover:text-white border border-gray-800/50 active:bg-[#252525]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
