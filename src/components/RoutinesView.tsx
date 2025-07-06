import { useState } from 'react';
import { Plus, Calendar, CheckCircle, Circle, Trash2, ChevronDown, ChevronUp, Clock, Flame } from 'lucide-react';
import { format, isToday, isTomorrow, isThisWeek, isThisMonth, isBefore } from 'date-fns';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView } from '@codemirror/view';
import { useStore, Routine } from '../store';
import MarkdownRenderer from './MarkdownRenderer';

const DAYS_OF_WEEK = [
  { value: 0, label: 'Pazar' },
  { value: 1, label: 'Pazartesi' },
  { value: 2, label: 'Salı' },
  { value: 3, label: 'Çarşamba' },
  { value: 4, label: 'Perşembe' },
  { value: 5, label: 'Cuma' },
  { value: 6, label: 'Cumartesi' }
];

interface RoutinesViewProps {
  selectedFilter: 'all' | 'overdue' | 'today' | 'tomorrow' | 'week' | 'month';
  onFilterChange: (filter: 'all' | 'overdue' | 'today' | 'tomorrow' | 'week' | 'month') => void;
  showAddForm: boolean;
  onShowAddForm: (show: boolean) => void;
}

function RoutinesView({ selectedFilter, onFilterChange, showAddForm, onShowAddForm }: RoutinesViewProps) {
  const { routines, loadRoutines, addRoutine, completeRoutine, updateRoutineContent, deleteRoutine } = useStore();
  const [newRoutine, setNewRoutine] = useState<{
    title: string;
    type: 'daily' | 'weekly' | 'monthly';
    frequency: number;
    dayOfWeek?: number;
    dayOfMonth?: 'first' | 'last';
    content?: string;
  }>({
    title: '',
    type: 'daily',
    frequency: 1,
    dayOfWeek: 1,
    dayOfMonth: 'first',
    content: ''
  });
  const [expandedRoutines, setExpandedRoutines] = useState<Set<string>>(new Set());
  const [editingContent, setEditingContent] = useState<string | null>(null);

  const handleAddRoutine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoutine.title.trim()) return;

    await addRoutine({
      title: newRoutine.title,
      type: newRoutine.type,
      frequency: newRoutine.frequency,
      dayOfWeek: newRoutine.type === 'weekly' ? newRoutine.dayOfWeek : undefined,
      dayOfMonth: newRoutine.type === 'monthly' ? newRoutine.dayOfMonth : undefined,
      content: newRoutine.content || undefined
    });

    setNewRoutine({ 
      title: '', 
      type: 'daily', 
      frequency: 1,
      dayOfWeek: 1,
      dayOfMonth: 'first',
      content: ''
    });
    onShowAddForm(false);
  };

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedRoutines);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRoutines(newExpanded);
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

  const isCompletedToday = (routine: Routine) => {
    if (!routine.lastCompleted) return false;
    return isToday(new Date(routine.lastCompleted));
  };

  const filterRoutines = (routines: Routine[]) => {
    const now = new Date();
    
    switch (selectedFilter) {
      case 'overdue':
        return routines.filter(r => r.nextDue && isBefore(new Date(r.nextDue), now) && !isToday(new Date(r.nextDue)));
      case 'today':
        return routines.filter(r => r.nextDue && isToday(new Date(r.nextDue)));
      case 'tomorrow':
        return routines.filter(r => r.nextDue && isTomorrow(new Date(r.nextDue)));
      case 'week':
        return routines.filter(r => r.nextDue && isThisWeek(new Date(r.nextDue)));
      case 'month':
        return routines.filter(r => r.nextDue && isThisMonth(new Date(r.nextDue)));
      default:
        return routines;
    }
  };

  const getStreakColor = (streak: number) => {
    if (streak >= 30) return 'text-green-500';
    if (streak >= 7) return 'text-yellow-500';
    return 'text-obsidian-text-muted';
  };

  const getRoutineTypeLabel = (routine: Routine) => {
    let label = '';
    
    switch (routine.type) {
      case 'daily':
        label = routine.frequency === 1 ? 'Her gün' : `Her ${routine.frequency} günde bir`;
        break;
      case 'weekly':
        const dayName = DAYS_OF_WEEK.find(d => d.value === routine.dayOfWeek)?.label || '';
        label = routine.frequency === 1 
          ? `Her ${dayName}` 
          : `Her ${routine.frequency} haftada bir ${dayName}`;
        break;
      case 'monthly':
        const dayLabel = routine.dayOfMonth === 'first' ? 'ayın ilk günü' : 'ayın son günü';
        label = routine.frequency === 1 
          ? `Her ${dayLabel}` 
          : `Her ${routine.frequency} ayda bir ${dayLabel}`;
        break;
    }
    
    return label;
  };

  const filteredRoutines = filterRoutines(routines);

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold"></h1>
        <button
          onClick={() => onShowAddForm(!showAddForm)}
          className="flex items-center space-x-2 px-4 py-2 bg-obsidian-accent hover:bg-obsidian-accent-hover 
                   text-white rounded-md transition-colors"
        >
          <Plus size={18}/>
        </button>
      </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-obsidian-bg-secondary rounded-md p-4">
              <div className="text-obsidian-text-muted text-sm mb-1">Total</div>
              <div className="text-2xl font-bold">{routines.length}</div>
            </div>
            <div className="bg-obsidian-bg-secondary rounded-md p-4">
              <div className="text-obsidian-text-muted text-sm mb-1">Today</div>
              <div className="text-2xl font-bold text-green-500">
                {routines.filter(isCompletedToday).length}
              </div>
            </div>
            <div className="bg-obsidian-bg-secondary rounded-md p-4">
              <div className="text-obsidian-text-muted text-sm mb-1">Streak</div>
              <div className="text-2xl font-bold text-yellow-500">
                {Math.max(...routines.map(r => r.streak), 0)}
              </div>
            </div>
          </div>

          {/* Add Routine Form */}
          {showAddForm && (
            <div className="bg-obsidian-bg-secondary rounded-md p-4 mb-6">
              <form onSubmit={handleAddRoutine} className="space-y-3">
                <input
                  type="text"
                  value={newRoutine.title}
                  onChange={(e) => setNewRoutine({ ...newRoutine, title: e.target.value })}
                  placeholder=""
                  className="w-full px-3 py-2 bg-obsidian-bg border border-obsidian-border rounded-md 
                           focus:outline-none focus:border-obsidian-accent text-sm"
                  autoFocus
                />
                
                <textarea
                  value={newRoutine.content}
                  onChange={(e) => setNewRoutine({ ...newRoutine, content: e.target.value })}
                  placeholder=""
                  rows={3}
                  className="w-full px-3 py-2 bg-obsidian-bg border border-obsidian-border rounded-md 
                           focus:outline-none focus:border-obsidian-accent text-sm"
                />
                
                <div className="flex space-x-3">
                  <select
                    value={newRoutine.type}
                    onChange={(e) => setNewRoutine({ ...newRoutine, type: e.target.value as 'daily' | 'weekly' | 'monthly' })}
                    className="px-3 py-2 bg-obsidian-bg border border-obsidian-border rounded-md 
                             focus:outline-none focus:border-obsidian-accent text-sm"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                  
                  <input
                    type="number"
                    min="1"
                    value={newRoutine.frequency}
                    onChange={(e) => setNewRoutine({ ...newRoutine, frequency: parseInt(e.target.value) || 1 })}
                    className="w-20 px-3 py-2 bg-obsidian-bg border border-obsidian-border rounded-md 
                             focus:outline-none focus:border-obsidian-accent text-sm"
                  />
                  
                  {newRoutine.type === 'weekly' && (
                    <select
                      value={newRoutine.dayOfWeek}
                      onChange={(e) => setNewRoutine({ ...newRoutine, dayOfWeek: parseInt(e.target.value) })}
                      className="px-3 py-2 bg-obsidian-bg border border-obsidian-border rounded-md 
                               focus:outline-none focus:border-obsidian-accent text-sm"
                    >
                      {DAYS_OF_WEEK.map(day => (
                        <option key={day.value} value={day.value}>{day.label}</option>
                      ))}
                    </select>
                  )}
                  
                  {newRoutine.type === 'monthly' && (
                    <select
                      value={newRoutine.dayOfMonth}
                      onChange={(e) => setNewRoutine({ ...newRoutine, dayOfMonth: e.target.value as 'first' | 'last' })}
                      className="px-3 py-2 bg-obsidian-bg border border-obsidian-border rounded-md 
                               focus:outline-none focus:border-obsidian-accent text-sm"
                    >
                      <option value="first">First day</option>
                      <option value="last">Last day</option>
                    </select>
                  )}
                  
                  <button
                    type="submit"
                    className="px-4 py-2 bg-obsidian-accent hover:bg-obsidian-accent-hover 
                             text-white rounded-md transition-colors text-sm"
                  >
                    o
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => onShowAddForm(false)}
                    className="px-4 py-2 bg-obsidian-bg-tertiary hover:bg-obsidian-border 
                             rounded-md transition-colors text-sm"
                  >
                    x
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Routines List */}
          <div className="space-y-4">
            {filteredRoutines.length === 0 ? (
              <div className="text-center py-12 text-obsidian-text-muted">
                <Calendar size={48} className="mx-auto mb-4 opacity-50" />
                <p></p>
              </div>
            ) : (
              filteredRoutines.map(routine => {
                const isCompleted = isCompletedToday(routine);
                const isExpanded = expandedRoutines.has(routine.id);
                const isEditingThis = editingContent === routine.id;
                
                return (
                  <div key={routine.id} className="bg-obsidian-bg-secondary rounded-md overflow-hidden">
                    {/* Routine Header */}
                    <div className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3 flex-1">
                          <button
                            onClick={() => completeRoutine(routine.id)}
                            className="mt-0.5"
                          >
                            {isCompleted 
                              ? <CheckCircle size={20} className="text-green-500" />
                              : <Circle size={20} className="text-obsidian-text-muted" />
                            }
                          </button>
                          
                          <div className="flex-1">
                            <h3 className={`font-medium ${isCompleted ? 'line-through text-obsidian-text-muted' : ''}`}>
                              {routine.title}
                            </h3>
                            
                            <div className="flex items-center space-x-4 mt-1 text-sm text-obsidian-text-muted">
                              <span className="flex items-center space-x-1">
                                <Clock size={14} />
                                <span>{getRoutineTypeLabel(routine)}</span>
                              </span>
                              
                              <span className={`flex items-center space-x-1 ${getStreakColor(routine.streak)}`}>
                                <Flame size={14} />
                                <span>{routine.streak} gün</span>
                              </span>
                              
                              {routine.nextDue && (
                                <span>
                                  Next: {format(new Date(routine.nextDue), 'dd MMM')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          {routine.content && (
                            <button
                              onClick={() => toggleExpanded(routine.id)}
                              className="p-2 hover:bg-obsidian-bg rounded-md text-obsidian-text-muted"
                            >
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                          )}
                          <button
                            onClick={() => deleteRoutine(routine.id)}
                            className="p-2 hover:bg-obsidian-bg rounded-md text-obsidian-text-muted 
                                     hover:text-obsidian-error transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    {/* Content Area */}
                    {isExpanded && routine.content && (
                      <div className="px-4 pb-4">
                        {isEditingThis ? (
                          <div>
                            <CodeMirror
                              value={routine.content}
                              onChange={(val) => updateRoutineContent(routine.id, val)}
                              theme={oneDark}
                              extensions={[markdown(), EditorView.lineWrapping]}
                              height="200px"
                              className="text-sm"
                            />
                            <div className="flex justify-end space-x-2 mt-2">
                              <button
                                onClick={() => setEditingContent(null)}
                                className="px-3 py-1 text-sm bg-obsidian-accent hover:bg-obsidian-accent-hover text-white rounded-md"
                              >
                                ok
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            onClick={() => setEditingContent(routine.id)}
                            className="p-3 bg-obsidian-bg rounded cursor-pointer hover:bg-obsidian-bg-tertiary"
                          >
                            <MarkdownRenderer content={routine.content} onRunScript={handleRunScript} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
          )}
        </div>
      
    </div>
  );
}

export default RoutinesView;