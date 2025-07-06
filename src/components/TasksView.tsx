import { useState } from 'react';
import { Plus, CalendarDays, AlertCircle } from 'lucide-react';
import { format, isToday, isTomorrow, isThisWeek, isPast, isBefore } from 'date-fns';
import { useStore, Task } from '../store';
import Modal from './Modal';
import TaskItem from './TaskItem';

interface TasksViewProps {
  selectedFolder: string | null;
  onFolderChange: (folderId: string | null) => void;
}

function TasksView({ selectedFolder, onFolderChange }: TasksViewProps) {
  const { tasks, addTask, updateTask } = useStore();
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'today' | 'tomorrow' | 'week' | 'overdue'>('today');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    priority: undefined as 'P1' | 'P2' | 'P3' | undefined,
    content: ''
  });
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);

  const handleAddTask = async () => {
    if (!newTask.title.trim()) return;

    await addTask({
      title: newTask.title,
      completed: false,
      date: new Date(newTask.date),
      priority: newTask.priority,
      content: newTask.content || undefined,
      folderId: selectedFolder || undefined
    });

    setNewTask({
      title: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      priority: undefined,
      content: ''
    });
    setShowAddModal(false);
  };

  const filterTasks = (taskList: Task[]): Task[] => {
    let filtered: Task[] = [];
    
    // First filter by folder
    const folderFiltered = selectedFolder 
      ? taskList.filter(task => task.folderId === selectedFolder)
      : taskList;
    
    // Then filter by date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    switch (selectedFilter) {
      case 'all':
        filtered = folderFiltered;
        break;
      case 'today':
        filtered = folderFiltered.filter(task => {
          if (!task.date) return false;
          const taskDate = new Date(task.date);
          return isToday(taskDate);
        });
        break;
      case 'tomorrow':
        filtered = folderFiltered.filter(task => {
          if (!task.date) return false;
          const taskDate = new Date(task.date);
          return isTomorrow(taskDate);
        });
        break;
      case 'week':
        filtered = folderFiltered.filter(task => {
          if (!task.date) return false;
          const taskDate = new Date(task.date);
          return isThisWeek(taskDate);
        });
        break;
      case 'overdue':
        filtered = folderFiltered.filter(task => {
          if (!task.date || task.completed) return false;
          const taskDate = new Date(task.date);
          return isPast(taskDate) && !isToday(taskDate);
        });
        break;
    }
    
    return filtered;
  };

  const filteredTasks = filterTasks(tasks.filter(task => !task.parentId));

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    
    if (!draggedTask) return;
    
    // Update task's folder to current selected folder
    await updateTask(draggedTask.id, { folderId: selectedFolder || undefined });
    setDraggedTask(null);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-obsidian-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-medium text-obsidian-text">
            {selectedFolder ? 'Klasör Görevleri' : ''}
          </h2>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-2 px-3 py-1.5 bg-obsidian-accent hover:bg-obsidian-accent-hover 
                     text-white rounded-md text-sm transition-colors"
          >
            <Plus size={16} />
          </button>
        </div>
        
        {/* Filters */}
        <div className="flex space-x-2">
          {(['all', 'today', 'tomorrow', 'week', 'overdue'] as const).map(filter => (
            <button
              key={filter}
              onClick={() => setSelectedFilter(filter)}
              className={`px-3 py-1 rounded-md text-sm transition-colors ${
                selectedFilter === filter
                  ? 'bg-obsidian-accent text-white'
                  : 'bg-obsidian-bg-secondary hover:bg-obsidian-bg-tertiary'
              }`}
            >
              {filter === 'all' && 'All'}
              {filter === 'today' && 'Today'}
              {filter === 'tomorrow' && 'Tomorrow'}
              {filter === 'week' && 'This Week'}
              {filter === 'overdue' && 'Overdue'}
            </button>
          ))}
        </div>
      </div>

      {/* Tasks List */}
      <div 
        className="flex-1 overflow-y-auto p-4"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {filteredTasks.length === 0 ? (
          <div className="text-center text-obsidian-text-muted py-8">
            <AlertCircle size={48} className="mx-auto mb-4 opacity-10" />
            <p></p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTasks.map(task => (
              <div
                key={task.id}
                draggable
                onDragStart={(e) => handleDragStart(e, task)}
                className="cursor-move"
              >
                <TaskItem task={task} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Task Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title=""
      >
        <form onSubmit={(e) => { e.preventDefault(); handleAddTask(); }} className="space-y-4">
          <input
            type="text"
            value={newTask.title}
            onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
            placeholder=""
            className="w-full px-3 py-2 bg-obsidian-bg border border-obsidian-border rounded-md 
                     focus:outline-none focus:border-obsidian-accent"
            autoFocus
          />
          
          <textarea
            value={newTask.content}
            onChange={(e) => setNewTask({ ...newTask, content: e.target.value })}
            placeholder=""
            rows={4}
            className="w-full px-3 py-2 bg-obsidian-bg border border-obsidian-border rounded-md 
                     focus:outline-none focus:border-obsidian-accent text-sm"
          />
          
          <div className="flex space-x-3">
            <input
              type="date"
              value={newTask.date}
              onChange={(e) => setNewTask({ ...newTask, date: e.target.value })}
              className="flex-1 px-3 py-2 bg-obsidian-bg border border-obsidian-border rounded-md 
                       focus:outline-none focus:border-obsidian-accent text-sm"
            />
            
            <select
              value={newTask.priority || ''}
              onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as any || undefined })}
              className="px-3 py-2 bg-obsidian-bg border border-obsidian-border rounded-md 
                       focus:outline-none focus:border-obsidian-accent text-sm"
            >
              <option value="">Priority</option>
              <option value="P1">P1 - I</option>
              <option value="P2">P2 - II</option>
              <option value="P3">P3 - III</option>
            </select>
          </div>
          
          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="px-4 py-2 bg-obsidian-bg-tertiary hover:bg-obsidian-border 
                       rounded-md text-sm transition-colors"
            >
              x
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-obsidian-accent hover:bg-obsidian-accent-hover 
                       text-white rounded-md text-sm transition-colors"
            >
              o
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default TasksView;