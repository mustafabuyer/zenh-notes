import { useEffect, useState, useCallback, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView } from '@codemirror/view';
import { useStore } from '../store';
import MarkdownRenderer from './MarkdownRenderer';
import EditorContextMenu from './EditorContextMenu';

function NoteEditor() {
  const { currentNote, saveNote, setCurrentNote } = useStore();
  const [content, setContent] = useState('');
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const editorRef = useRef<any>(null);

  useEffect(() => {
    if (currentNote) {
      setContent(currentNote.content);
      setIsPreviewMode(false); // Reset to edit mode when opening new note
    }
  }, [currentNote]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + E for preview toggle
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        setIsPreviewMode(prev => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Image paste handler
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (isPreviewMode) return; // Don't handle paste in preview mode
      
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) continue;

          // Get vault path and create attachments folder
          const vaultPath = await window.electronAPI.getVaultPath();
          const timestamp = Date.now();
          const fileName = `image-${timestamp}.png`;
          const imagePath = `${vaultPath}/Attachments/${fileName}`;
          
          // Convert to base64
          const reader = new FileReader();
          reader.onload = async () => {
            const base64 = reader.result as string;
            
            // Save image to attachments folder
            try {
              // Create attachments folder if not exists
              await window.electronAPI.createFolder(`${vaultPath}/Attachments`);
              
              // Convert base64 to buffer and save
              const base64Data = base64.split(',')[1];
              await window.electronAPI.writeFile(imagePath, base64Data, 'base64');
              
              // Add markdown image reference using absolute file:// URL
              const absolutePath = `file://${imagePath}`;
              const imageMarkdown = `\n![Image](${absolutePath})\n`;
              const newContent = content + imageMarkdown;
              setContent(newContent);
              saveNote(newContent);
            } catch (err) {
              console.error('Error saving image:', err);
              // Fallback to base64 embed
              const imageMarkdown = `\n![Image](${base64})\n`;
              const newContent = content + imageMarkdown;
              setContent(newContent);
              saveNote(newContent);
            }
          };
          reader.readAsDataURL(file);
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [content, saveNote, isPreviewMode]);

  // Auto-save
  useEffect(() => {
    if (!currentNote || isPreviewMode) return;
    
    const timeoutId = setTimeout(async () => {
      if (content !== currentNote.content) {
        await saveNote(content);
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [content, currentNote, saveNote, isPreviewMode]);

  // Internal link handler
  const handleInternalLink = async (linkText: string) => {
    const noteName = linkText;
    const vaultPath = await window.electronAPI.getVaultPath();
    
    // First try exact match
    let notePath = `${vaultPath}/Notes/${noteName}.md`;
    
    try {
      const content = await window.electronAPI.readFile(notePath);
      setCurrentNote({
        path: notePath,
        content,
        lastModified: new Date()
      });
      return;
    } catch {
      // Exact match not found, search in subdirectories
      const searchInDirectory = async (dirPath: string): Promise<string | null> => {
        const files = await window.electronAPI.readDirectory(dirPath);
        
        for (const file of files) {
          if (file.isDirectory) {
            const result = await searchInDirectory(file.path);
            if (result) return result;
          } else if (file.name === `${noteName}.md`) {
            return file.path;
          }
        }
        return null;
      };
      
      const foundPath = await searchInDirectory(`${vaultPath}/Notes`);
      if (foundPath) {
        const content = await window.electronAPI.readFile(foundPath);
        setCurrentNote({
          path: foundPath,
          content,
          lastModified: new Date()
        });
      } else {
        // Note not found, create new
        const newPath = `${vaultPath}/Notes/${noteName}.md`;
        const newContent = `# ${noteName}\n\n`;
        await window.electronAPI.createFile(newPath);
        await window.electronAPI.writeFile(newPath, newContent);
        setCurrentNote({
          path: newPath,
          content: newContent,
          lastModified: new Date()
        });
      }
    }
  };

  const handleOpenInNewWindow = () => {
    if (!currentNote) return;
    
    // Send message to main process to open new window
    window.electronAPI.openNoteWindow({
      path: currentNote.path,
      content: content, // Current content (may have unsaved changes)
      title: currentNote.path.split('/').pop()?.replace('.md', '') || 'Note'
    });
  };

  const handleRunScript = async (script: string): Promise<string> => {
    try {
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      const func = new AsyncFunction(script);
      const result = await func();
      return result?.toString() || '';
    } catch (error: any) {
      return `Error: ${error.message}`;
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!isPreviewMode) {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY });
    }
  };

  const handleContextMenuAction = (action: string, value?: string) => {
    const view = editorRef.current?.view;
    if (!view) return;

    const { from, to } = view.state.selection.main;
    const selectedText = view.state.doc.sliceString(from, to);

    let newText = '';
    if (action === 'custom' && value) {
      newText = value.replace('{selection}', selectedText);
    } else {
      switch (action) {
        case 'bold': newText = `**${selectedText}**`; break;
        case 'italic': newText = `*${selectedText}*`; break;
        case 'code': newText = `\`${selectedText}\``; break;
        case 'link': newText = `[${selectedText}](url)`; break;
        case 'bullet': newText = `- ${selectedText}`; break;
        case 'number': newText = `1. ${selectedText}`; break;
        case 'quote': newText = `> ${selectedText}`; break;
        case 'h1': newText = `# ${selectedText}`; break;
        case 'h2': newText = `## ${selectedText}`; break;
        case 'h3': newText = `### ${selectedText}`; break;
      }
    }

    const transaction = view.state.update({
      changes: { from, to, insert: newText },
      selection: { anchor: from + newText.length }
    });
    view.dispatch(transaction);
    view.focus();
  };

  const handlePreviewClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    
    // Handle internal links
    if (target.tagName === 'A' && target.getAttribute('href')?.startsWith('#internal:')) {
      e.preventDefault();
      const linkText = target.getAttribute('href')?.replace('#internal:', '') || '';
      handleInternalLink(linkText);
    }
    
    // Handle checkboxes
    if (target.tagName === 'INPUT' && target.getAttribute('type') === 'checkbox') {
      const index = parseInt(target.getAttribute('data-index') || '0');
      const lines = content.split('\n');
      if (lines[index]?.includes('- [ ]')) {
        lines[index] = lines[index].replace('- [ ]', '- [x]');
      } else if (lines[index]?.includes('- [x]')) {
        lines[index] = lines[index].replace('- [x]', '- [ ]');
      }
      const newContent = lines.join('\n');
      setContent(newContent);
      saveNote(newContent);
    }
  };

  if (!currentNote) {
    return (
      <div className="h-full flex items-center justify-center text-obsidian-text-muted">
        <p>Select a note to edit</p>
      </div>
    );
  }

  // Editor extensions
  const extensions = [
    markdown(),
    EditorView.theme({
      '&': { height: '100%' },
      '.cm-content': { 
        padding: '16px 24px',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '14px',
        lineHeight: '1.6'
      },
      '.cm-focused .cm-cursor': { borderLeftColor: '#7c3aed' },
      '.cm-line': { padding: '0 2px' }
    }),
    EditorView.domEventHandlers({
      click: (e, view) => {
        const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
        if (pos !== null) {
          const line = view.state.doc.lineAt(pos);
          const lineText = line.text;
          
          // Check if clicked on internal link
          const linkRegex = /\[\[([^\]]+)\]\]/g;
          let match;
          while ((match = linkRegex.exec(lineText)) !== null) {
            const start = line.from + match.index;
            const end = start + match[0].length;
            if (pos >= start && pos <= end) {
              e.preventDefault();
              handleInternalLink(match[1]);
              return true;
            }
          }
          
          // Check if clicked on a task checkbox line
          if (lineText.includes('- [ ]') || lineText.includes('- [x]')) {
            const lineNumber = view.state.doc.lineAt(pos).number - 1;
            const lines = view.state.doc.toString().split('\n');
            const line = lines[lineNumber];
            
            if (line.includes('- [ ]')) {
              lines[lineNumber] = line.replace('- [ ]', '- [x]');
            } else if (line.includes('- [x]')) {
              lines[lineNumber] = line.replace('- [x]', '- [ ]');
            }
            
            const newContent = lines.join('\n');
            setContent(newContent);
            saveNote(newContent);
          }
        }
      }
    })
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Editor or Preview */}
      <div className="flex-1 overflow-auto" onContextMenu={handleContextMenu}>
        {isPreviewMode ? (
          <div 
            className="p-6 max-w-4xl mx-auto"
            onClick={handlePreviewClick}
          >
            <MarkdownRenderer content={content} onRunScript={handleRunScript} />
          </div>
        ) : (
          <CodeMirror
            ref={editorRef}
            value={content}
            onChange={(value) => setContent(value)}
            theme={oneDark}
            extensions={extensions}
            height="100%"
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
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && !isPreviewMode && (
        <EditorContextMenu
          position={contextMenu}
          onClose={() => setContextMenu(null)}
          onAction={handleContextMenuAction}
        />
      )}
    </div>
  );
}

export default NoteEditor;