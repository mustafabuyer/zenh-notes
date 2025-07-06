import { AlertCircle, Calendar, CalendarDays, CalendarRange, Clock } from 'lucide-react';

interface RoutinesSidebarProps {
  selectedFilter: 'overdue' | 'today' | 'tomorrow' | 'week' | 'month' | 'all';
  onFilterChange: (filter: 'overdue' | 'today' | 'tomorrow' | 'week' | 'month' | 'all') => void;
  overdueCount: number;
  onAddRoutine: () => void;
}

function RoutinesSidebar({ selectedFilter, onFilterChange, overdueCount, onAddRoutine }: RoutinesSidebarProps) {
  const filters = [
    { 
      key: 'overdue' as const, 
      label: 'Overdue', 
      icon: AlertCircle, 
      count: overdueCount,
      color: 'text-obsidian-error'
    },
    { key: 'today' as const, label: 'Today', icon: Calendar },
    { key: 'tomorrow' as const, label: 'Tomorrow', icon: CalendarDays },
    { key: 'week' as const, label: 'This Week', icon: CalendarRange },
    { key: 'month' as const, label: 'This Month', icon: CalendarRange },
    { key: 'all' as const, label: 'All', icon: Clock }
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto p-2 mt-4">
        {/* Filters */}
        <div className="space-y-1">
          {filters.map(filter => {
            const Icon = filter.icon;
            const isActive = selectedFilter === filter.key;
            const showFilter = filter.key !== 'overdue' || overdueCount > 0;
            
            if (!showFilter) return null;
            
            return (
              <button
                key={filter.key}
                onClick={() => onFilterChange(filter.key)}
                className={`w-full flex items-center px-2 py-1.5 rounded-md text-sm transition-colors
                  ${isActive 
                    ? 'bg-obsidian-accent text-white' 
                    : 'hover:bg-obsidian-bg-tertiary'
                  }
                  ${filter.color && !isActive ? filter.color : ''}`}
              >
                <Icon size={16} className="mr-2" />
                <span className="flex-1 text-left">{filter.label}</span>
                {filter.count !== undefined && filter.count > 0 && (
                  <span className={`text-xs ${isActive ? 'text-white' : 'text-obsidian-text-muted'}`}>
                    {filter.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default RoutinesSidebar;