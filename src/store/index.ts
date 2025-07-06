import { create } from 'zustand';
import { format } from 'date-fns';

// Types
export interface TaskFolder {
  id: string;
  name: string;
  parentId?: string;
  children?: TaskFolder[];  // BU SATIRI EKLEYİN

}

export interface ExcalidrawFile {
  path: string;
  lastModified: Date;
}

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  date?: Date;
  priority?: 'P1' | 'P2' | 'P3';
  content?: string; // Markdown içeriği
  subtasks?: Task[]; // Sınırsız derinlik
  parentId?: string; // Üst task referansı
  folderId?: string; // Klasör referansı
  expanded?: boolean; // UI'da açık/kapalı durumu
}

export interface Note {
  path: string;
  content: string;
  lastModified: Date;
}

export interface Routine {
  id: string;
  title: string;
  type: 'daily' | 'weekly' | 'monthly';
  frequency: number; // Her kaç günde/haftada/ayda bir
  dayOfWeek?: number; // 0-6 (Pazar-Cumartesi) haftalık için
  dayOfMonth?: 'first' | 'last'; // Aylık için
  content?: string; // Markdown içeriği (açıklama, scriptler vb.)
  streak: number;
  lastCompleted?: Date;
  nextDue?: Date;
}

interface AppState {
  // UI State
  activeTab: 'notes' | 'tasks' | 'routines';
  setActiveTab: (tab: 'notes' | 'tasks' | 'routines') => void;
  

  // Notes State
  currentNote: Note | null;
  setCurrentNote: (note: Note | null) => void;
  saveNote: (content: string) => Promise<void>;
   // Excalidraw State
  currentExcalidraw: ExcalidrawFile | null;
  setCurrentExcalidraw: (file: ExcalidrawFile | null) => void;
  saveExcalidraw: (content: string) => Promise<void>;
 
