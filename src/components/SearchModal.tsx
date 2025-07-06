import { useState, useEffect, useRef } from 'react';
import { Search, FileText, CheckSquare, RefreshCw, X } from 'lucide-react';
import { useStore } from '../store';

interface SearchResult {
  type: 'note' | 'task' | 'routine';
  id: string;
  title: string;
  content: string;
  path?: string;
  matchedLine?: string;
}

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { setCurrentNote, tasks, routines } = useStore();

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    performSearch(query);
  }, [query, tasks, routines]);

  const performSearch = async (searchQuery: string) => {
    const lowerQuery = searchQuery.toLowerCase();
    const searchResults: SearchResult[] = [];

    // Search notes
    const vaultPath = await window.electronAPI.getVaultPath();
    const notesPath = `${vaultPath}/Notes`;
    
    const searchInDirectory = async (dirPath: string) => {
      const files = await window.electronAPI.readDirectory(dirPath);
      
      for (const file of files) {
        if (file.name.startsWith('.')) continue;
        
        if (file.isDirectory) {
          await searchInDirectory(file.path);
        } else if (file.name.endsWith('.md')) {
          const content = await window.electronAPI.readFile(file.path);
          const title = file.name.replace('.md', '');
          
          if (title.toLowerCase().includes(lowerQuery) || 
              content.toLowerCase().includes(lowerQuery)) {
            
            // Find the line that matches
            const lines = content.split('\n');
            let matchedLine = '';
            for (const line of lines) {
              if (line.toLowerCase().includes(lowerQuery)) {
                matchedLine = line.trim();
                break;
              }
            }
            
            searchResults.push({
              type: 'note',
              id: file.path,
              title,
              content: content.substring(0, 200),
              path: file.path,
              matchedLine: matchedLine || title
            });
          }
        }
      }
    };

    await searchInDirectory(notesPath);

    // Search tasks
    tasks.forEach(task => {
      if (task.title.toLowerCase().includes(lowerQuery) ||
          task.content?.toLowerCase().includes(lowerQuery)) {
        searchResults.push({
          type: 'task',
          id: task.id,
          title: task.title,
          content: task.content || '',
          matchedLine: task.title
        });
      }
    });

    // Search routines
    routines.forEach(routine => {
      if (routine.title.toLowerCase().includes(lowerQuery) ||
          routine.content?.toLowerCase().includes(lowerQuery)) {
        searchResults.push({
          type: 'routine',
          id: routine.id,
          title: routine.title,
          content: routine.content || '',
          matchedLine: routine.title
        });
      }
    });

    setResults(searchResults.slice(0, 10)); // Limit to 10 results
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      openResult(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const openResult = async (result: SearchResult) => {
    if (result.type === 'note' && result.path) {
      const content = await window.electronAPI.readFile(result.path);
      setCurrentNote({
        path: result.path,
        content,
        lastModified: new Date()
      });
      onClose();
    }
    // TODO: Handle task and routine navigation
  };

  const getIcon = (type: 'note' | 'task' | 'routine') => {
    switch (type) {
      case 'note': return <FileText size={16} />;
      case 'task': return <CheckSquare size={16} />;
      case 'routine': return <RefreshCw size={16} />;
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50"
      onClick={onClose}
    >
      <div 
        className="absolute left-0 bottom-12 w-96 max-h-[70vh] bg-obsidian-bg-secondary border border-obsidian-border rounded-t-lg rounded-r-lg shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="p-4 border-b border-obsidian-border">
          <div className="flex items-center space-x-3">
            <Search size={20} className="text-obsidian-text-muted" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ara..."
              className="flex-1 bg-transparent outline-none text-lg"
            />
            <button
              onClick={onClose}
              className="p-1 hover:bg-obsidian-bg-tertiary rounded"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="overflow-y-auto flex-1">
            {results.map((result, index) => (
              <div
                key={`${result.type}-${result.id}`}
                className={`px-4 py-3 cursor-pointer transition-colors ${
                  index === selectedIndex 
                    ? 'bg-obsidian-bg-tertiary' 
                    : 'hover:bg-obsidian-bg-tertiary'
                }`}
                onClick={() => openResult(result)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="flex items-start space-x-3">
                  <div className="mt-0.5 text-obsidian-text-muted">
                    {getIcon(result.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{result.title}</div>
                    <div className="text-xs text-obsidian-text-muted truncate">
                      {result.matchedLine}
                    </div>
                  </div>
                  <div className="text-xs text-obsidian-text-muted">
                    {result.type}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {query && results.length === 0 && (
          <div className="p-8 text-center text-obsidian-text-muted">
            <p>Sonuç bulunamadı</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default SearchModal;