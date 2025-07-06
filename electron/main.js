const { app, BrowserWindow, ipcMain, protocol, globalShortcut, Tray, Menu } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs'); // Add this line for sync operations
const { exec } = require('child_process');
const Store = require('electron-store');
const simpleGit = require('simple-git');

const store = new Store.default ? new Store.default() : new Store();
const isDev = !app.isPackaged;

let mainWindow;
let searchWindow;
let tray;
let noteWindows = new Map();

// Default vault folder
const getVaultPath = () => {
  return store.get('vaultPath', path.join(app.getPath('documents'), 'NotesVault'));
};

// Git instance
let git;

// Initialize vault
async function initializeVault() {
  const vaultPath = getVaultPath();
  const dirs = [
    vaultPath,
    path.join(vaultPath, '.app'),
    path.join(vaultPath, 'Notes'),
    path.join(vaultPath, 'Notes', 'Daily'),
    path.join(vaultPath, 'Notes', 'Projects'),
    path.join(vaultPath, 'Attachments')
  ];

  for (const dir of dirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (err) {
      console.error(`Error creating directory ${dir}:`, err);
    }
  }

  // Create initial README
  // const readmePath = path.join(vaultPath, 'Notes', 'README.md');
  // try {
  //   await fs.access(readmePath);
  // } catch {
  //   await fs.writeFile(readmePath, '# Notes Vault\n\nHoş geldin! 🎉\n\n## Başlangıç\n\n- Sol panelden  not oluşturabilirsin\n- `[[Not Adı]]` şeklinde internal linkler kullanabilirsin\n- Görevler sekmesinden günlük görevlerini yönetebilirsin\n');
  // }

  // Initialize git instance
  git = simpleGit(vaultPath);

  // Save app settings to vault
  await saveSettingsToVault();
}

// Save app settings to vault for syncing
async function saveSettingsToVault() {
  const vaultPath = getVaultPath();
  const settingsPath = path.join(vaultPath, '.app', 'settings.json');
  
  const settings = {
    vaultPath: vaultPath,
    customColors: store.get('customColors', null),
    // Add other settings here as needed
  };

  try {
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
  } catch (err) {
    console.error('Error saving settings:', err);
  }
}

// Load settings from vault
async function loadSettingsFromVault() {
  const vaultPath = getVaultPath();
  const settingsPath = path.join(vaultPath, '.app', 'settings.json');
  
  try {
    const content = await fs.readFile(settingsPath, 'utf-8');
    const settings = JSON.parse(content);
    
    if (settings.customColors) {
      store.set('customColors', settings.customColors);
    }
    
    return settings;
  } catch (err) {
    return null;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    show: false, // Don't show on startup
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false // Allow file:// protocol
    },
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#1e1e1e',
      symbolColor: '#ffffff',
      height: 30
    },
    backgroundColor: '#1e1e1e'
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    //mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Eğer --hidden parametresi yoksa pencereyi göster
  if (!process.argv.includes('--hidden')) {
    mainWindow.once('ready-to-show', () => {
      mainWindow.show();
    });
  }
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

}

