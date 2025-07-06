import { FileText, CheckSquare, RefreshCw, Settings, Minimize } from 'lucide-react';

interface NavigationBarProps {
  activeTab: string;
  onTabChange: (tab: 'notes' | 'tasks' | 'routines') => void;
  onShowSettings: () => void;
  onToggleZenMode: () => void;
}

function NavigationBar({ activeTab, onTabChange, onShowSettings, onToggleZenMode }: NavigationBarProps) {
  return (
    <div className="border-t border-obsidian-border p-2 flex items-center justify-around bg-obsidian-bg">
      <button
        onClick={() => onTabChange('notes')}
        className={`p-2 rounded-md transition-colors ${
          activeTab === 'notes'
            ? 'bg-obsidian-accent text-white'
            : 'hover:bg-obsidian-bg-tertiary text-obsidian-text-muted'
        }`}
        //title="Notlar"
      >
        <FileText size={18} />
      </button>
      
      <button
        onClick={() => onTabChange('tasks')}
        className={`p-2 rounded-md transition-colors ${
          activeTab === 'tasks'
            ? 'bg-obsidian-accent text-white'
            : 'hover:bg-obsidian-bg-tertiary text-obsidian-text-muted'
        }`}
        //title="Görevler"
      >
        <CheckSquare size={18} />
      </button>
      
      <button
        onClick={() => onTabChange('routines')}
        className={`p-2 rounded-md transition-colors ${
          activeTab === 'routines'
            ? 'bg-obsidian-accent text-white'
            : 'hover:bg-obsidian-bg-tertiary text-obsidian-text-muted'
        }`}
        //title="Rutinler"
      >
        <RefreshCw size={18} />
      </button>
      
      <button 
        onClick={onShowSettings}
        className="p-2 hover:bg-obsidian-bg-tertiary rounded-md text-obsidian-text-muted"
        //title="Ayarlar"
      >
        <Settings size={18} />
      </button>
      
      <button 
        onClick={onToggleZenMode}
        className="p-2 hover:bg-obsidian-bg-tertiary rounded-md text-obsidian-text-muted"
        //title="Zen Modu"
      >
        <Minimize size={18} />
      </button>
    </div>
  );
}

export default NavigationBar;