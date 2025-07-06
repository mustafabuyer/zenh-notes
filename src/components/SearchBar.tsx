import { useState, useEffect, useRef } from 'react';
import { Search, FileText, CheckSquare, RefreshCw, X, Check } from 'lucide-react';
import { useStore } from '../store';

// Types
interface Task {
  id: string;
  title: string;
  content?: string;
}

interface Routine {
  id: string;
  title: string;
  content?: string;
}

interface Note {
  path: string;
  content: string;
  lastModified: Date;
}

interface SearchResult {
  type: 'note' | 'task' | 'routine';
  id: string;
  title: string;
  content: string;
  path?: string;
  matchedLine?: string;
}

function SearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [webhookStatus, setWebhookStatus] = useState<'success' | 'error' | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const setCurrentNote = useStore((state) => state.setCurrentNote);
  const tasks = useStore((state) => state.tasks) as Task[];
  const routines = useStore((state) => state.routines) as Routine[];

  // Global search shortcut
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Auto-hide webhook status after 2 seconds
  useEffect(() => {
    if (webhookStatus) {
      const timer = setTimeout(() => {
        setWebhookStatus(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [webhookStatus]);

  useEffect(() => {
    // Don't search if query starts with ":"
    if (query.startsWith(':')) {
      setResults([]);
      setShowResults(false);
      return;
    }

    if (!query.trim()) {
      setResults([]);
      setShowResults(false);
      return;
    }

    performSearch(query);
    setShowResults(true);
  }, [query, tasks, routines]);

  const sendWebhook = async (message: string) => {
    try {
      // TODO: Replace YOUR_WEBHOOK_ID with your actual n8n webhook ID
      // Get it from your n8n Webhook node's "Production URL"
      // Example: http://n8n.zakrom.com:5678/webhook/a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6
      const response = await fetch('http://n8n.zakrom.com:5678/webhook/input', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: message,
      });

      if (response.ok) {
        setWebhookStatus('success');
        setQuery('');
      } else {
        setWebhookStatus('error');
      }
    } catch (error) {
      console.error('Webhook error:', error);
      setWebhookStatus('error');
    }
  };

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

    setResults(searchResults.slice(0, 10));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && query.startsWith(':')) {
      // Send webhook
      e.preventDefault();
      const message = query.substring(1).trim();
      if (message) {
        sendWebhook(message);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      openResult(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      setQuery('');
      setShowResults(false);
      inputRef.current?.blur();
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
      setQuery('');
      setShowResults(false);
    }
  };

  const getIcon = (type: 'note' | 'task' | 'routine') => {
    switch (type) {
      case 'note': return <FileText size={16} />;
      case 'task': return <CheckSquare size={16} />;
      case 'routine': return <RefreshCw size={16} />;
    }
  };

  return (
    <div className="relative">
      {/* Search Results */}
      {showResults && results.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-0 bg-obsidian-bg-secondary border-obsidian-border shadow-2xl max-h-[400px] overflow-y-auto">
          {results.map((result, index) => (
            <div
              key={`${result.type}-${result.id}`}
              className={`px-3 py-2 cursor-pointer transition-colors ${
                index === selectedIndex 
                  ? 'bg-obsidian-bg-tertiary' 
                  : 'hover:bg-obsidian-bg-tertiary'
              }`}
              onClick={() => openResult(result)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="flex items-start space-x-2">
                <div className="mt-0.5 text-obsidian-text-muted">
                  {getIcon(result.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{result.title}</div>
                  <div className="text-xs text-obsidian-text-muted truncate">
                    {result.matchedLine}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search Input */}
      <div className="p-2 border-t border-obsidian-border">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => query && !query.startsWith(':') && setShowResults(true)}
            //placeholder="Ara..."
            className="w-full pl-8 pr-2 py-1.5 bg-transparent border-obsidian-border 
                     text-sm placeholder-obsidian-text-muted focus:outline-none focus:border-obsidian-accent"
          />
          
          {/* Clear button */}
          {query && !webhookStatus && (
            <button
              onClick={() => {
                setQuery('');
                setShowResults(false);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-obsidian-text-muted hover:text-obsidian-text"
            >
              <X size={14} />
            </button>
          )}
          
          {/* Webhook status indicator */}
          {webhookStatus && (
            <div className={`absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-5 h-5 rounded-full transition-all duration-300 ${
              webhookStatus === 'success' ? 'bg-green-500' : 'bg-red-500'
            }`}>
              {webhookStatus === 'success' ? (
                <Check size={12} className="text-white" />
              ) : (
                <X size={12} className="text-white" />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SearchBar;