function createSearchWindow() {
  searchWindow = new BrowserWindow({
    width: 600,
    height: 60,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    movable: true,
    show: false,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false
    },
    backgroundColor: '#1e1e1e',
    transparent: true

  });

  // Load the search bar HTML
  const searchHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          background-color: #1e1e1e;
          color: #d4d4d4;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          overflow: hidden;
          border-radius: 8px;
          -webkit-app-region: drag;
        }
        
        .search-container {
          background-color: #262626;
          border: 1px solid #3e3e3e;
          border-radius: 8px;
          padding: 8px 12px;
          display: flex;
          align-items: center;
          height: 60px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        }
        
        input {
          background: transparent;
          border: none;
          outline: none;
          color: #d4d4d4;
          font-size: 16px;
          width: 100%;
          margin-left: 8px;
          -webkit-app-region: no-drag;
        }
        
        input::placeholder {
          color: #808080;
        }
        
        .search-icon {
          color: #808080;
          width: 20px;
          height: 20px;
          flex-shrink: 0;
        }
        
        .status-icon {
          position: absolute;
          right: 16px;
          top: 50%;
          transform: translateY(-50%);
          width: 20px;
          height: 20px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
        }
        
        .status-icon.success {
          background-color: #10b981;
        }
        
        .status-icon.error {
          background-color: #ef4444;
        }
        
        .hidden {
          display: none;
        }
      </style>
    </head>
    <body>
      <div class="search-container">
        <input type="text" id="searchInput" placeholder="" autofocus>
        <div id="statusIcon" class="status-icon hidden">
          <svg width="12" height="12" fill="white" viewBox="0 0 24 24">
            <path id="statusPath" d=""></path>
          </svg>
        </div>
      </div>
      <script>
        const input = document.getElementById('searchInput');
        const statusIcon = document.getElementById('statusIcon');
        const statusPath = document.getElementById('statusPath');
        let statusTimeout;
        let isInteracting = false;
        let isFocused = false;
        
        // Focus on show
        window.electronAPI.onSearchWindowShow(() => {
          isFocused = true;
          isInteracting = true;
          input.focus();
          input.select();
          setTimeout(() => {
            input.focus(); // Double focus to ensure it works
          }, 50);
        });
        
        function showStatus(type) {
          statusIcon.classList.remove('hidden');
          statusIcon.classList.remove('success', 'error');
          statusIcon.classList.add(type);
          
          if (type === 'success') {
            statusPath.setAttribute('d', 'M20 6L9 17l-5-5');
          } else {
            statusPath.setAttribute('d', 'M6 18L18 6M6 6l12 12');
          }
          
          clearTimeout(statusTimeout);
          statusTimeout = setTimeout(() => {
            statusIcon.classList.add('hidden');
          }, 2000);
        }
        
        // Track focus state
        input.addEventListener('focus', () => {
          isFocused = true;
          isInteracting = true;
        });
        
        input.addEventListener('blur', () => {
          isFocused = false;
          // Delay check to allow for clicks
          setTimeout(() => {
            if (!isInteracting && !isFocused) {
              window.electronAPI.hideSearchWindow();
            }
          }, 300);
        });
        
        // Track mouse interaction
        document.addEventListener('mousedown', (e) => {
          isInteracting = true;
        });
        
        document.addEventListener('mouseup', (e) => {
          setTimeout(() => {
            isInteracting = false;
            // Check if we should hide
            if (!isFocused) {
              setTimeout(() => {
                if (!isInteracting && !isFocused) {
                  window.electronAPI.hideSearchWindow();
                }
              }, 300);
            }
          }, 100);
        });
        
        input.addEventListener('keydown', async (e) => {
          if (e.key === 'Enter') {
            const query = input.value.trim();
            
            if (query.startsWith(':')) {
              // Send webhook
              const message = query.substring(1).trim();
              if (message) {
                try {
                  const response = await fetch('http://n8n.zakrom.com:5678/webhook/input', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'text/plain',
                    },
                    body: message,
                  });
                  
                  if (response.ok) {
                    showStatus('success');
                    input.value = '';
                  } else {
                    showStatus('error');
                  }
                } catch (error) {
                  console.error('Webhook error:', error);
                  showStatus('error');
                }
              }
            } else if (query) {
              // Search for notes
              window.electronAPI.quickSearch(query);
              window.electronAPI.hideSearchWindow();
            }
          } else if (e.key === 'Escape') {
            window.electronAPI.hideSearchWindow();
          }
        });
      </script>      
    </body>
    </html>
  `;
  
  searchWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(searchHtml)}`);
  
  // Handle window closed
  searchWindow.on('closed', () => {
    searchWindow = null;
  });
}

function createTray() {
  let iconPath;
  
  if (isDev) {
    iconPath = path.join(__dirname, '../build-resources/icon-tray.png');
  } else {
    iconPath = path.join(process.resourcesPath, 'icon-tray.png');
  }
  
  // Check if icon exists, otherwise create a simple one
  if (!require('fs').existsSync(iconPath)) {
    // Create a simple white dot icon in memory
    const { nativeImage } = require('electron');
    const size = 32;
    const buffer = Buffer.alloc(size * size * 4);
    
    // Fill with transparent background and white circle
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        const dx = x - size/2;
        const dy = y - size/2;
        const distance = Math.sqrt(dx*dx + dy*dy);
        
        if (distance < size/2 * 0.7) {
          buffer[idx] = 255;     // R
          buffer[idx + 1] = 255; // G
          buffer[idx + 2] = 255; // B
          buffer[idx + 3] = 255; // A
        } else {
          buffer[idx + 3] = 0;   // Transparent
        }
      }
    }
    
    const image = nativeImage.createFromBuffer(buffer, { width: size, height: size });
    tray = new Tray(image);
  } else {
    tray = new Tray(iconPath);
  }  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Hızlı Ara (Super + +)',
      click: () => toggleSearchWindow()
    },
    {
      label: 'Ana Pencereyi Göster',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Çıkış',
      click: () => {
        app.isQuitting = true;
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.destroy();
        }
        app.quit();
      }
    }
  ]);
  
  tray.setToolTip('Notes Vault');
  tray.setContextMenu(contextMenu);
  
  // Double click to show search
  tray.on('double-click', () => {
    toggleSearchWindow();
  });
}

