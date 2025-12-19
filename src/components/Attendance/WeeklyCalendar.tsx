import type { StudySession } from '@/types/database';
import { 
  getWeekDays, 
  formatDayOfWeek, 
  toDateString,
  isStudyDay,
  isTestDay,
  isRestDay,
  checkIsToday
} from '@/lib/dateUtils';

interface WeeklyCalendarProps {
  sessions: StudySession[];
  today: Date;
  onDayClick?: (date: Date) => void;
}

export default function WeeklyCalendar({ sessions, today, onDayClick }: WeeklyCalendarProps) {
  const weekDays = getWeekDays(today);
  
  // 날짜별 세션 맵
  const sessionMap = new Map<string, StudySession>();
  sessions.forEach(s => sessionMap.set(s.study_date, s));

  function getStatusIcon(date: Date): string {
    const dateStr = toDateString(date);
    const session = sessionMap.get(dateStr);
    const isToday = checkIsToday(date);
    const isPast = date < today && !isToday;
    
    // 일요일 = 휴무
    if (isRestDay(date)) return '💤';
    
    // 토요일 = 시험
    if (isTestDay(date)) {
      // TODO: 시험 결과 연동
      return '📝';
    }
    
    // 평일 (월~금)
    if (session?.is_present) return '✅';
    if (isToday) return '🔵';
    if (isPast) return '❌';
    return '⬜';
  }

  function getStatusClass(date: Date): string {
    const dateStr = toDateString(date);
    const session = sessionMap.get(dateStr);
    const isToday = checkIsToday(date);
    
    if (isRestDay(date)) return 'bg-gray-100 text-gray-400';
    if (isTestDay(date)) return 'bg-blue-50 text-blue-600';
    if (session?.is_present) return 'bg-green-50 text-green-600';
    if (isToday) return 'bg-chick-50 text-chick-600 ring-2 ring-chick-400';
    
    return 'bg-gray-50 text-gray-400';
  }

  return (
    <div className="grid grid-cols-7 gap-2">
      {weekDays.map((date) => {
        const dateStr = toDateString(date);
        const dayName = formatDayOfWeek(date);
        const isToday = checkIsToday(date);
        
        return (
          <div 
            key={dateStr} 
            className="text-center cursor-pointer"
            onClick={() => onDayClick?.(date)}
          >
            <div className={`text-xs font-medium mb-1 ${isToday ? 'text-chick-600' : 'text-gray-500'}`}>
              {dayName}
            </div>
            <div className={`day-cell mx-auto ${getStatusClass(date)} hover:ring-2 hover:ring-chick-300 transition-all`}>
              <span className="text-lg">{getStatusIcon(date)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
