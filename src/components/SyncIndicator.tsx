import { useEffect, useState } from 'react';
import { GitStatus } from '../types/electron';
import Modal from './Modal';

type SyncStatus = 'synced' | 'unsynced' | 'syncing' | 'error';

function SyncIndicator() {
  const [status, setStatus] = useState<SyncStatus>('synced');
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [gitConfig, setGitConfig] = useState<{ username: string; repository: string } | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [token, setToken] = useState('');

  const checkGitStatus = async () => {
    try {
      const config = await window.electronAPI.gitGetConfig();
      setGitConfig(config);
      
      if (!config) {
        setStatus('error');
        return;
      }

      const status = await window.electronAPI.gitStatus();
      setGitStatus(status);
      
      if (!status.success) {
        setStatus('error');
      } else if (status.isClean && status.hasCommits) {
        setStatus('synced');
      } else {
        setStatus('unsynced');
      }
    } catch (error) {
      setStatus('error');
    }
  };

  const handleSyncWithToken = async (tokenToUse: string) => {
    if (!tokenToUse || !gitConfig) return;
    
    setShowTokenModal(false);
    setIsSyncing(true);
    setStatus('syncing');
    
    try {
      // Check git status first
      const statusCheck = await window.electronAPI.gitStatus();
      
      if (!statusCheck.success) {
        setStatus('error');
        console.error('Git status check failed');
        return;
      }
      
      // If no commits yet, or there are uncommitted changes
      if (!statusCheck.hasCommits || (statusCheck.modified && statusCheck.modified > 0)) {
        // Add and commit changes
        const commitResult = await window.electronAPI.gitAddCommit();
        
        if (!commitResult.success && !commitResult.message?.includes('No changes')) {
          setStatus('error');
          console.error('Commit failed:', commitResult.error);
          return;
        }
      }
      
      // Try to pull latest changes first
      const pullResult = await window.electronAPI.gitPull(gitConfig.username, tokenToUse);
      
      if (!pullResult.success && 
          !pullResult.error?.includes('No remote') && 
          !pullResult.error?.includes('couldn\'t find remote ref') &&
          !pullResult.message?.includes('Remote repository is empty')) {
        // If pull failed (not because of no remote or empty repo), handle merge conflicts
        console.error('Pull failed:', pullResult.error);
      }
      
      // Push changes
      const pushResult = await window.electronAPI.gitPush(
        gitConfig.repository,
        'main',
        gitConfig.username,
        tokenToUse
      );
      
      if (pushResult.success) {
        setStatus('synced');
        await checkGitStatus();
      } else {
        setStatus('error');
        // If auth failed, clear saved token
        if (pushResult.error?.includes('Authentication failed')) {
          localStorage.removeItem('git-token');
          alert('token error');
        } else {
          alert(`Push error: ${pushResult.error}\n\nbe sure u have repo already.`);
        }
        console.error('Push failed:', pushResult.error);
      }
    } catch (error) {
      setStatus('error');
      console.error('Sync error:', error);
    } finally {
      setIsSyncing(false);
      setToken('');
    }
  };

  const handleSyncClick = async () => {
    if (!gitConfig || isSyncing) return;
    
    // Check if configuration is complete
    if (!gitConfig.username || !gitConfig.repository) {
      alert('Lütfen önce Ayarlar\'dan Git yapılandırmasını tamamlayın');
      return;
    }
    
    // Check if we have a saved token
    const savedToken = localStorage.getItem('git-token');
    if (savedToken) {
      // Use saved token directly
      setToken(savedToken);
      handleSyncWithToken(savedToken);
    } else {
      // Show token modal if no saved token
      setShowTokenModal(true);
    }
  };

  const handleSync = async () => {
    if (!token) {
      alert('Lütfen GitHub Personal Access Token girin');
      return;
    }
    
    // Save token for future use
    localStorage.setItem('git-token', token);
    handleSyncWithToken(token);
  };

  // Check git status periodically
  useEffect(() => {
    checkGitStatus();
    const interval = setInterval(checkGitStatus, 30000); // Check every 30 seconds
    
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle keyboard shortcut for sync (Ctrl+S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && !e.shiftKey) {
        e.preventDefault();
        if (status === 'unsynced' && !isSyncing && gitConfig) {
          handleSyncClick();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, isSyncing, gitConfig]);

  const getStatusColor = () => {
    switch (status) {
      case 'synced':
        return 'bg-transparent';
      case 'unsynced':
        return 'bg-red-500';
      case 'syncing':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-gray-500';
    }
  };

  const getStatusText = () => {
    const savedToken = localStorage.getItem('git-token');
    switch (status) {
      case 'synced':
        return 'Senkronize';
      case 'unsynced':
        return `${gitStatus?.modified || 0} değişiklik var${savedToken ? ' (Tıkla ve senkronize et)' : ''}`;
      case 'syncing':
        return 'Senkronize ediliyor...';
      case 'error':
        return 'Git yapılandırılmamış';
    }
  };

  return (
    <>
      <div className="relative flex justify-end py-3 px-3">
        <button
          onClick={handleSyncClick}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          disabled={isSyncing || status === 'error'}
          className={`w-3 h-3 rounded-full ${getStatusColor()} ${
            isSyncing ? 'animate-pulse' : ''
          } ${status !== 'error' ? 'cursor-pointer hover:ring-2 hover:ring-offset-2 hover:ring-offset-obsidian-bg-secondary hover:ring-obsidian-accent' : 'cursor-not-allowed'}`}
          //title={getStatusText()}
        />
        
        {/* {showTooltip && (
          <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 
                        bg-obsidian-bg-tertiary text-obsidian-text text-xs px-2 py-1 
                        rounded whitespace-nowrap border border-obsidian-border shadow-lg">
            {getStatusText()}
            {status === 'error' && (
              <div className="text-obsidian-text-muted mt-1">
                Ayarlar'dan Git yapılandırın
              </div>
            )}
          </div>
        )} */}
      </div>

      {/* Token Modal */}
      <Modal
        isOpen={showTokenModal}
        title="GitHub Personal Access Token"
        onClose={() => {
          setShowTokenModal(false);
          setToken('');
        }}
      >
        <div className="space-y-4">
          <p className="text-sm text-obsidian-text-muted">
            Değişikliklerinizi GitHub'a yüklemek için Personal Access Token'ınızı girin.
          </p>
          
          <div>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSync()}
              placeholder="ghp_..."
              className="w-full px-3 py-2 bg-obsidian-bg border border-obsidian-border rounded-md 
                       focus:outline-none focus:border-obsidian-accent"
              autoFocus
            />
            <p className="text-xs text-obsidian-text-muted mt-1">
              Token kaydedilecek ve bir daha sorulmayacak.
            </p>
          </div>

          <div className="flex justify-end space-x-2">
            <button
              onClick={() => {
                setShowTokenModal(false);
                setToken('');
              }}
              className="px-4 py-2 bg-obsidian-bg-tertiary hover:bg-obsidian-border 
                       rounded-md text-sm transition-colors"
            >
              İptal
            </button>
            <button
              onClick={handleSync}
              disabled={!token}
              className="px-4 py-2 bg-obsidian-accent hover:bg-obsidian-accent-hover 
                       text-white rounded-md text-sm transition-colors disabled:opacity-50 
                       disabled:cursor-not-allowed"
            >
              Senkronize Et
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export default SyncIndicator;