function toggleSearchWindow() {
  if (!searchWindow) {
    createSearchWindow();
  }
  
  if (searchWindow.isVisible()) {
    searchWindow.hide();
  } else {
    // Get cursor position and show window near it
    const { screen } = require('electron');
    const cursorPoint = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(cursorPoint);
    
    // Center the window on the current display
    const x = Math.round(display.bounds.x + (display.bounds.width - 600) / 2);
    const y = Math.round(display.bounds.y + (display.bounds.height - 60) / 3);
    
    searchWindow.setPosition(x, y);
    searchWindow.show();
    searchWindow.focus();
    
    // Force focus after a small delay to ensure window is ready
    setTimeout(() => {
      searchWindow.focus();
      searchWindow.webContents.send('show-search-window');
    }, 100);
  }
}
// Enable auto-launch
function setAutoLaunch(enable) {
  app.setLoginItemSettings({
    openAtLogin: enable,
    openAsHidden: true
  });
}

app.whenReady().then(async () => {
  // Enable auto-launch
  setAutoLaunch(true);
  
  // Initialize vault
  await initializeVault();
  await loadSettingsFromVault();
  
  // Create windows
  createWindow();
  createSearchWindow();
  createTray();

  const triggerFile = '/tmp/notes-vault-trigger';

  // Create the trigger file if it doesn't exist
  fsSync.writeFileSync(triggerFile, '');

  // Watch for changes
  fsSync.watchFile(triggerFile, { interval: 100 }, (curr, prev) => {
    if (curr.mtime > prev.mtime) {
      // File was modified
      fsSync.readFile(triggerFile, 'utf8', (err, data) => {
        if (!err && data.trim() === 'toggle-search') {
          toggleSearchWindow();
          // Clear the file
          fsSync.writeFileSync(triggerFile, '');
        }
      });
    }
  });
// Register global shortcut (Super/Win + Plus)
  const shortcuts = [
    'Super+kp_add',         // Numpad plus (for your keyboard)
    'CommandOrControl+kp_add',  // Alternative with Ctrl
    'Super+KP_Add',         // Alternative capitalization
    'CommandOrControl+Shift+Space',  // Universal fallback
    'CommandOrControl+Shift+K',      // Alternative
    'CommandOrControl+Alt+S',        // Search
  ];  
  let shortcutRegistered = false;
  let registeredShortcut = '';
  
  for (const shortcut of shortcuts) {
    try {
      const ret = globalShortcut.register(shortcut, () => {
        toggleSearchWindow();
      });
      
      if (ret) {
        shortcutRegistered = true;
        registeredShortcut = shortcut;
        console.log(`Global shortcut registered: ${shortcut}`);
        break;
      }
    } catch (error) {
      console.log(`Failed to register ${shortcut}:`, error);
    }
  }
  
  if (!shortcutRegistered) {
    console.log('Could not register any global shortcut. You can still use the tray icon.');
    // Update tray menu to show this
    if (tray) {
      const contextMenu = Menu.buildFromTemplate([
        {
          label: 'Hızlı Ara (Kısayol yok - tıklayın)',
          click: () => toggleSearchWindow()
        },
        {
          label: 'Ana Pencereyi Göster',
          click: () => {
            if (mainWindow) {
              mainWindow.show();
              mainWindow.focus();
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Çıkış',
          click: () => {
            app.isQuitting = true;
            app.quit();
          }
        }
      ]);
      tray.setContextMenu(contextMenu);
    }
  } else {
    // Update tray menu with the registered shortcut
    if (tray) {
      const contextMenu = Menu.buildFromTemplate([
        {
          label: `Hızlı Ara (${registeredShortcut})`,
          click: () => toggleSearchWindow()
        },
        {
          label: 'Ana Pencereyi Göster',
          click: () => {
            if (mainWindow) {
              mainWindow.show();
              mainWindow.focus();
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Çıkış',
          click: () => {
            app.isQuitting = true;
            app.quit();
          }
        }
      ]);
      tray.setContextMenu(contextMenu);
    }
  }  
  // Hide menu bar
  //const { Menu } = require('electron');
  Menu.setApplicationMenu(null);
  
  // Prevent app from closing when all windows are closed
// Prevent app from closing when all windows are closed
  app.on('window-all-closed', (e) => {
    if (process.platform !== 'darwin') {
      e.preventDefault();
    }
  });
});

// Cleanup on quit
app.on('will-quit', () => {
  // Unregister all shortcuts
  globalShortcut.unregisterAll();
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine) => {
    // İkinci instance açılmaya çalışıldığında
    if (commandLine.includes('--hidden')) {
      // Eğer --hidden parametresi varsa, sadece tray'de çalış
      return;
    } else {
      // Parametresiz açıldıysa (rofi'den), ana pencereyi göster
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
      } else {
        // Eğer pencere yoksa veya destroy edilmişse, yeni pencere oluştur
        createWindow();
        if (!process.argv.includes('--hidden')) {
          mainWindow.once('ready-to-show', () => {
            mainWindow.show();
          });
        }
      }
    }
  });
}

// IPC Handlers

// Add new IPC handlers for search window
ipcMain.handle('quick-search', async (event, query) => {
  // Show main window and trigger search
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send('trigger-search', query);
  }
});

ipcMain.handle('hide-search-window', () => {
  if (searchWindow) {
    searchWindow.hide();
  }
});

// Existing IPC handlers...
ipcMain.handle('get-vault-path', () => getVaultPath());

ipcMain.handle('read-directory', async (event, dirPath) => {
  try {
    const files = await fs.readdir(dirPath, { withFileTypes: true });
    return files
      .filter(file => !file.name.startsWith('.'))
      .map(file => ({
        name: file.name,
        path: path.join(dirPath, file.name),
        isDirectory: file.isDirectory()
      }))
      .sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) {
          return a.isDirectory ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
  } catch (err) {
    console.error('Error reading directory:', err);
    return [];
  }
});

ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return content;
  } catch (err) {
    console.error('Error reading file:', err);
    return '';
  }
});