  // Tasks State
  tasks: Task[];
  taskFolders: TaskFolder[];
  loadTasks: () => Promise<void>;
  addTask: (task: Omit<Task, 'id'>) => Promise<void>;
  addSubtask: (parentId: string, subtask: Omit<Task, 'id' | 'parentId'>) => Promise<void>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  updateTaskContent: (id: string, content: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  toggleTask: (id: string) => Promise<void>;
  toggleTaskExpanded: (id: string) => void;
  loadTaskFolders: () => Promise<void>;
  addTaskFolder: (folder: Omit<TaskFolder, 'id'>) => Promise<void>;
  updateTaskFolder: (id: string, updates: Partial<TaskFolder>) => Promise<void>;
  deleteTaskFolder: (id: string) => Promise<void>;
  
  // Routines State
  routines: Routine[];
  loadRoutines: () => Promise<void>;
  addRoutine: (routine: Omit<Routine, 'id' | 'streak'>) => Promise<void>;
  updateRoutine: (id: string, updates: Partial<Routine>) => Promise<void>;
  updateRoutineContent: (id: string, content: string) => Promise<void>;
  completeRoutine: (id: string) => Promise<void>;
  deleteRoutine: (id: string) => Promise<void>;
  
  // File Explorer State
  expandedFolders: Set<string>;
  toggleFolder: (path: string) => void;
  encryptedNotes: Set<string>;
  setNoteEncrypted: (path: string, encrypted: boolean) => void;
}

export const useStore = create<AppState>((set, get) => ({
  // UI State
  activeTab: 'notes',
  setActiveTab: (tab) => set({ activeTab: tab }),
  
  // Notes State
  currentNote: null,
  setCurrentNote: (note) => set({ currentNote: note }),
  saveNote: async (content) => {
    const { currentNote } = get();
    if (!currentNote) return;
    
    await window.electronAPI.writeFile(currentNote.path, content);
    set({
      currentNote: {
        ...currentNote,
        content,
        lastModified: new Date()
      }
    });
  },
  // Excalidraw State
  currentExcalidraw: null,
  setCurrentExcalidraw: (file) => set({ currentExcalidraw: file }),
  saveExcalidraw: async (content) => {
    const { currentExcalidraw } = get();
    if (!currentExcalidraw) {
      return;
    }
    
    try {
      const result = await window.electronAPI.writeFile(currentExcalidraw.path, content);
      
      if (result) {
        set({
          currentExcalidraw: {
            ...currentExcalidraw,
            lastModified: new Date()
          }
        });
      }
    } catch (error) {
      console.error('Store: Error writing excalidraw:', error);
      throw error;
    }
},  // Tasks State
  tasks: [],
  taskFolders: [],
  loadTasks: async () => {
    const data = await window.electronAPI.readJson('tasks.json');
    set({ tasks: data || [] });
  },
  
  loadTaskFolders: async () => {
    const data = await window.electronAPI.readJson('taskFolders.json');
    set({ taskFolders: data || [] });
  },
  
  addTaskFolder: async (folder) => {
    const { taskFolders } = get();
    const newFolder: TaskFolder = {
      ...folder,
      id: Date.now().toString()
    };
    const updatedFolders = [...taskFolders, newFolder];
    await window.electronAPI.writeJson('taskFolders.json', updatedFolders);
    set({ taskFolders: updatedFolders });
  },
  
  updateTaskFolder: async (id, updates) => {
    const { taskFolders } = get();
    const updatedFolders = taskFolders.map(folder =>
      folder.id === id ? { ...folder, ...updates } : folder
    );
    await window.electronAPI.writeJson('taskFolders.json', updatedFolders);
    set({ taskFolders: updatedFolders });
  },
  
  deleteTaskFolder: async (id) => {
    const { taskFolders, tasks } = get();
    
    // Remove folder and its subfolders
    const removeFolderAndChildren = (folderId: string): string[] => {
      const toRemove = [folderId];
      const children = taskFolders.filter(f => f.parentId === folderId);
      children.forEach(child => {
        toRemove.push(...removeFolderAndChildren(child.id));
      });
      return toRemove;
    };
    
    const folderIdsToRemove = removeFolderAndChildren(id);
    const updatedFolders = taskFolders.filter(f => !folderIdsToRemove.includes(f.id));
    
    // Update tasks to remove folder reference
    const updatedTasks = tasks.map(task => 
      folderIdsToRemove.includes(task.folderId || '') 
        ? { ...task, folderId: undefined }
        : task
    );
    
    await window.electronAPI.writeJson('taskFolders.json', updatedFolders);
    await window.electronAPI.writeJson('tasks.json', updatedTasks);
    set({ taskFolders: updatedFolders, tasks: updatedTasks });
  },
  
  addTask: async (task) => {
    const { tasks } = get();
    const newTask: Task = {
      ...task,
      id: Date.now().toString(),
      expanded: true
    };
    const updatedTasks = [...tasks, newTask];
    await window.electronAPI.writeJson('tasks.json', updatedTasks);
    set({ tasks: updatedTasks });
  },
  
  addSubtask: async (parentId, subtask) => {
    const { tasks } = get();
    const newSubtask: Task = {
      ...subtask,
      id: Date.now().toString(),
      parentId,
      expanded: true
    };
    
    const addSubtaskRecursive = (taskList: Task[]): Task[] => {
      return taskList.map(task => {
        if (task.id === parentId) {
          return {
            ...task,
            subtasks: [...(task.subtasks || []), newSubtask]
          };
        }
        if (task.subtasks) {
          return {
            ...task,
            subtasks: addSubtaskRecursive(task.subtasks)
          };
        }
        return task;
      });
    };
    
    const updatedTasks = addSubtaskRecursive(tasks);
    await window.electronAPI.writeJson('tasks.json', updatedTasks);
    set({ tasks: updatedTasks });
  },
  
  updateTask: async (id, updates) => {
    const { tasks } = get();
    
    const updateTaskRecursive = (taskList: Task[]): Task[] => {
      return taskList.map(task => {
        if (task.id === id) {
          return { ...task, ...updates };
        }
        if (task.subtasks) {
          return {
            ...task,
            subtasks: updateTaskRecursive(task.subtasks)
          };
        }
        return task;
      });
    };
    
    const updatedTasks = updateTaskRecursive(tasks);
    await window.electronAPI.writeJson('tasks.json', updatedTasks);
    set({ tasks: updatedTasks });
  },
  
  updateTaskContent: async (id, content) => {
    const { updateTask } = get();
    await updateTask(id, { content });
  },
  
  deleteTask: async (id) => {
    const { tasks } = get();
    
    const deleteTaskRecursive = (taskList: Task[]): Task[] => {
      return taskList
        .filter(task => task.id !== id)
        .map(task => ({
          ...task,
          subtasks: task.subtasks ? deleteTaskRecursive(task.subtasks) : undefined
        }));
    };
    
    const updatedTasks = deleteTaskRecursive(tasks);
    await window.electronAPI.writeJson('tasks.json', updatedTasks);
    set({ tasks: updatedTasks });
  },
  
  toggleTask: async (id) => {
    const { tasks, updateTask } = get();
    
    const findTask = (taskList: Task[]): Task | undefined => {
      for (const task of taskList) {
        if (task.id === id) return task;
        if (task.subtasks) {
          const found = findTask(task.subtasks);
          if (found) return found;
        }
      }
      return undefined;
    };
    
    const task = findTask(tasks);
    if (task) {
      await updateTask(id, { completed: !task.completed });
    }
  },
  
  toggleTaskExpanded: (id) => {
    const { tasks } = get();
    
    const toggleExpandedRecursive = (taskList: Task[]): Task[] => {
      return taskList.map(task => {
        if (task.id === id) {
          return { ...task, expanded: !task.expanded };
        }
        if (task.subtasks) {
          return {
            ...task,
            subtasks: toggleExpandedRecursive(task.subtasks)
          };
        }
        return task;
      });
    };
    
    set({ tasks: toggleExpandedRecursive(tasks) });
  },
  
  // Routines State
  routines: [],
  loadRoutines: async () => {
    const data = await window.electronAPI.readJson('routines.json');
    set({ routines: data || [] });
  },
  
  addRoutine: async (routine) => {
    const { routines } = get();
    const now = new Date();
    let nextDue = new Date();
    
    // İlk nextDue hesapla
    if (routine.type === 'daily') {
      nextDue.setDate(now.getDate() + routine.frequency);
    } else if (routine.type === 'weekly' && routine.dayOfWeek !== undefined) {
      const daysUntilTarget = (routine.dayOfWeek - now.getDay() + 7) % 7 || 7;
      nextDue.setDate(now.getDate() + daysUntilTarget + (routine.frequency - 1) * 7);
    } else if (routine.type === 'monthly') {
      nextDue.setMonth(now.getMonth() + routine.frequency);
      if (routine.dayOfMonth === 'first') {
        nextDue.setDate(1);
      } else if (routine.dayOfMonth === 'last') {
        nextDue.setDate(0); // Bir sonraki ayın 0. günü = bu ayın son günü
        nextDue.setMonth(nextDue.getMonth() + 1);
      }
    }
    
    const newRoutine: Routine = {
      ...routine,
      id: Date.now().toString(),
      streak: 0,
      nextDue
    };
    const updatedRoutines = [...routines, newRoutine];
    await window.electronAPI.writeJson('routines.json', updatedRoutines);
    set({ routines: updatedRoutines });
  },
  
  completeRoutine: async (id) => {
    const { routines } = get();
    const now = new Date();
    
    const updatedRoutines = routines.map(routine => {
      if (routine.id === id) {
        const lastCompleted = new Date();
        let nextDue = new Date(routine.nextDue || now);
        
        // Bir sonraki tarihi hesapla
        if (routine.type === 'daily') {
          nextDue.setDate(nextDue.getDate() + routine.frequency);
        } else if (routine.type === 'weekly') {
          nextDue.setDate(nextDue.getDate() + routine.frequency * 7);
        } else if (routine.type === 'monthly') {
          const currentMonth = nextDue.getMonth();
          nextDue.setMonth(currentMonth + routine.frequency);
          
          if (routine.dayOfMonth === 'first') {
            nextDue.setDate(1);
          } else if (routine.dayOfMonth === 'last') {
            nextDue.setMonth(nextDue.getMonth() + 1);
            nextDue.setDate(0);
          }
        }
        
        return {
          ...routine,
          streak: routine.streak + 1,
          lastCompleted,
          nextDue
        };
      }
      return routine;
    });
    
    await window.electronAPI.writeJson('routines.json', updatedRoutines);
    set({ routines: updatedRoutines });
  },
  
  updateRoutine: async (id, updates) => {
    const { routines } = get();
    const updatedRoutines = routines.map(routine =>
      routine.id === id ? { ...routine, ...updates } : routine
    );
    await window.electronAPI.writeJson('routines.json', updatedRoutines);
    set({ routines: updatedRoutines });
  },
  
  updateRoutineContent: async (id, content) => {
    const { updateRoutine } = get();
    await updateRoutine(id, { content });
  },
  
  deleteRoutine: async (id) => {
    const { routines } = get();
    const updatedRoutines = routines.filter(routine => routine.id !== id);
    await window.electronAPI.writeJson('routines.json', updatedRoutines);
    set({ routines: updatedRoutines });
  },
  
  // File Explorer State
  expandedFolders: new Set<string>(),
  toggleFolder: (path) => {
    set(state => {
      const newExpanded = new Set(state.expandedFolders);
      if (newExpanded.has(path)) {
        newExpanded.delete(path);
      } else {
        newExpanded.add(path);
      }
      return { expandedFolders: newExpanded };
    });
  },
  
  encryptedNotes: new Set<string>(),
  setNoteEncrypted: (path: string, isEncrypted: boolean) => {
    set(state => {
      const updatedEncrypted = new Set(state.encryptedNotes);
      if (isEncrypted) {
        updatedEncrypted.add(path);
      } else {
        updatedEncrypted.delete(path);
      }
      return { encryptedNotes: updatedEncrypted };
    });
    //  Set'i alıp localStorage'a kaydet
    const toSave = get().encryptedNotes;
    window.localStorage.setItem(
      'encryptedNotes',
      JSON.stringify(Array.from(toSave))
    );
  }
}));