import { useState, useEffect, useRef } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { useStore } from '../store';
import { Save } from 'lucide-react';
import './ExcalidrawEditor.css';

function ExcalidrawEditor() {
  const { currentExcalidraw, saveExcalidraw } = useStore();
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [initialData, setInitialData] = useState<any>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load file content
  useEffect(() => {
    if (!currentExcalidraw) return;
    
    const loadFile = async () => {
      try {
        console.log('Loading file:', currentExcalidraw.path);
        const content = await window.electronAPI.readFile(currentExcalidraw.path);
        const data = JSON.parse(content);
        
        // Clean up data
        if (data.appState && typeof data.appState.collaborators === 'object' && !Array.isArray(data.appState.collaborators)) {
          data.appState.collaborators = [];
        }
        
        console.log('Setting initial data');
        console.log('AppState from file:', data.appState);
        
        setInitialData({
          elements: data.elements || [],
          appState: {
            viewBackgroundColor: "#1e1e1e",
            theme: "dark",
            ...data.appState, // Spread last to override defaults
          },
          files: data.files || {}
        });
      } catch (error) {
        console.error('Error loading file:', error);
        setInitialData({
          elements: [],
          appState: {
            viewBackgroundColor: "#1e1e1e",
            theme: "dark"
          },
          files: {}
        });
      }
    };
    
    loadFile();
  }, [currentExcalidraw?.path]);

  const handleSave = async () => {
    if (!currentExcalidraw || !excalidrawAPI || isSaving) {
      console.log('Cannot save:', { 
        currentExcalidraw: !!currentExcalidraw, 
        excalidrawAPI: !!excalidrawAPI, 
        isSaving 
      });
      return;
    }

    console.log('Saving...');
    setIsSaving(true);
    
    try {
      const elements = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();
      const files = excalidrawAPI.getFiles();
      
      // Log what we're saving
      console.log('Saving state:', {
        elements: elements.length,
        gridModeEnabled: appState.gridModeEnabled,
        viewBackgroundColor: appState.viewBackgroundColor,
        zoom: appState.zoom
      });
      
      const data = {
        type: "excalidraw",
        version: 2,
        source: "notes-vault",
        elements: elements,
        appState: {
          viewBackgroundColor: appState.viewBackgroundColor || "#1e1e1e",
          currentItemStrokeColor: appState.currentItemStrokeColor,
          currentItemBackgroundColor: appState.currentItemBackgroundColor,
          currentItemFillStyle: appState.currentItemFillStyle,
          currentItemStrokeWidth: appState.currentItemStrokeWidth,
          currentItemStrokeStyle: appState.currentItemStrokeStyle,
          currentItemOpacity: appState.currentItemOpacity,
          currentItemFontFamily: appState.currentItemFontFamily,
          currentItemFontSize: appState.currentItemFontSize,
          currentItemTextAlign: appState.currentItemTextAlign,
          currentItemRoughness: appState.currentItemRoughness,
          currentItemRoundness: appState.currentItemRoundness,
          currentItemArrowType: appState.currentItemArrowType,
          currentItemEndArrowhead: appState.currentItemEndArrowhead,
          currentItemStartArrowhead: appState.currentItemStartArrowhead,
          zoom: appState.zoom,
          scrollX: appState.scrollX,
          scrollY: appState.scrollY,
          offsetLeft: appState.offsetLeft,
          offsetTop: appState.offsetTop,
          width: appState.width,
          height: appState.height,
          gridSize: appState.gridSize,
          gridModeEnabled: appState.gridModeEnabled,
          gridStep: appState.gridStep,
          theme: appState.theme || "dark",
          penMode: appState.penMode,
          zenModeEnabled: appState.zenModeEnabled,
          viewModeEnabled: appState.viewModeEnabled,
          exportScale: appState.exportScale,
          exportWithDarkMode: appState.exportWithDarkMode,
          exportEmbedScene: appState.exportEmbedScene,
          frameRendering: appState.frameRendering,
          objectsSnapModeEnabled: appState.objectsSnapModeEnabled,
          stats: appState.stats,
        },
        files: files || {}
      };

      const content = JSON.stringify(data, null, 2);
      await saveExcalidraw(content);
      console.log('Save completed');
    } catch (error) {
      console.error('Save error:', error);
      alert('Kaydetme hatası!');
    } finally {
      setIsSaving(false);
    }
  };

  // Manual onChange handler
  useEffect(() => {
    if (!excalidrawAPI) return;
    
    console.log('Setting up change detection');
    
    // Try direct onChange API
    const onChange = () => {
      console.log('Change detected via onChange');
      
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      
      saveTimeoutRef.current = setTimeout(() => {
        console.log('Auto-saving...');
        handleSave();
      }, 2000);
    };
    
    // Method 1: Direct onChange
    if (excalidrawAPI.onChange) {
      console.log('Using onChange API');
      const unsubscribe = excalidrawAPI.onChange(onChange);
      return () => {
        if (unsubscribe) unsubscribe();
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      };
    }
    
    // Method 2: Polling fallback
    console.log('Using polling fallback');
    let lastElements = JSON.stringify(excalidrawAPI.getSceneElements());
    let lastAppState = JSON.stringify(excalidrawAPI.getAppState());
    
    const interval = setInterval(() => {
      const currentElements = JSON.stringify(excalidrawAPI.getSceneElements());
      const currentAppState = JSON.stringify(excalidrawAPI.getAppState());
      
      if (currentElements !== lastElements || currentAppState !== lastAppState) {
        console.log('Change detected via polling');
        lastElements = currentElements;
        lastAppState = currentAppState;
        onChange();
      }
    }, 1000);
    
    return () => {
      clearInterval(interval);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [excalidrawAPI]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        e.stopPropagation();
        console.log('Ctrl+S pressed');
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [excalidrawAPI]);

  const handleExportPNG = async () => {
    if (!excalidrawAPI) return;

    try {
      const blob = await excalidrawAPI.exportToBlob({
        mimeType: 'image/png',
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = currentExcalidraw?.path.split('/').pop()?.replace('.excalidraw', '.png') || 'drawing.png';
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting PNG:', error);
    }
  };

  if (!currentExcalidraw || !initialData) return null;

  return (
    <div className="h-full excalidraw-wrapper">
      <Excalidraw
        key={currentExcalidraw.path}
        excalidrawAPI={(api) => {
          console.log('Excalidraw API received');
          setExcalidrawAPI(api);
          (window as any).excalidrawAPI = api;
        }}
        theme="dark"
        initialData={initialData}
        onChange={() => {
          console.log('onChange prop triggered');
          if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
          }
          saveTimeoutRef.current = setTimeout(() => {
            console.log('Auto-saving from onChange prop...');
            handleSave();
          }, 2000);
        }}
      />
    </div>
  );
}

export default ExcalidrawEditor;