ipcMain.handle('write-file', async (event, filePath, content) => {
  try {
    await fs.writeFile(filePath, content, 'utf-8');
    return true;
  } catch (err) {
    console.error('Error writing file:', err);
    return false;
  }
});

ipcMain.handle('create-file', async (event, filePath) => {
  try {
    await fs.writeFile(filePath, '', 'utf-8');
    return true;
  } catch (err) {
    console.error('Error creating file:', err);
    return false;
  }
});

ipcMain.handle('create-folder', async (event, folderPath) => {
  try {
    await fs.mkdir(folderPath, { recursive: true });
    return true;
  } catch (err) {
    console.error('Error creating folder:', err);
    return false;
  }
});

ipcMain.handle('delete-file', async (event, filePath) => {
  try {
    const stats = await fs.stat(filePath);
    if (stats.isDirectory()) {
      await fs.rmdir(filePath, { recursive: true });
    } else {
      await fs.unlink(filePath);
    }
    return true;
  } catch (err) {
    console.error('Error deleting file:', err);
    return false;
  }
});

ipcMain.handle('rename-file', async (event, oldPath, newPath) => {
  try {
    await fs.rename(oldPath, newPath);
    return true;
  } catch (err) {
    console.error('Error renaming file:', err);
    return false;
  }
});

// JSON file operations
ipcMain.handle('read-json', async (event, filename) => {
  const vaultPath = getVaultPath();
  const filePath = path.join(vaultPath, '.app', filename);
  
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.log(`${filename} not found, returning default`);
    return null;
  }
});

ipcMain.handle('write-json', async (event, filename, data) => {
  const vaultPath = getVaultPath();
  const filePath = path.join(vaultPath, '.app', filename);
  
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error(`Error writing ${filename}:`, err);
    return false;
  }
});

// Command execution
ipcMain.handle('exec-command', async (event, command) => {
  return new Promise((resolve) => {
    exec(command, { cwd: getVaultPath() }, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, error: error.message });
      } else {
        resolve({ success: true, output: stdout });
      }
    });
  });
});

