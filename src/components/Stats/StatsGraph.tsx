/**
 * 시험 점수 통계 그래프 컴포넌트
 * - 누적 출석일 수 표시
 * - 주별/월별 시험 점수 그래프
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import type { StudySession, TestResult } from '@/types/database';

type ViewMode = 'weekly' | 'monthly';

interface StatsGraphProps {
  userId: string;
}

interface WeeklyScoreData {
  weekLabel: string;
  score: number | null;
  prevScore: number | null;
  improved: boolean;
}

interface MonthlyScoreData {
  monthLabel: string;
  avgScore: number | null;
  testCount: number;
}

export default function StatsGraph({ userId }: StatsGraphProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('weekly');
  const [totalAttendance, setTotalAttendance] = useState(0);
  const [thisMonthAttendance, setThisMonthAttendance] = useState(0);
  const [weeklyScores, setWeeklyScores] = useState<WeeklyScoreData[]>([]);
  const [monthlyScores, setMonthlyScores] = useState<MonthlyScoreData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, [userId]);

  async function loadStats() {
    setIsLoading(true);
    
    try {
      // 전체 출석 데이터
      const { data: allSessions } = await supabase
        .from('study_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_present', true);
      
      setTotalAttendance(allSessions?.length || 0);
      
      // 이번 달 출석
      const thisMonth = new Date();
      const monthStart = `${thisMonth.getFullYear()}-${String(thisMonth.getMonth() + 1).padStart(2, '0')}-01`;
      const thisMonthSessions = allSessions?.filter(s => s.study_date >= monthStart) || [];
      setThisMonthAttendance(thisMonthSessions.length);
      
      // 최근 12개월 시험 데이터
      const oneYearAgo = new Date();
      oneYearAgo.setMonth(oneYearAgo.getMonth() - 12);
      const startDate = oneYearAgo.toISOString().split('T')[0];
      
      const { data: tests } = await supabase
        .from('test_results')
        .select('*')
        .eq('user_id', userId)
        .eq('is_approved', true)
        .gte('test_date', startDate)
        .order('test_date', { ascending: true });

      processWeeklyScores(tests || []);
      processMonthlyScores(tests || []);
    } catch (error) {
      console.error('통계 로드 실패:', error);
    } finally {
      setIsLoading(false);
    }
  }

  // 주별 점수 처리 (최근 8주)
  function processWeeklyScores(tests: TestResult[]) {
    const weeks: WeeklyScoreData[] = [];
    const today = new Date();
    
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - (weekStart.getDay() || 7) - (i * 7) + 1);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      const startStr = weekStart.toISOString().split('T')[0];
      const endStr = weekEnd.toISOString().split('T')[0];
      
      const weekTests = tests.filter(
        t => t.test_date >= startStr && t.test_date <= endStr
      );
      
      const score = weekTests.length > 0 ? weekTests[0].score : null;
      
      // 이전 주 점수 찾기
      const prevWeekIdx = weeks.length - 1;
      const prevScore = prevWeekIdx >= 0 ? weeks[prevWeekIdx].score : null;
      
      weeks.push({
        weekLabel: `${weekStart.getMonth() + 1}/${weekStart.getDate()}`,
        score,
        prevScore,
        improved: score !== null && prevScore !== null && score > prevScore
      });
    }
    
    setWeeklyScores(weeks);
  }

  // 월별 점수 처리 (최근 8개월)
  function processMonthlyScores(tests: TestResult[]) {
    const months: MonthlyScoreData[] = [];
    const today = new Date();
    
    for (let i = 7; i >= 0; i--) {
      const month = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() - i + 1, 0);
      
      const startStr = month.toISOString().split('T')[0];
      const endStr = monthEnd.toISOString().split('T')[0];
      
      const monthTests = tests.filter(
        t => t.test_date >= startStr && t.test_date <= endStr
      );
      
      const avgScore = monthTests.length > 0 
        ? Math.round(monthTests.reduce((sum, t) => sum + t.score, 0) / monthTests.length * 10) / 10
        : null;
      
      months.push({
        monthLabel: `${month.getMonth() + 1}월`,
        avgScore,
        testCount: monthTests.length
      });
    }
    
    setMonthlyScores(months);
  }

  // 최대값 계산 (그래프 높이 조절용)
  const maxWeeklyScore = Math.max(
    ...weeklyScores.filter(w => w.score !== null).map(w => w.score!),
    100
  );
  const maxMonthlyScore = Math.max(
    ...monthlyScores.filter(m => m.avgScore !== null).map(m => m.avgScore!),
    100
  );

  if (isLoading) {
    return (
      <div className="card text-center py-8">
        <div className="spinner mx-auto mb-2" />
        <p className="text-gray-500">통계 로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="text-lg font-bold text-gray-800 mb-4">📊 점수 통계</h2>

      {/* 누적 출석 현황 */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-green-50 rounded-xl p-4 text-center">
          <p className="text-sm text-green-600 mb-1">누적 출석일</p>
          <p className="text-3xl font-bold text-green-700">{totalAttendance}일</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 text-center">
          <p className="text-sm text-blue-600 mb-1">이번 달 출석</p>
          <p className="text-3xl font-bold text-blue-700">{thisMonthAttendance}일</p>
        </div>
      </div>

      {/* 탭 - 주별/월별 */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1">
        {(['weekly', 'monthly'] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === mode
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {mode === 'weekly' ? '주별 점수' : '월별 점수'}
          </button>
        ))}
      </div>

      {/* 주별 점수 그래프 */}
      {viewMode === 'weekly' && (
        <div>
          <div className="flex items-end gap-2 h-44 mb-2">
            {weeklyScores.map((week, i) => (
              <div key={i} className="flex-1 flex flex-col items-center">
                {/* 점수 표시 */}
                <div className="text-xs text-gray-500 mb-1 h-5">
                  {week.score !== null ? `${week.score}` : ''}
                </div>
                {/* 막대 */}
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ 
                    height: week.score !== null 
                      ? `${(week.score / maxWeeklyScore) * 100}%` 
                      : '4px' 
                  }}
                  className={`w-full max-w-[35px] rounded-t ${
                    week.score !== null
                      ? week.improved
                        ? 'bg-gradient-to-t from-green-500 to-green-400'
                        : 'bg-gradient-to-t from-blue-500 to-blue-400'
                      : 'bg-gray-200'
                  }`}
                  style={{ minHeight: '4px' }}
                />
                {/* 상승 표시 */}
                {week.improved && (
                  <span className="text-green-500 text-xs mt-1">↑</span>
                )}
              </div>
            ))}
          </div>
          {/* 날짜 라벨 */}
          <div className="flex gap-2">
            {weeklyScores.map((week, i) => (
              <div key={i} className="flex-1 text-center">
                <p className="text-[10px] text-gray-400">{week.weekLabel}~</p>
              </div>
            ))}
          </div>
          
          {/* 요약 */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            {(() => {
              const validScores = weeklyScores.filter(w => w.score !== null);
              const improvedCount = weeklyScores.filter(w => w.improved).length;
              const avgScore = validScores.length > 0
                ? Math.round(validScores.reduce((sum, w) => sum + w.score!, 0) / validScores.length * 10) / 10
                : null;
              
              return (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">8주 평균 점수</span>
                    <span className="font-bold text-blue-600">
                      {avgScore !== null ? `${avgScore}점` : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-gray-500">점수 상승 횟수</span>
                    <span className="font-bold text-green-600">
                      {improvedCount}회 🎉
                    </span>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* 월별 점수 그래프 */}
      {viewMode === 'monthly' && (
        <div>
          <div className="flex items-end gap-2 h-44 mb-2">
            {monthlyScores.map((month, i) => (
              <div key={i} className="flex-1 flex flex-col items-center">
                {/* 평균 점수 */}
                <div className="text-xs text-gray-500 mb-1 h-5">
                  {month.avgScore !== null ? `${month.avgScore}` : ''}
                </div>
                {/* 막대 */}
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ 
                    height: month.avgScore !== null 
                      ? `${(month.avgScore / maxMonthlyScore) * 100}%` 
                      : '4px'
                  }}
                  className={`w-full max-w-[35px] rounded-t ${
                    month.avgScore !== null
                      ? 'bg-gradient-to-t from-indigo-500 to-indigo-400'
                      : 'bg-gray-200'
                  }`}
                  style={{ minHeight: '4px' }}
                />
              </div>
            ))}
          </div>
          {/* 월 라벨 */}
          <div className="flex gap-2">
            {monthlyScores.map((month, i) => (
              <div key={i} className="flex-1 text-center">
                <p className="text-[10px] text-gray-400">{month.monthLabel}</p>
                <p className="text-[9px] text-gray-300">{month.testCount}회</p>
              </div>
            ))}
          </div>
          
          {/* 요약 */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            {(() => {
              const validMonths = monthlyScores.filter(m => m.avgScore !== null);
              const totalTests = monthlyScores.reduce((sum, m) => sum + m.testCount, 0);
              const overallAvg = validMonths.length > 0
                ? Math.round(validMonths.reduce((sum, m) => sum + m.avgScore!, 0) / validMonths.length * 10) / 10
                : null;
              
              return (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">8개월 평균</span>
                    <span className="font-bold text-indigo-600">
                      {overallAvg !== null ? `${overallAvg}점` : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-gray-500">총 시험 횟수</span>
                    <span className="font-bold text-gray-700">
                      {totalTests}회
                    </span>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* 범례 */}
      <div className="mt-4 pt-3 border-t border-gray-100 flex gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-blue-400 rounded"></span> 점수
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-green-400 rounded"></span> 상승
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-gray-200 rounded"></span> 기록없음
        </span>
      </div>
    </div>
  );
}
