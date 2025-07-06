import { useEffect, useState } from 'react';
import { useStore } from './store';
import { isBefore, isToday } from 'date-fns';
import FileExplorer from './components/FileExplorer';
import NoteEditor from './components/NoteEditor';
import TasksView from './components/TasksView';
import TaskFolderExplorer from './components/TaskFolderExplorer';
import RoutinesView from './components/RoutinesView';
import RoutinesSidebar from './components/RoutinesSidebar';
import Modal from './components/Modal';
import NavigationBar from './components/NavigationBar';
import SearchBar from './components/SearchBar';
import SyncIndicator from './components/SyncIndicator';
import './App.css';
import ExcalidrawEditor from './components/ExcalidrawEditor';
interface ColorScheme {
  bg: string;
  bgSecondary: string;
  bgTertiary: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  accentHover: string;
  error: string;
}

interface GitConfig {
  username: string;
  repository: string;
  password?: string;
}

function App() {
  const { activeTab, setActiveTab, loadTasks, loadTaskFolders, loadRoutines, routines, currentNote, currentExcalidraw } = useStore();
  const [showSettings, setShowSettings] = useState(false);
  const [zenMode, setZenMode] = useState(false);
  const [vaultPath, setVaultPath] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'overdue' | 'today' | 'tomorrow' | 'week' | 'month'>('today');
  const [showAddForm, setShowAddForm] = useState(false);
  const [customColors, setCustomColors] = useState<ColorScheme>({
    bg: '#1e1e1e',
    bgSecondary: '#262626',
    bgTertiary: '#2d2d2d',
    border: '#3e3e3e',
    text: '#d4d4d4',
    textMuted: '#808080',
    accent: '#7c3aed',
    accentHover: '#6d28d9',
    error: '#ef4444'
  });
  
  // Git settings
  const [gitConfig, setGitConfig] = useState<GitConfig>({
    username: '',
    repository: '',
    password: ''
  });
  const [showGitImport, setShowGitImport] = useState(false);
  const [importCredentials, setImportCredentials] = useState({ username: '', password: '' });
  const [tokenSaved, setTokenSaved] = useState(!!localStorage.getItem('git-token'));


  useEffect(() => {
    // Load saved colors
    const savedColors = localStorage.getItem('customColors');
    if (savedColors) {
      const colors = JSON.parse(savedColors);
      setCustomColors(colors);
      applyColors(colors);
    }

    // Initial load
    loadTasks();
    loadTaskFolders();
    loadRoutines();
    loadVaultPath();
    loadGitConfig();
    initializeGit();

    // ADD THIS: Update routine streaks daily
    const checkRoutines = async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const currentRoutines = useStore.getState().routines;
      const updatedRoutines = currentRoutines.map(routine => {
        if (!routine.lastCompleted) return routine;
        
        const lastCompleted = new Date(routine.lastCompleted);
        lastCompleted.setHours(0, 0, 0, 0);
        
        // Check if streak should be broken (missed a day)
        const daysSinceCompleted = Math.floor((today.getTime() - lastCompleted.getTime()) / (1000 * 60 * 60 * 24));
        
        if (routine.type === 'daily' && daysSinceCompleted > routine.frequency) {
          return { ...routine, streak: 0 };
        } else if (routine.type === 'weekly' && daysSinceCompleted > routine.frequency * 7) {
          return { ...routine, streak: 0 };
        } else if (routine.type === 'monthly' && daysSinceCompleted > routine.frequency * 30) {
          return { ...routine, streak: 0 };
        }
        
        return routine;
      });
      
      // Only update if there are changes
      if (JSON.stringify(updatedRoutines) !== JSON.stringify(currentRoutines)) {
        // Save to file and reload
        await window.electronAPI.writeJson('routines.json', updatedRoutines);
        await loadRoutines(); // This will update the store with the new data
      }
    };
    
    const interval = setInterval(checkRoutines, 60000); // Check every minute
    checkRoutines(); // Initial check

    // ADD THIS: Listen for search triggers from quick capture
    const handleQuickSearch = (query: string) => {
      // Focus on the search bar and set the query
      const searchInput = document.querySelector('input[placeholder="Ara..."]') as HTMLInputElement;
      if (searchInput) {
        searchInput.value = query;
        searchInput.focus();
        // Trigger the search by dispatching an input event
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    };

    // Register the search trigger listener
    window.electronAPI.onTriggerSearch(handleQuickSearch);

    // UPDATE THE RETURN STATEMENT TO CLEAN UP THE INTERVAL
    return () => {
      clearInterval(interval);
    };
  }, [loadTasks, loadTaskFolders, loadRoutines]); // Remove 'routines' from dependencies


  // Handle ESC key for zen mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && zenMode) {
        setZenMode(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [zenMode]);

  const loadVaultPath = async () => {
    const path = await window.electronAPI.getVaultPath();
    setVaultPath(path);
  };

  const loadGitConfig = async () => {
    const config = await window.electronAPI.gitGetConfig();
    if (config) {
      // Load saved token from localStorage
      const savedToken = localStorage.getItem('git-token') || '';
      setGitConfig({ ...config, password: savedToken });
    }
  };

  const initializeGit = async () => {
    await window.electronAPI.gitInit();
  };

  const saveGitConfig = async () => {
    const { username, repository, password } = gitConfig;
    // Save all config including token
    await window.electronAPI.gitSaveConfig({ username, repository });
    
    // Save token separately for convenience
    if (password) {
      localStorage.setItem('git-token', password);
      setTokenSaved(true);
    }
    
    // Test connection with a push
    if (username && repository && password) {
      // First ensure we have at least one commit
      const status = await window.electronAPI.gitStatus();
      if (!status.hasCommits) {
        await window.electronAPI.gitAddCommit('Initial commit');
      }
      
      const result = await window.electronAPI.gitPush(repository, 'main', username, password);
      if (!result.success) {
        alert(`Git bağlantı hatası: ${result.error}\n\nÇözüm önerileri:\n1. GitHub'da boş bir repository oluşturduğunuzdan emin olun\n2. Personal Access Token'ınızın 'repo' iznine sahip olduğunu kontrol edin\n3. Repository adını doğru yazdığınızdan emin olun`);
      } else {
        alert('Git başarıyla yapılandırıldı!');
      }
    }
  };

  const handleGitImport = async () => {
    if (!importCredentials.username || !importCredentials.password) {
      alert('Lütfen GitHub kullanıcı adı ve Personal Access Token girin');
      return;
    }

    const pullResult = await window.electronAPI.gitPull(
      importCredentials.username,
      importCredentials.password
    );

    if (pullResult.success) {
      // Save the token for future use
      localStorage.setItem('git-token', importCredentials.password);
      setTokenSaved(true);
      
      // Reload all data after import
      await loadTasks();
      await loadTaskFolders();
      await loadRoutines();
      alert('Veriler başarıyla içe aktarıldı!');
      setShowGitImport(false);
      setImportCredentials({ username: '', password: '' });
    } else {
      alert(`İçe aktarma hatası: ${pullResult.error}\n\nEğer repository private ise, token'ınızın 'repo' iznine sahip olduğundan emin olun.`);
    }
  };

  const applyColors = (colors: ColorScheme) => {
    const root = document.documentElement;
    root.style.setProperty('--color-bg', colors.bg);
    root.style.setProperty('--color-bg-secondary', colors.bgSecondary);
    root.style.setProperty('--color-bg-tertiary', colors.bgTertiary);
    root.style.setProperty('--color-border', colors.border);
    root.style.setProperty('--color-text', colors.text);
    root.style.setProperty('--color-text-muted', colors.textMuted);
    root.style.setProperty('--color-accent', colors.accent);
    root.style.setProperty('--color-accent-hover', colors.accentHover);
    root.style.setProperty('--color-error', colors.error);
  };

  const updateColor = async (colorKey: keyof ColorScheme, value: string) => {
    const newColors = { ...customColors, [colorKey]: value };
    setCustomColors(newColors);
    applyColors(newColors);
    localStorage.setItem('customColors', JSON.stringify(newColors));
    
    // Save to vault for syncing
    await window.electronAPI.saveAppSettings({ customColors: newColors });
  };

  return (
    <div className="flex h-screen bg-obsidian-bg text-obsidian-text">
      {/* Left Sidebar */}
      {!zenMode && (
        <aside className="w-64 bg-obsidian-bg-secondary border-r border-obsidian-border flex flex-col">
          {activeTab === 'notes' ? (
            <>
              <div className="flex-1 overflow-y-auto">
                <FileExplorer />
              </div>
              <SyncIndicator />
              <SearchBar />
              <NavigationBar
                activeTab={activeTab}
                onTabChange={setActiveTab}
                onShowSettings={() => setShowSettings(true)}
                onToggleZenMode={() => setZenMode(!zenMode)}
              />
            </>
          ) : activeTab === 'tasks' ? (
            <>
              <div className="flex-1 overflow-y-auto">
                <TaskFolderExplorer
                  selectedFolder={selectedFolder}
                  onSelectFolder={setSelectedFolder}
                />
              </div>
              <SyncIndicator />
              <SearchBar />
              <NavigationBar
                activeTab={activeTab}
                onTabChange={setActiveTab}
                onShowSettings={() => setShowSettings(true)}
                onToggleZenMode={() => setZenMode(!zenMode)}
              />
            </>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto">
                <RoutinesSidebar
                  selectedFilter={selectedFilter}
                  onFilterChange={setSelectedFilter}
                  overdueCount={routines.filter(r => r.nextDue && isBefore(new Date(r.nextDue), new Date()) && !isToday(new Date(r.nextDue))).length}
                  onAddRoutine={() => setShowAddForm(true)}
                />
              </div>
              <SyncIndicator />
              <SearchBar />
              <NavigationBar
                activeTab={activeTab}
                onTabChange={setActiveTab}
                onShowSettings={() => setShowSettings(true)}
                onToggleZenMode={() => setZenMode(!zenMode)}
              />
            </>
          )}
        </aside>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'notes' && currentNote && !currentExcalidraw && (
          <NoteEditor key={currentNote.path} />
        )}
        
        {activeTab === 'notes' && currentExcalidraw && (
          <ExcalidrawEditor key={currentExcalidraw.path} />
        )}
        
        {activeTab === 'notes' && !currentNote && !currentExcalidraw && (
          <div className="h-full flex items-center justify-center text-obsidian-text-muted">
            <div className="text-center">
              <p className="text-lg mb-2"></p>
              <p className="text-sm"></p>
            </div>
          </div>
        )}
        
        {activeTab === 'tasks' && (
          <TasksView selectedFolder={selectedFolder} onFolderChange={setSelectedFolder} />
        )}
        
        {activeTab === 'routines' && (
          <RoutinesView 
            selectedFilter={selectedFilter}
            onFilterChange={setSelectedFilter}
            showAddForm={showAddForm}
            onShowAddForm={setShowAddForm}
          />
        )}
      </div>
      {/* Settings Modal */}
      <Modal 
        isOpen={showSettings}
        title="Ayarlar" 
        onClose={() => setShowSettings(false)}
      >
          <div className="space-y-6">
            {/* Vault Path */}
            <div>
              <label className="block text-sm font-medium mb-2">Vault Konumu</label>
              <input
                type="text"
                value={vaultPath}
                readOnly
                className="w-full px-3 py-2 bg-obsidian-bg-tertiary border border-obsidian-border rounded-md text-obsidian-text-muted"
              />
            </div>

            {/* Git Settings */}
            <div className="border-t border-obsidian-border pt-6">
                {tokenSaved && (
               <span className="text-lg text-green-500 font-semibold mb-2">Git Backup</span>
              )}              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1"></label>
                  <input
                    type="text"
                    value={gitConfig.username}
                    onChange={(e) => setGitConfig({ ...gitConfig, username: e.target.value })}
                    placeholder="user name"
                    className="w-full px-3 py-2 bg-obsidian-bg border border-obsidian-border rounded-md 
                             focus:outline-none focus:border-obsidian-accent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1"></label>
                  <input
                    type="text"
                    value={gitConfig.repository}
                    onChange={(e) => setGitConfig({ ...gitConfig, repository: e.target.value })}
                    placeholder="repo name"
                    className="w-full px-3 py-2 bg-obsidian-bg border border-obsidian-border rounded-md 
                             focus:outline-none focus:border-obsidian-accent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                  </label>
                  <input
                    type="password"
                    value={gitConfig.password}
                    onChange={(e) => setGitConfig({ ...gitConfig, password: e.target.value })}
                    placeholder={tokenSaved ? "ok" : "ghp_..."}
                    className="w-full px-3 py-2 bg-obsidian-bg border border-obsidian-border rounded-md 
                             focus:outline-none focus:border-obsidian-accent"
                  />


                  <p className="text-xs text-obsidian-text-muted mt-1">
                     
                  </p>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={saveGitConfig}
                    className="px-4 py-2 bg-obsidian-accent hover:bg-obsidian-accent-hover 
                             text-white rounded-md text-sm transition-colors"
                  >
                    Save n Test
                  </button>
                  
                  <button
                    onClick={() => setShowGitImport(true)}
                    className="px-4 py-2 bg-obsidian-bg-tertiary hover:bg-obsidian-border 
                             rounded-md text-sm transition-colors"
                  >
                    Import
                  </button>
                  
                  {tokenSaved && (
                    <button
                      onClick={() => {
                        localStorage.removeItem('git-token');
                        setGitConfig({ ...gitConfig, password: '' });
                        setTokenSaved(false);
                        alert('Token silindi');
                      }}
                      className="px-4 py-2 bg-obsidian-error hover:bg-red-600 
                               text-white rounded-md text-sm transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Color Settings */}
            <div className="border-t border-obsidian-border pt-6">
              <h3 className="text-lg font-semibold mb-4">Colors</h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs mb-1">Bg</label>
                  <input
                    type="color"
                    value={customColors.bg}
                    onChange={(e) => updateColor('bg', e.target.value)}
                    className="w-full h-8 rounded cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1">2nd Bg</label>
                  <input
                    type="color"
                    value={customColors.bgSecondary}
                    onChange={(e) => updateColor('bgSecondary', e.target.value)}
                    className="w-full h-8 rounded cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1">3rd Bg</label>
                  <input
                    type="color"
                    value={customColors.bgTertiary}
                    onChange={(e) => updateColor('bgTertiary', e.target.value)}
                    className="w-full h-8 rounded cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1">Borders</label>
                  <input
                    type="color"
                    value={customColors.border}
                    onChange={(e) => updateColor('border', e.target.value)}
                    className="w-full h-8 rounded cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1">Text</label>
                  <input
                    type="color"
                    value={customColors.text}
                    onChange={(e) => updateColor('text', e.target.value)}
                    className="w-full h-8 rounded cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1">Text a/2</label>
                  <input
                    type="color"
                    value={customColors.textMuted}
                    onChange={(e) => updateColor('textMuted', e.target.value)}
                    className="w-full h-8 rounded cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1">Point</label>
                  <input
                    type="color"
                    value={customColors.accent}
                    onChange={(e) => updateColor('accent', e.target.value)}
                    className="w-full h-8 rounded cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1">Point Hover</label>
                  <input
                    type="color"
                    value={customColors.accentHover}
                    onChange={(e) => updateColor('accentHover', e.target.value)}
                    className="w-full h-8 rounded cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1">Error</label>
                  <input
                    type="color"
                    value={customColors.error}
                    onChange={(e) => updateColor('error', e.target.value)}
                    className="w-full h-8 rounded cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>
        </Modal>

      {/* Git Import Modal */}
      <Modal 
        isOpen={showGitImport}
        title="Import" 
        onClose={() => setShowGitImport(false)}
      >
          <div className="space-y-4">
            <p className="text-sm text-obsidian-text-muted">
              
            </p>
            
            <div>
              <label className="block text-sm font-medium mb-2">Username</label>
              <input
                type="text"
                value={importCredentials.username}
                onChange={(e) => setImportCredentials({ ...importCredentials, username: e.target.value })}
                placeholder=""
                className="w-full px-3 py-2 bg-obsidian-bg border border-obsidian-border rounded-md 
                         focus:outline-none focus:border-obsidian-accent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Token</label>
              <input
                type="password"
                value={importCredentials.password}
                onChange={(e) => setImportCredentials({ ...importCredentials, password: e.target.value })}
                placeholder="ghp_..."
                className="w-full px-3 py-2 bg-obsidian-bg border border-obsidian-border rounded-md 
                         focus:outline-none focus:border-obsidian-accent"
              />
              <p className="text-xs text-obsidian-text-muted mt-1">
                
              </p>
            </div>

            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowGitImport(false)}
                className="px-4 py-2 bg-obsidian-bg-tertiary hover:bg-obsidian-border 
                         rounded-md text-sm transition-colors"
              >
                x
              </button>
              <button
                onClick={handleGitImport}
                className="px-4 py-2 bg-obsidian-accent hover:bg-obsidian-accent-hover 
                         text-white rounded-md text-sm transition-colors"
              >
                Import
              </button>
            </div>
          </div>
        </Modal>
    </div>
  );
}

export default App;