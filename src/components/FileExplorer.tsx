import { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Folder, FileText, FolderPlus, Plus, Trash2, Lock, Unlock, Move, Pen, Edit2 } from 'lucide-react';
import { useStore } from '../store';
import Modal from './Modal';

interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];
}

function FileExplorer() {
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [vaultPath, setVaultPath] = useState<string>('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; path: string; isDirectory: boolean } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'note' | 'folder' | 'excalidraw'>('note');
  const [modalPath, setModalPath] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [moveMode, setMoveMode] = useState<{ sourcePath: string; name: string } | null>(null);
  const [passwordModal, setPasswordModal] = useState<{ isOpen: boolean; path: string; mode: 'encrypt' | 'decrypt' | 'access' } | null>(null);
  const [password, setPassword] = useState('');
  const [renameModal, setRenameModal] = useState<{ isOpen: boolean; path: string; currentName: string; isDirectory: boolean } | null>(null);
  
  const { currentNote, setCurrentNote, expandedFolders, toggleFolder, encryptedNotes, setNoteEncrypted, setCurrentExcalidraw } = useStore();

  useEffect(() => {
    loadFileTree();
    // Load encrypted notes from localStorage
    const saved = window.localStorage.getItem('encryptedNotes');
    if (saved) {
      const paths = JSON.parse(saved);
      paths.forEach((path: string) => setNoteEncrypted(path, true));
    }
  }, [setNoteEncrypted]);

  const loadFileTree = async () => {
    const path = await window.electronAPI.getVaultPath();
    setVaultPath(path);
    const notesPath = `${path}/Notes`;
    const tree = await buildFileTree(notesPath);
    setFileTree(tree);
  };

  const buildFileTree = async (dirPath: string): Promise<FileNode[]> => {
    const files = await window.electronAPI.readDirectory(dirPath);
    const tree: FileNode[] = [];

    for (const file of files) {
      if (file.name.startsWith('.')) continue; // Skip hidden files
      
      const node: FileNode = {
        name: file.name,
        path: file.path,
        isDirectory: file.isDirectory
      };

      if (file.isDirectory) {
        node.children = await buildFileTree(file.path);
      }

      tree.push(node);
    }

    return tree.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
  };

const handleFileClick = async (file: FileNode, e?: React.MouseEvent) => {
    // Check for middle click or ctrl+click to open in new window
    if (e && file.name.endsWith('.md') && (e.button === 1 || (e.button === 0 && e.ctrlKey))) {
      e.preventDefault();
      const content = await window.electronAPI.readFile(file.path);
      window.electronAPI.openNoteWindow({
        path: file.path,
        content,
        title: file.name.replace('.md', '')
      });
      return;
    }

    if (moveMode && file.isDirectory) {
      // If in move mode and clicked on a folder, move the file there
      await moveFile(moveMode.sourcePath, file.path);
      return; // BU RETURN'Ü DE EKLEYİN
    } else if (file.isDirectory) {
      toggleFolder(file.path);
      return; // BU RETURN'Ü DE EKLEYİN
    } else if (file.name.endsWith('.excalidraw')) {
      // Open excalidraw file
      setCurrentNote(null);
      setCurrentExcalidraw({
        path: file.path,
        lastModified: new Date()
      });
      return; // ÖNEMLİ: BU RETURN'Ü EKLEYİN!
    } else if (file.name.endsWith('.md')) {
      // Check if encrypted
      if (encryptedNotes.has(file.path)) {
        setPasswordModal({ isOpen: true, path: file.path, mode: 'access' });
      } else {
        const content = await window.electronAPI.readFile(file.path);
        // Check if file is encrypted but not marked
        if (content.startsWith('ENCRYPTED:')) {
          setNoteEncrypted(file.path, true);
          setPasswordModal({ isOpen: true, path: file.path, mode: 'access' });
        } else {
          setCurrentNote({
            path: file.path,
            content,
            lastModified: new Date()
          });
          setCurrentExcalidraw(null); // BUNU DA EKLEYİN - excalidraw'ı temizle
        }
      }
    }
  };
  const handleContextMenu = (e: React.MouseEvent, path: string, isDirectory: boolean) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, path, isDirectory });
  };

  const openModal = (type: 'note' | 'folder' | 'excalidraw', path: string) => {
    setModalType(type);
    setModalPath(path);
    setInputValue('');
    setShowModal(true);
    setContextMenu(null);
  };

  const handleCreate = async () => {
    if (!inputValue.trim()) return;
    
    let filePath: string;
    let initialContent: string;
    
    if (modalType === 'folder') {
      filePath = `${modalPath}/${inputValue}`;
      await window.electronAPI.createFolder(filePath);
    } else if (modalType === 'excalidraw') {
      const fileName = inputValue.endsWith('.excalidraw') ? inputValue : `${inputValue}.excalidraw`;
      filePath = `${modalPath}/${fileName}`;
      initialContent = JSON.stringify({
        type: "excalidraw",
        version: 2,
        source: "notes-vault",
        elements: [],
        appState: {
          viewBackgroundColor: "#1e1e1e",
          gridSize: 20,
          gridModeEnabled: false,
          theme: "dark"
        },
        files: {}
      }, null, 2);
      
      await window.electronAPI.createFile(filePath);
      await window.electronAPI.writeFile(filePath, initialContent);
      
      // Open excalidraw editor
      setCurrentExcalidraw({
        path: filePath,
        lastModified: new Date()
      });
      setCurrentNote(null);
    } else {
      const fileName = inputValue.endsWith('.md') ? inputValue : `${inputValue}.md`;
      filePath = `${modalPath}/${fileName}`;
      initialContent = `# ${inputValue}\n\n`;
      
      await window.electronAPI.createFile(filePath);
      await window.electronAPI.writeFile(filePath, initialContent);
      
      // Open the new note
      setCurrentNote({
        path: filePath,
        content: initialContent,
        lastModified: new Date()
      });
      setCurrentExcalidraw(null); // BUNU EKLEYİN
    }
    
    await loadFileTree();
    setShowModal(false);
  };

  const deleteFile = async (filePath: string) => {
    await window.electronAPI.deleteFile(filePath);
    if (currentNote?.path === filePath) {
      setCurrentNote(null);
    }
    await loadFileTree();
  };
  const deleteFolder = async (folderPath: string) => {
    const confirmed = window.confirm('');
    if (confirmed) {
      await window.electronAPI.deleteFile(folderPath);
      await loadFileTree();
    }
  };
  const handleRename = async () => {
    if (!renameModal || !inputValue.trim()) return;
    
    const dir = renameModal.path.substring(0, renameModal.path.lastIndexOf('/'));
    const extension = renameModal.isDirectory ? '' : renameModal.currentName.includes('.') ? renameModal.currentName.substring(renameModal.currentName.lastIndexOf('.')) : '.md';
    const newName = renameModal.isDirectory ? inputValue : (inputValue.includes('.') ? inputValue : `${inputValue}${extension}`);
    const newPath = `${dir}/${newName}`;
    
    const success = await window.electronAPI.renameFile(renameModal.path, newPath);
    if (success) {
      // Update current note path if it's the renamed file
      if (currentNote?.path === renameModal.path) {
        setCurrentNote({
          ...currentNote,
          path: newPath
        });
      }
      await loadFileTree();
    } else {
      alert('rename failed');
    }
    
    setRenameModal(null);
    setInputValue('');
  };  
    
  const moveFile = async (sourcePath: string, targetFolder: string) => {
    const fileName = sourcePath.split('/').pop();
    const targetPath = `${targetFolder}/${fileName}`;
    
    try {
      // Direkt rename kullan
      const success = await window.electronAPI.renameFile(sourcePath, targetPath);
      if (success) {
        // Update current note path if it's the moved file
        if (currentNote?.path === sourcePath) {
          setCurrentNote({
            ...currentNote,
            path: targetPath
          });
        }
        await loadFileTree();
        setMoveMode(null);
      } else {
        alert('error');
      }
    } catch (err) {
      console.error('Error moving file:', err);
      alert('errrrrrrr');
    }
  };
  // Simple encryption/decryption (for demonstration - use proper crypto in production)
  const encrypt = (text: string, password: string): string => {
    // Convert to UTF-8 bytes first to handle Unicode
    const textBytes = new TextEncoder().encode(text);
    const passwordBytes = new TextEncoder().encode(password);
    
    // XOR encryption
    const encrypted = new Uint8Array(textBytes.length);
    for (let i = 0; i < textBytes.length; i++) {
      encrypted[i] = textBytes[i] ^ passwordBytes[i % passwordBytes.length];
    }
    
    // Convert to base64
    return btoa(String.fromCharCode(...encrypted));
  };

  const decrypt = (encrypted: string, password: string): string => {
    try {
      // Decode from base64
      const encryptedBytes = new Uint8Array(
        atob(encrypted).split('').map(c => c.charCodeAt(0))
      );
      const passwordBytes = new TextEncoder().encode(password);
      
      // XOR decryption
      const decrypted = new Uint8Array(encryptedBytes.length);
      for (let i = 0; i < encryptedBytes.length; i++) {
        decrypted[i] = encryptedBytes[i] ^ passwordBytes[i % passwordBytes.length];
      }
      
      // Convert back to string
      return new TextDecoder().decode(decrypted);
    } catch {
      return '';
    }
  };

  const handlePasswordSubmit = async () => {
    if (!passwordModal || !password) return;

    const { path, mode } = passwordModal;
    
    if (mode === 'encrypt') {
      // Encrypt the note
      const content = await window.electronAPI.readFile(path);
      const encrypted = encrypt(content, password);
      await window.electronAPI.writeFile(path, `ENCRYPTED:${encrypted}`);
      setNoteEncrypted(path, true);
      
      // If current note, clear it
      if (currentNote?.path === path) {
        setCurrentNote(null);
      }
    } else if (mode === 'decrypt') {
      // Decrypt permanently
      const content = await window.electronAPI.readFile(path);
      if (content.startsWith('ENCRYPTED:')) {
        const encrypted = content.substring(10);
        const decrypted = decrypt(encrypted, password);
        if (decrypted) {
          // First verify it's actually decrypted properly
          if (decrypted.length > 0 && !decrypted.includes('\0')) {
            await window.electronAPI.writeFile(path, decrypted);
            setNoteEncrypted(path, false);
          } else {
            alert('x');
            return;
          }
        } else {
          alert('x');
          return;
        }
      }
    } else if (mode === 'access') {
      // Access encrypted note
      const content = await window.electronAPI.readFile(path);
      if (content.startsWith('ENCRYPTED:')) {
        const encrypted = content.substring(10);
        const decrypted = decrypt(encrypted, password);
        if (decrypted) {
          setCurrentNote({
            path,
            content: decrypted,
            lastModified: new Date()
          });
        } else {
          alert('x');
        }
      }
    }
    
    setPasswordModal(null);
    setPassword('');
    await loadFileTree();
  };

  const renderFileTree = (nodes: FileNode[], level = 0) => {
    return nodes.map(node => {
      return (
        <div key={node.path}>
        <div
          className={`flex items-center px-2 py-1 hover:bg-obsidian-bg-tertiary cursor-pointer rounded-sm group
            ${currentNote?.path === node.path ? 'bg-obsidian-bg-tertiary' : ''}`}
          style={{ paddingLeft: `${level * 12 + 8}px` }}
          onClick={() => handleFileClick(node)}
          onMouseDown={(e) => e.button === 1 && node.name.endsWith('.md') && handleFileClick(node, e)}
          onContextMenu={(e) => handleContextMenu(e, node.path, node.isDirectory)}
        >
            {node.isDirectory ? (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFolder(node.path);
                  }}
                  className="p-0.5 hover:bg-obsidian-bg rounded mr-1"
                >
                  {expandedFolders.has(node.path) ? (
                    <ChevronDown size={16} />
                  ) : (
                    <ChevronRight size={16} />
                  )}
                </button>
                <Folder size={16} className="mr-2 text-obsidian-accent" />
              </>
            ) : (
              <>
                <div className="w-4 mr-1" />
                {node.name.endsWith('.excalidraw') ? (
                  <Pen size={16} className="mr-2 text-obsidian-accent" />
                ) : (
                  <FileText size={16} className="mr-2 text-obsidian-text-muted" />
                )}
              </>
            )}
            <span className="text-sm truncate flex-1">{node.name.replace(/\.(md|excalidraw)$/, '')}</span>
            {!node.isDirectory && node.name.endsWith('.md') && encryptedNotes.has(node.path) && (
              <Lock size={12} className="text-obsidian-accent ml-1" />
            )}
          </div>
          {node.isDirectory && expandedFolders.has(node.path) && node.children && (
            <div>{renderFileTree(node.children, level + 1)}</div>
          )}
        </div>
      );
    });
  };

  return (
    <>
      <div className="h-full flex flex-col">
        {moveMode && (
          <div className="p-2 bg-obsidian-accent text-white text-xs">
            <div className="flex items-center justify-between">
              <span>
                <Move size={12} className="inline mr-1" />
                : {moveMode.name} :
              </span>
              <button
                onClick={() => setMoveMode(null)}
                className="hover:bg-obsidian-accent-hover px-1 rounded"
              >
                x
              </button>
            </div>
            <div className="mt-1 opacity-80"></div>
          </div>
        )}
        <div style={{ marginTop: '16px' }}></div>
        <div 
          className="flex-1 overflow-y-auto p-2"
            onContextMenu={(e) => {
              // Eğer hedef element boş alan ise
              if (e.target === e.currentTarget) {
                e.preventDefault();
                handleContextMenu(e, `${vaultPath}/Notes`, true);
              }
            }}
          >        
          {moveMode && (
            <div
              className="flex items-center px-2 py-1 mb-2 hover:bg-obsidian-bg-tertiary cursor-pointer rounded-sm border border-obsidian-accent"
              onClick={() => moveFile(moveMode.sourcePath, `${vaultPath}/Notes`)}
            >
              <Folder size={16} className="mr-2 text-obsidian-accent" />
              <span className="text-sm">Notes (Ana Klasör)</span>
            </div>
          )}
          {renderFileTree(fileTree)}
        </div>

        {/* Context Menu */}
        {contextMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setContextMenu(null)}
            />
            <div
              className="fixed z-50 bg-obsidian-bg-secondary border border-obsidian-border rounded-md shadow-lg py-1"
              style={{ left: contextMenu.x, top: contextMenu.y }}
            >
              <button
                className="flex items-center px-3 py-1.5 hover:bg-obsidian-bg-tertiary w-full text-left text-sm"
                onClick={() => {
                  const path = contextMenu.isDirectory ? contextMenu.path : contextMenu.path.substring(0, contextMenu.path.lastIndexOf('/'));
                  openModal('note', path);
                }}
              >
                <FileText size={14} className="mr-2" />
                Note
              </button>
              <button
                className="flex items-center px-3 py-1.5 hover:bg-obsidian-bg-tertiary w-full text-left text-sm"
                onClick={() => {
                  const path = contextMenu.isDirectory ? contextMenu.path : contextMenu.path.substring(0, contextMenu.path.lastIndexOf('/'));
                  openModal('excalidraw', path);
                }}
              >
                <Pen size={14} className="mr-2" />
                Excalidraw
              </button>
              {contextMenu.isDirectory && (
                <button
                  className="flex items-center px-3 py-1.5 hover:bg-obsidian-bg-tertiary w-full text-left text-sm"
                  onClick={() => openModal('folder', contextMenu.path)}
                >
                  <FolderPlus size={14} className="mr-2" />
                  
                </button>
              )}
                <button
                  className="flex items-center px-3 py-1.5 hover:bg-obsidian-bg-tertiary w-full text-left text-sm"
                  onClick={() => {
                    const name = contextMenu.path.split('/').pop() || '';
                    setRenameModal({
                      isOpen: true,
                      path: contextMenu.path,
                      currentName: name,
                      isDirectory: contextMenu.isDirectory
                    });
                    setInputValue(name.replace(/\.(md|excalidraw)$/, ''));
                    setContextMenu(null);
                  }}
                >
                  <Edit2 size={14} className="mr-2" />
                  Rename
                </button>

              <div className="border-t border-obsidian-border my-1" />
              {!contextMenu.isDirectory && contextMenu.path.endsWith('.md') && (
                <>
                  <button
                    className="flex items-center px-3 py-1.5 hover:bg-obsidian-bg-tertiary w-full text-left text-sm"
                    onClick={() => {
                      setMoveMode({ 
                        sourcePath: contextMenu.path, 
                        name: contextMenu.path.split('/').pop() || ''
                      });
                      setContextMenu(null);
                    }}
                  >
                    <Move size={14} className="mr-2" />
                    Move
                  </button>
                  {encryptedNotes.has(contextMenu.path) ? (
                    <button
                      className="flex items-center px-3 py-1.5 hover:bg-obsidian-bg-tertiary w-full text-left text-sm"
                      onClick={() => {
                        setPasswordModal({ isOpen: true, path: contextMenu.path, mode: 'decrypt' });
                        setContextMenu(null);
                      }}
                    >
                      <Unlock size={14} className="mr-2" />
                      Remove Pass
                    </button>
                  ) : (
                    <button
                      className="flex items-center px-3 py-1.5 hover:bg-obsidian-bg-tertiary w-full text-left text-sm"
                      onClick={() => {
                        setPasswordModal({ isOpen: true, path: contextMenu.path, mode: 'encrypt' });
                        setContextMenu(null);
                      }}
                    >
                      <Lock size={14} className="mr-2" />
                      Pass
                    </button>
                  )}
                  <div className="border-t border-obsidian-border my-1" />
                </>
              )}
              <button
                className="flex items-center px-3 py-1.5 hover:bg-obsidian-bg-tertiary w-full text-left text-sm text-obsidian-error"
                onClick={() => {
                  if (contextMenu.isDirectory) {
                    deleteFolder(contextMenu.path);
                  } else {
                    deleteFile(contextMenu.path);
                  }
                  setContextMenu(null);
                }}
              >
                <Trash2 size={14} className="mr-2" />
                Delete
              </button>
            </div>
          </>
        )}
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={
          modalType === 'folder' ? 'Folder' :
          modalType === 'excalidraw' ? 'Excalidraw' :
          'Note'
        }
      >
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          placeholder={
            modalType === 'folder' ? '' :
            modalType === 'excalidraw' ? '' :
            ''
          }
          className="w-full px-3 py-2 bg-obsidian-bg border border-obsidian-border rounded-md 
                     focus:outline-none focus:border-obsidian-accent text-sm"
          autoFocus
        />
        <div className="flex justify-end space-x-2 mt-4">
          <button
            onClick={() => setShowModal(false)}
            className="px-4 py-2 bg-obsidian-bg-tertiary hover:bg-obsidian-border 
                     rounded-md text-sm transition-colors"
          >
            x
          </button>
          <button
            onClick={handleCreate}
            className="px-4 py-2 bg-obsidian-accent hover:bg-obsidian-accent-hover 
                     text-white rounded-md text-sm transition-colors"
          >
            o
          </button>
        </div>
      </Modal>

      {/* Password Modal */}
      {passwordModal && (
        <Modal
          isOpen={passwordModal.isOpen}
          onClose={() => {
            setPasswordModal(null);
            setPassword('');
          }}
          title={
            passwordModal.mode === 'encrypt' ? 'Notu Şifrele' :
            passwordModal.mode === 'decrypt' ? 'Şifreyi Kaldır' :
            'Şifreli Not'
          }
        >
          <div className="space-y-4">
            <p className="text-sm text-obsidian-text-muted">
              {passwordModal.mode === 'encrypt' 
                ? ''
                : passwordModal.mode === 'decrypt'
                ? ''
                : ''}
            </p>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
              placeholder="Şifre..."
              className="w-full px-3 py-2 bg-obsidian-bg border border-obsidian-border rounded-md 
                       focus:outline-none focus:border-obsidian-accent text-sm"
              autoFocus
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setPasswordModal(null);
                  setPassword('');
                }}
                className="px-4 py-2 bg-obsidian-bg-tertiary hover:bg-obsidian-border 
                         rounded-md text-sm transition-colors"
              >
                x
              </button>
              <button
                onClick={handlePasswordSubmit}
                className="px-4 py-2 bg-obsidian-accent hover:bg-obsidian-accent-hover 
                         text-white rounded-md text-sm transition-colors"
              >
                {passwordModal.mode === 'encrypt' ? '' :
                 passwordModal.mode === 'decrypt' ? '' :
                 ''}
              </button>
            </div>
          </div>
        </Modal>
      )}
      {/* Rename Modal */}
      {renameModal && (
        <Modal
          isOpen={renameModal.isOpen}
          onClose={() => {
            setRenameModal(null);
            setInputValue('');
          }}
          title=""
        >
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRename()}
            placeholder=""
            className="w-full px-3 py-2 bg-obsidian-bg border border-obsidian-border rounded-md focus:outline-none focus:border-obsidian-accent"
            autoFocus
          />
          <div className="flex justify-end space-x-2 mt-4">
            <button
              onClick={() => {
                setRenameModal(null);
                setInputValue('');
              }}
              className="px-4 py-2 bg-obsidian-bg-tertiary hover:bg-obsidian-border rounded-md text-sm"
            >
              x
            </button>
            <button
              onClick={handleRename}
              className="px-4 py-2 bg-obsidian-accent hover:bg-obsidian-accent-hover text-white rounded-md text-sm"
            >
              o
            </button>
          </div>
        </Modal>
      )}      
    </>
  );
}

export default FileExplorer;