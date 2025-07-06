import { useState } from 'react';
import { Folder, ChevronRight, ChevronDown, FolderPlus, Trash2, Plus, Edit2 } from 'lucide-react';
import { useStore } from '../store';
import Modal from './Modal';
import '../App.css'

interface TaskFolder {
  id: string;
  name: string;
  parentId?: string;
  children?: TaskFolder[];
}

interface TaskFolderExplorerProps {
  selectedFolder: string | null;
  onSelectFolder: (folderId: string | null) => void;
}

function TaskFolderExplorer({ selectedFolder, onSelectFolder }: TaskFolderExplorerProps) {
  const { taskFolders, addTaskFolder, deleteTaskFolder, updateTaskFolder } = useStore();
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; folderId: string } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [modalParentId, setModalParentId] = useState<string | undefined>(undefined);
  const [renameModal, setRenameModal] = useState<{ isOpen: boolean; folderId: string; currentName: string } | null>(null);

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const handleContextMenu = (e: React.MouseEvent, folderId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, folderId });
  };

  const handleCreateFolder = async () => {
    if (!folderName.trim()) return;
    
    await addTaskFolder({
      name: folderName,
      parentId: modalParentId
    });
    
    setFolderName('');
    setShowModal(false);
    setModalParentId(undefined);
  };

  const handleRenameFolder = async () => {
    if (!renameModal || !folderName.trim()) return;
    
    await updateTaskFolder(renameModal.folderId, { name: folderName });
    
    setFolderName('');
    setRenameModal(null);
  };

  const renderFolderTree = (folders: TaskFolder[], level = 0) => {
    return folders.map(folder => (
      <div key={folder.id}>
        <div
          className={`flex items-center px-2 py-1 hover:bg-obsidian-bg-tertiary cursor-pointer rounded-sm
            ${selectedFolder === folder.id ? 'bg-obsidian-bg-tertiary' : ''}`}
          style={{ paddingLeft: `${level * 12 + 8}px` }}
          onClick={() => onSelectFolder(folder.id)}
          onContextMenu={(e) => handleContextMenu(e, folder.id)}
        >
          {folder.children && folder.children.length > 0 ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFolder(folder.id);
              }}
              className="p-0.5 hover:bg-obsidian-bg rounded mr-1"
            >
              {expandedFolders.has(folder.id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          ) : (
            <div className="w-5 mr-1" />
          )}
          <Folder size={16} className="mr-2 text-obsidian-accent" />
          <span className="text-sm truncate flex-1">{folder.name}</span>
        </div>
        {folder.children && expandedFolders.has(folder.id) && (
          <div>{renderFolderTree(folder.children, level + 1)}</div>
        )}
      </div>
    ));
  };

  // Build folder tree structure
  const buildFolderTree = (folders: typeof taskFolders): TaskFolder[] => {
    const folderMap = new Map<string, TaskFolder>();
    const rootFolders: TaskFolder[] = [];

    // First pass: create folder objects
    folders.forEach(folder => {
      folderMap.set(folder.id, { ...folder, children: [] });
    });

    // Second pass: build tree structure
    folders.forEach(folder => {
      const folderNode = folderMap.get(folder.id)!;
      if (folder.parentId) {
        const parent = folderMap.get(folder.parentId);
        if (parent) {
          parent.children!.push(folderNode);
        } else {
          rootFolders.push(folderNode);
        }
      } else {
        rootFolders.push(folderNode);
      }
    });

    return rootFolders;
  };

  const folderTree = buildFolderTree(taskFolders);

  return (
    <>
      <div className="h-full flex flex-col">
        <div className="flex-1 overflow-y-auto p-2 scrollbar-hide">
          {/* All Tasks */}
          <div
            className={`flex items-center px-2 py-1 mt-4 hover:bg-obsidian-bg-tertiary cursor-pointer rounded-sm
              ${selectedFolder === null ? 'bg-obsidian-bg-tertiary' : ''}`}
            onClick={() => onSelectFolder(null)}
          >
            <div className="w-5 mr-1" />
            <Folder size={16} className="mr-2 text-obsidian-accent" />
            <span className="text-sm">All</span>
          </div>
          

          
          {/* Folder Tree */}
          {renderFolderTree(folderTree)}
                    {/* Root folder creation hint */}
          <div
            className="flex items-center px-2 py-1 hover:bg-obsidian-bg-tertiary cursor-pointer rounded-sm text-obsidian-text-muted"
            onClick={() => {
              setModalParentId(undefined);
              setShowModal(true);
            }}
          >
            <Plus size={14} className="ml-auto mt-1 mb-1" />
            <span className="text-xs"></span>
          </div>
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
                  setModalParentId(contextMenu.folderId);
                  setShowModal(true);
                  setContextMenu(null);
                }}
              >
                <FolderPlus size={14} className="mr-2" />
                Folder
              </button>
              <button
                className="flex items-center px-3 py-1.5 hover:bg-obsidian-bg-tertiary w-full text-left text-sm"
                onClick={() => {
                  const folder = taskFolders.find(f => f.id === contextMenu.folderId);
                  if (folder) {
                    setRenameModal({
                      isOpen: true,
                      folderId: contextMenu.folderId,
                      currentName: folder.name
                    });
                    setFolderName(folder.name);
                  }
                  setContextMenu(null);
                }}
              >
                <Edit2 size={14} className="mr-2" />
                Rename
              </button>
              <button
                className="flex items-center px-3 py-1.5 hover:bg-obsidian-bg-tertiary w-full text-left text-sm text-obsidian-error"
                onClick={() => {
                  deleteTaskFolder(contextMenu.folderId);
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

      {/* Create Folder Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Folder"
      >
        <input
          type="text"
          value={folderName}
          onChange={(e) => setFolderName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
          placeholder=""
          className="w-full px-3 py-2 bg-obsidian-bg border border-obsidian-border rounded-md focus:outline-none focus:border-obsidian-accent"
          autoFocus
        />
        <div className="flex justify-end space-x-2 mt-4">
          <button
            onClick={() => {
              setShowModal(false);
              setFolderName('');
            }}
            className="px-4 py-2 bg-obsidian-bg-tertiary hover:bg-obsidian-border rounded-md text-sm"
          >
            x
          </button>
          <button
            onClick={handleCreateFolder}
            className="px-4 py-2 bg-obsidian-accent hover:bg-obsidian-accent-hover text-white rounded-md text-sm"
          >
            o
          </button>
        </div>
      </Modal>

      {/* Rename Folder Modal */}
      {renameModal && (
        <Modal
          isOpen={renameModal.isOpen}
          onClose={() => {
            setRenameModal(null);
            setFolderName('');
          }}
          title=""
        >
          <input
            type="text"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRenameFolder()}
            placeholder=""
            className="w-full px-3 py-2 bg-obsidian-bg border border-obsidian-border rounded-md focus:outline-none focus:border-obsidian-accent"
            autoFocus
          />
          <div className="flex justify-end space-x-2 mt-4">
            <button
              onClick={() => {
                setRenameModal(null);
                setFolderName('');
              }}
              className="px-4 py-2 bg-obsidian-bg-tertiary hover:bg-obsidian-border rounded-md text-sm"
            >
              x
            </button>
            <button
              onClick={handleRenameFolder}
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

export default TaskFolderExplorer;