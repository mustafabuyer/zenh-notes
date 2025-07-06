import { useState, useRef, useEffect } from 'react';
import { CheckCircle, Circle, ChevronDown, ChevronRight, Trash2, Plus, Flag, Calendar, Move } from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView } from '@codemirror/view';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useStore, Task } from '../store';
import MarkdownRenderer from './MarkdownRenderer';
import Modal from './Modal';

interface TaskItemProps {
  task: Task;
  level?: number;
}

function TaskItem({ task, level = 0 }: TaskItemProps) {
  const { toggleTask, deleteTask, updateTaskContent, addSubtask, toggleTaskExpanded, updateTask, taskFolders } = useStore();

  const [isEditingContent, setIsEditingContent] = useState(false);
  const [content, setContent] = useState(task.content || '');
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [showAddSubtask, setShowAddSubtask] = useState(false);

  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(task.folderId || null);

  const contentRef = useRef<HTMLDivElement>(null);

  // Right click context menu
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  // Paste image handler
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (!isEditingContent) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) continue;
          const reader = new FileReader();
          reader.onload = () => {
            const base64 = reader.result as string;
            setContent(prev => prev + `\n![Pasted image](${base64})\n`);
          };
          reader.readAsDataURL(file);
        }
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [isEditingContent]);

  const handleAddSubtask = async () => {
    if (!newSubtaskTitle.trim()) return;
    await addSubtask(task.id, {
      title: newSubtaskTitle,
      completed: false,
      date: task.date
    });
    setNewSubtaskTitle('');
    setShowAddSubtask(false);
  };

  const handleSaveContent = async () => {
    await updateTaskContent(task.id, content);
    setIsEditingContent(false);
  };

  const handleRunScript = async (code: string): Promise<string> => {
    try {
      const result = await window.electronAPI.execCommand(code);
      if (result.success) {
        return result.output || 'Komut başarıyla çalıştırıldı';
      } else {
        return `Hata: ${result.error}`;
      }
    } catch (err) {
      return `Script çalıştırılamadı: ${err}`;
    }
  };

  const handleMoveTask = async () => {
    await updateTask(task.id, { folderId: selectedFolderId || undefined });
    setShowMoveModal(false);
    setShowContextMenu(false);
  };

  const getPriorityColor = (priority?: 'P1' | 'P2' | 'P3') => {
    switch (priority) {
      case 'P1': return 'text-obsidian-error';
      case 'P2': return 'text-yellow-500';
      case 'P3': return 'text-blue-400';
      default: return '';
    }
  };

  // Build folder tree for move modal
  const buildFolderTree = (folders: typeof taskFolders, parentId?: string): typeof taskFolders => {
    return folders
      .filter(f => f.parentId === parentId)
      .map(folder => ({
        ...folder,
        children: buildFolderTree(folders, folder.id)
      }));
  };

  const renderFolderOptions = (folders: typeof taskFolders, level = 0): JSX.Element[] => {
    const result: JSX.Element[] = [];
    
    folders.forEach(folder => {
      result.push(
        <div
          key={folder.id}
          className={`flex items-center px-3 py-2 hover:bg-obsidian-bg-tertiary cursor-pointer rounded-sm
            ${selectedFolderId === folder.id ? 'bg-obsidian-bg-tertiary' : ''}`}
          style={{ paddingLeft: `${level * 20 + 12}px` }}
          onClick={() => setSelectedFolderId(folder.id)}
        >
          <input
            type="radio"
            checked={selectedFolderId === folder.id}
            onChange={() => setSelectedFolderId(folder.id)}
            className="mr-2"
          />
          <span className="text-sm">{folder.name}</span>
        </div>
      );
      
      if (folder.children) {
        result.push(...renderFolderOptions(folder.children, level + 1));
      }
    });
    
    return result;
  };

  return (
    <div className={`${level > 0 ? 'ml-6 mt-2' : 'mb-3'}`}>
      <div
        className="bg-obsidian-bg-secondary rounded-md p-3 hover:bg-obsidian-bg-tertiary transition-colors"
        onContextMenu={handleContextMenu}
      >
        <div className="flex items-start space-x-2">
          {/* Expand/collapse */}
          {task.subtasks && task.subtasks.length > 0 && (
            <button
              onClick={() => toggleTaskExpanded(task.id)}
              className="p-0.5 hover:bg-obsidian-bg rounded mt-0.5"
            >
              {task.expanded
                ? <ChevronDown size={16} />
                : <ChevronRight size={16} />}
            </button>
          )}

          {/* Checkbox */}
          <button onClick={() => toggleTask(task.id)} className="mt-0.5">
            {task.completed
              ? <CheckCircle size={18} className="text-green-500" />
              : <Circle size={18} className="text-obsidian-text-muted" />}
          </button>

          {/* Content */}
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <span className={`${task.completed ? 'line-through text-obsidian-text-muted' : ''}`}>
                {task.title}
              </span>
              {task.priority && (
                <Flag size={14} className={getPriorityColor(task.priority)} />
              )}
              {task.date && (
                <div className="flex items-center text-xs text-obsidian-text-muted">
                  <Calendar size={12} className="mr-1" />
                  {format(new Date(task.date), 'd MMM', { locale: tr })}
                </div>
              )}
            </div>

            {/* Content editor */}
            {isEditingContent ? (
              <div className="mt-2">
                <CodeMirror
                  value={content}
                  onChange={(value) => setContent(value)}
                  theme={oneDark}
                  extensions={[markdown(), EditorView.lineWrapping]}
                  height="200px"
                  basicSetup={{
                    lineNumbers: false,
                    foldGutter: false,
                    dropCursor: false,
                    allowMultipleSelections: false,
                    indentOnInput: true,
                    bracketMatching: true,
                    closeBrackets: true,
                    autocompletion: true,
                    rectangularSelection: false,
                    crosshairCursor: false,
                    highlightSelectionMatches: false,
                    searchKeymap: true,
                  }}
                />
                <div className="flex space-x-2 mt-2">
                  <button onClick={handleSaveContent} className="px-3 py-1 text-xs bg-obsidian-accent text-white rounded hover:bg-obsidian-accent-hover">
                    Kaydet
                  </button>
                  <button onClick={() => setIsEditingContent(false)} className="px-3 py-1 text-xs bg-obsidian-bg-tertiary rounded hover:bg-obsidian-border">
                    İptal
                  </button>
                </div>
              </div>
            ) : (
              content ? (
                <div onClick={() => setIsEditingContent(true)} className="mt-2 p-2 bg-obsidian-bg rounded cursor-pointer hover:bg-obsidian-bg-tertiary">
                  <MarkdownRenderer content={content} onRunScript={handleRunScript} />
                </div>
              ) : (
                <button onClick={() => setIsEditingContent(true)} className="mt-2 text-xs text-obsidian-text-muted hover:text-obsidian-text">
                  + Not/Açıklama/Script ekle
                </button>
              )
            )}

            {/* Add subtask */}
            {showAddSubtask ? (
              <div className="mt-2 flex space-x-2">
                <input
                  type="text"
                  value={newSubtaskTitle}
                  onChange={e => setNewSubtaskTitle(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddSubtask()}
                  placeholder="Alt görev..."
                  className="flex-1 px-2 py-1 text-sm bg-obsidian-bg border border-obsidian-border rounded focus:outline-none focus:border-obsidian-accent"
                  autoFocus
                />
                <button onClick={handleAddSubtask} className="px-2 py-1 text-sm bg-obsidian-accent text-white rounded hover:bg-obsidian-accent-hover">
                  Ekle
                </button>
                <button onClick={() => setShowAddSubtask(false)} className="px-2 py-1 text-sm bg-obsidian-bg-tertiary rounded hover:bg-obsidian-border">
                  İptal
                </button>
              </div>
            ) : (
              <button onClick={() => setShowAddSubtask(true)} className="mt-2 text-xs text-obsidian-text-muted hover:text-obsidian-text flex items-center">
                <Plus size={12} className="mr-1" />
                Alt görev ekle
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Subtasks */}
      {task.expanded && task.subtasks && (
        <div className="mt-1">
          {task.subtasks.map(sub => <TaskItem key={sub.id} task={sub} level={level + 1} />)}
        </div>
      )}

      {/* Context Menu */}
      {showContextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowContextMenu(false)} />
          <div
            className="fixed z-50 bg-obsidian-bg-secondary border border-obsidian-border rounded-md shadow-lg py-1"
            style={{ left: contextMenuPos.x, top: contextMenuPos.y }}
          >
            <button
              className="flex items-center px-3 py-1.5 hover:bg-obsidian-bg-tertiary w-full text-left text-sm"
              onClick={() => {
                setShowMoveModal(true);
                setShowContextMenu(false);
              }}
            >
              <Move size={14} className="mr-2" />
              Başka Klasöre Taşı
            </button>
            <button
              className="flex items-center px-3 py-1.5 hover:bg-obsidian-bg-tertiary w-full text-left text-sm text-obsidian-error"
              onClick={() => {
                deleteTask(task.id);
                setShowContextMenu(false);
              }}
            >
              <Trash2 size={14} className="mr-2" />
              Sil
            </button>
          </div>
        </>
      )}

      {/* Move Modal */}
      <Modal
        isOpen={showMoveModal}
        onClose={() => {
          setShowMoveModal(false);
          setSelectedFolderId(task.folderId || null);
        }}
        title="Görevi Taşı"
      >
        <div className="max-h-96 overflow-y-auto">
          <div
            className={`flex items-center px-3 py-2 hover:bg-obsidian-bg-tertiary cursor-pointer rounded-sm
              ${selectedFolderId === null ? 'bg-obsidian-bg-tertiary' : ''}`}
            onClick={() => setSelectedFolderId(null)}
          >
            <input
              type="radio"
              checked={selectedFolderId === null}
              onChange={() => setSelectedFolderId(null)}
              className="mr-2"
            />
            <span className="text-sm font-medium">Ana Klasör</span>
          </div>
          
          {renderFolderOptions(buildFolderTree(taskFolders))}
        </div>
        
        <div className="flex justify-end space-x-2 mt-4">
          <button
            onClick={() => {
              setShowMoveModal(false);
              setSelectedFolderId(task.folderId || null);
            }}
            className="px-4 py-2 bg-obsidian-bg-tertiary hover:bg-obsidian-border rounded-md text-sm"
          >
            İptal
          </button>
          <button
            onClick={handleMoveTask}
            className="px-4 py-2 bg-obsidian-accent hover:bg-obsidian-accent-hover text-white rounded-md text-sm"
          >
            Taşı
          </button>
        </div>
      </Modal>
    </div>
  );
}

export default TaskItem;