export interface GitStatus {
  success: boolean;
  isClean?: boolean;
  modified?: number;
  current?: string;
  tracking?: string;
  hasCommits?: boolean;
  error?: string;
}

export interface GitConfig {
  username: string;
  repository: string;
}

export interface ElectronAPI {
  getVaultPath: () => Promise<string>;
  readDirectory: (path: string) => Promise<Array<{
    name: string;
    path: string;
    isDirectory: boolean;
  }>>;
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string, encoding?: string) => Promise<boolean>;
  createFile: (path: string) => Promise<boolean>;
  createFolder: (path: string) => Promise<boolean>;
  deleteFile: (path: string) => Promise<boolean>;
  renameFile: (oldPath: string, newPath: string) => Promise<boolean>;
  readJson: (filename: string) => Promise<any>;
  writeJson: (filename: string, data: any) => Promise<boolean>;
  execCommand: (command: string) => Promise<{ success: boolean; output?: string; error?: string }>;
  openNoteWindow: (noteData: { path: string; content: string; title: string }) => Promise<void>;
  
  // Git APIs
  gitInit: () => Promise<{ success: boolean; error?: string }>;
  gitStatus: () => Promise<GitStatus>;
  gitAddCommit: (message?: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  gitPush: (remote: string, branch: string, username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  gitPull: (username: string, password: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  gitGetConfig: () => Promise<GitConfig | null>;
  gitSaveConfig: (config: GitConfig) => Promise<boolean>;
  
  // App settings
  saveAppSettings: (settings: { customColors?: any }) => Promise<boolean>;
  
  // ADD THESE: Quick Capture APIs
  quickSearch: (query: string) => Promise<void>;
  hideSearchWindow: () => Promise<void>;
  onSearchWindowShow: (callback: () => void) => void;
  onTriggerSearch: (callback: (query: string) => void) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}