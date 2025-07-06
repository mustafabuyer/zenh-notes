const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // File system operations
  getVaultPath: () => ipcRenderer.invoke('get-vault-path'),
  readDirectory: (path) => ipcRenderer.invoke('read-directory', path),
  readFile: (path) => ipcRenderer.invoke('read-file', path),
  writeFile: (path, content) => ipcRenderer.invoke('write-file', path, content),
  createFile: (path) => ipcRenderer.invoke('create-file', path),
  createFolder: (path) => ipcRenderer.invoke('create-folder', path),
  deleteFile: (path) => ipcRenderer.invoke('delete-file', path),
  renameFile: (oldPath, newPath) => ipcRenderer.invoke('rename-file', oldPath, newPath),
  
  // JSON operations
  readJson: (filename) => ipcRenderer.invoke('read-json', filename),
  writeJson: (filename, data) => ipcRenderer.invoke('write-json', filename, data),
  
  // Command execution
  execCommand: (command) => ipcRenderer.invoke('exec-command', command),
  
  // Note window
  openNoteWindow: (noteData) => ipcRenderer.invoke('open-note-window', noteData),
  
  // Git operations
  gitInit: () => ipcRenderer.invoke('git-init'),
  gitStatus: () => ipcRenderer.invoke('git-status'),
  gitAddCommit: (message) => ipcRenderer.invoke('git-add-commit', message),
  gitPush: (remote, branch, username, password) => ipcRenderer.invoke('git-push', remote, branch, username, password),
  gitPull: (username, password) => ipcRenderer.invoke('git-pull', username, password),
  gitGetConfig: () => ipcRenderer.invoke('git-get-config'),
  gitSaveConfig: (config) => ipcRenderer.invoke('git-save-config', config),
  
  // App settings
  saveAppSettings: (settings) => ipcRenderer.invoke('save-app-settings', settings),
  
  // Quick Capture / Search Window
  quickSearch: (query) => ipcRenderer.invoke('quick-search', query),
  hideSearchWindow: () => ipcRenderer.invoke('hide-search-window'),
  onSearchWindowShow: (callback) => ipcRenderer.on('show-search-window', callback),
  
  // Listen for search triggers from quick capture
  onTriggerSearch: (callback) => ipcRenderer.on('trigger-search', (event, query) => callback(query))
});