// Note window
ipcMain.handle('open-note-window', async (event, noteData) => {
  const { path: notePath, content, title } = noteData;
  
  // Check if window already exists
  if (noteWindows.has(notePath)) {
    const existingWindow = noteWindows.get(notePath);
    existingWindow.focus();
    return;
  }
  
  // Create new window
  const newWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false
    },
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#1e1e1e',
      symbolColor: '#ffffff',
      height: 30
    },
    backgroundColor: '#1e1e1e',
    title: title
  });

  // Store window reference
  noteWindows.set(notePath, newWindow);

  // Create a full editor HTML
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${title}</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          background-color: #1e1e1e;
          color: #e0e0e0;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          margin: 0;
          overflow: hidden;
          height: 100vh;
          display: flex;
          flex-direction: column;
        }
        
        .header {
          background-color: #262626;
          padding: 10px 20px;
          border-bottom: 1px solid #3e3e3e;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .header h2 {
          font-size: 18px;
          font-weight: 600;
        }
        
        .editor-container {
          flex: 1;
          overflow-y: auto;
          padding: 40px;
          max-width: 900px;
          margin: 0 auto;
          width: 100%;
        }
        
        .content {
          line-height: 1.6;
          white-space: pre-wrap;
          font-family: 'Inter', sans-serif;
        }
        
        code {
          font-family: 'JetBrains Mono', monospace;
          background-color: #2d2d2d;
          padding: 2px 4px;
          border-radius: 3px;
          font-size: 0.9em;
        }
        
        pre {
          background-color: #2d2d2d;
          padding: 16px;
          border-radius: 8px;
          overflow-x: auto;
          margin: 16px 0;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>${title}</h2>
      </div>
      <div class="editor-container">
        <div class="content">${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
      </div>
    </body>
    </html>
  `;
  
  newWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  
  // Clean up when closed
  newWindow.on('closed', () => {
    noteWindows.delete(notePath);
  });
});

// Git operations
ipcMain.handle('git-init', async () => {
  try {
    await git.init();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('git-status', async () => {
  try {
    const status = await git.status();
    
    // Check if there are any commits
    let hasCommits = true;
    try {
      await git.log({ maxCount: 1 });
    } catch (e) {
      hasCommits = false;
    }
    
    return {
      success: true,
      isClean: status.isClean(),
      modified: status.modified.length + status.not_added.length,
      current: status.current,
      tracking: status.tracking,
      hasCommits
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('git-add-commit', async (event, message) => {
  try {
    await git.add('.');
    const commitMessage = message || `Update: ${new Date().toLocaleString('tr-TR')}`;
    await git.commit(commitMessage);
    return { success: true, message: commitMessage };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('git-push', async (event, remote, branch, username, password) => {
  try {
    const remoteWithAuth = `https://${username}:${password}@github.com/${username}/${remote}.git`;
    
    // Check if remote exists
    const remotes = await git.getRemotes();
    if (!remotes.find(r => r.name === 'origin')) {
      await git.addRemote('origin', remoteWithAuth);
    } else {
      // Update remote URL with auth
      await git.remote(['set-url', 'origin', remoteWithAuth]);
    }
    
    await git.push('origin', branch);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('git-pull', async (event, username, password) => {
  try {
    const config = await loadGitConfig();
    if (config && config.repository) {
      const remoteWithAuth = `https://${username}:${password}@github.com/${username}/${config.repository}.git`;
      await git.remote(['set-url', 'origin', remoteWithAuth]);
    }
    
    await git.pull('origin', 'main');
    return { success: true, message: 'Notlar başarıyla güncellendi' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Git config
async function loadGitConfig() {
  try {
    const configPath = path.join(getVaultPath(), '.app', 'git-config.json');
    const content = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function saveGitConfig(config) {
  try {
    const configPath = path.join(getVaultPath(), '.app', 'git-config.json');
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    return true;
  } catch {
    return false;
  }
}

ipcMain.handle('git-get-config', loadGitConfig);
ipcMain.handle('git-save-config', async (event, config) => saveGitConfig(config));

// App settings
ipcMain.handle('save-app-settings', async (event, settings) => {
  if (settings.customColors) {
    store.set('customColors', settings.customColors);
  }
  await saveSettingsToVault();
  return true;
});