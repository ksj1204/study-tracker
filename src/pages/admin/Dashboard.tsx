import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/stores/authStore';
import { supabase, cleanupOldPhotos, getStorageUsage } from '@/lib/supabase';
import { 
  formatKoreanDate, 
  getWeekDays, 
  getTodayString,
  formatDayOfWeek,
  toDateString,
  getKoreanNow
} from '@/lib/dateUtils';
import { formatMoney } from '@/lib/moneyUtils';
import { getStageEmoji, getMoodEmoji, getStageName, getColorName } from '@/lib/characterUtils';
import type { Profile, StudySession, TestResult, CharacterState } from '@/types/database';
import SettlementManager from '@/components/Settlement/SettlementManager';
import DayDetailModal from '@/components/Attendance/DayDetailModal';
import TestManager from '@/components/Attendance/TestManager';
import { BonusApprovalPanel } from '@/components/Settlement/BonusApprovalPanel';
import StatsGraph from '@/components/Stats/StatsGraph';

interface StudentData {
  profile: Profile;
  characterState: CharacterState | null;
  weekSessions: StudySession[];
  monthlyTests: TestResult[];
  weeklyReward: number;
  monthlyReward: number;
}

// 사진 저장소 관리 카드 컴포넌트
function StorageCleanupCard() {
  const [isLoading, setIsLoading] = useState(false);
  const [storageInfo, setStorageInfo] = useState<{ studyImages: number; testImages: number } | null>(null);
  const [monthlyUsage, setMonthlyUsage] = useState<{ uploads: number; limit: number } | null>(null);
  const [result, setResult] = useState<{ deleted: number; errors: string[] } | null>(null);

  // Netlify 무료 플랜 제한
  const NETLIFY_FREE_LIMIT = 125000; // 월 125,000회

  // 이번 달 업로드 횟수 계산
  async function checkMonthlyUsage() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    // 출석 사진 (이번 달)
    const { count: studyCount } = await supabase
      .from('study_sessions')
      .select('*', { count: 'exact', head: true })
      .gte('study_date', monthStart)
      .lte('study_date', monthEnd)
      .not('study_photo_url', 'is', null);

    // 시험 사진 (이번 달)
    const { count: testCount } = await supabase
      .from('test_results')
      .select('*', { count: 'exact', head: true })
      .gte('test_date', monthStart)
      .lte('test_date', monthEnd)
      .not('test_photo_url', 'is', null);

    return (studyCount || 0) + (testCount || 0);
  }

  // Storage 용량 확인
  async function checkStorage() {
    setIsLoading(true);
    try {
      const [info, uploads] = await Promise.all([
        getStorageUsage(),
        checkMonthlyUsage()
      ]);
      setStorageInfo(info);
      setMonthlyUsage({ uploads, limit: NETLIFY_FREE_LIMIT });
    } catch (error) {
      console.error('Storage 확인 실패:', error);
    } finally {
      setIsLoading(false);
    }
  }

  // 3개월 이전 사진 삭제
  async function handleCleanup() {
    const confirmed = confirm(
      '3개월 이전 사진을 모두 삭제하시겠습니까?\n\n⚠️ 이 작업은 되돌릴 수 없습니다.'
    );
    
    if (!confirmed) return;
    
    setIsLoading(true);
    setResult(null);
    
    try {
      const cleanupResult = await cleanupOldPhotos();
      setResult(cleanupResult);
      
      // Storage 정보 갱신
      await checkStorage();
      
      alert(`삭제 완료!\n- ${cleanupResult.deleted}개 파일 삭제\n- ${cleanupResult.errors.length}개 오류`);
    } catch (error) {
      console.error('정리 실패:', error);
      alert('사진 정리에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }

  // 사용률 퍼센트 계산
  const usagePercent = monthlyUsage ? Math.min((monthlyUsage.uploads / monthlyUsage.limit) * 100, 100) : 0;
  const usageColor = usagePercent < 50 ? 'bg-green-500' : usagePercent < 80 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="card">
      <h2 className="text-lg font-bold text-gray-800 mb-4">🗑️ 사진 저장소 관리</h2>
      
      <div className="space-y-4">
        {/* 월간 업로드 사용량 */}
        {monthlyUsage && (
          <div className="bg-blue-50 rounded-xl p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-blue-700">📤 이번 달 업로드</span>
              <span className="text-sm font-bold text-blue-800">
                {monthlyUsage.uploads.toLocaleString()} / {(monthlyUsage.limit / 1000).toFixed(0)}K
              </span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-3">
              <div 
                className={`h-3 rounded-full transition-all ${usageColor}`}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
            <p className="text-xs text-blue-600 mt-1 text-right">
              {usagePercent.toFixed(2)}% 사용 (Netlify 무료)
            </p>
          </div>
        )}

        {/* Storage 현황 */}
        {storageInfo && (
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-sm font-medium text-gray-600 mb-2">💾 전체 저장된 사진</p>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-xs text-gray-500">출석 사진</p>
                <p className="text-xl font-bold text-blue-600">{storageInfo.studyImages}장</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">시험 사진</p>
                <p className="text-xl font-bold text-green-600">{storageInfo.testImages}장</p>
              </div>
            </div>
          </div>
        )}

        {/* 결과 표시 */}
        {result && (
          <div className={`p-3 rounded-lg text-sm ${result.errors.length > 0 ? 'bg-yellow-50 text-yellow-700' : 'bg-green-50 text-green-700'}`}>
            ✅ {result.deleted}개 파일 삭제됨
            {result.errors.length > 0 && (
              <p className="mt-1 text-xs">⚠️ {result.errors.length}개 파일 삭제 실패</p>
            )}
          </div>
        )}

        {/* 버튼들 */}
        <div className="flex gap-2">
          <button
            onClick={checkStorage}
            disabled={isLoading}
            className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 text-sm"
          >
            {isLoading ? '확인 중...' : '📊 사용량 확인'}
          </button>
          <button
            onClick={handleCleanup}
            disabled={isLoading}
            className="flex-1 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 disabled:opacity-50 text-sm"
          >
            {isLoading ? '삭제 중...' : '🗑️ 3개월 이전 삭제'}
          </button>
        </div>

        <p className="text-xs text-gray-400 text-center">
          * 3개월이 지난 사진 자동 삭제로 저장 공간을 절약합니다
        </p>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { profile, signOut } = useAuth();
  const [students, setStudents] = useState<StudentData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'students' | 'settlement' | 'test'>('students');

  // 날짜 상세 모달 상태
  const [dayModal, setDayModal] = useState<{
    date: Date;
    session: StudySession | null;
    testResult: TestResult | null;
    userId: string;
    studentName: string;
  } | null>(null);

  const today = getKoreanNow();
  const weekDays = getWeekDays(today);

  useEffect(() => {
    loadAllStudents();
  }, []);

  async function loadAllStudents() {
    setIsLoading(true);
    
    // 1. 모든 학생 프로필 가져오기
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'student');

    if (profileError || !profiles) {
      console.error('Failed to load students:', profileError);
      setIsLoading(false);
      return;
    }

    // 2. 각 학생의 데이터 로드
    const studentDataPromises = profiles.map(async (studentProfile) => {
      // 캐릭터 상태
      const { data: charState } = await supabase
        .from('character_state')
        .select('*')
        .eq('user_id', studentProfile.id)
        .single();

      // 이번 주 세션
      const startDate = toDateString(weekDays[0]);
      const endDate = toDateString(weekDays[6]);
      
      const { data: sessions } = await supabase
        .from('study_sessions')
        .select('*')
        .eq('user_id', studentProfile.id)
        .gte('study_date', startDate)
        .lte('study_date', endDate)
        .order('study_date', { ascending: true });

      // 이번 달 시험 결과
      const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      const monthEnd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      const { data: tests } = await supabase
        .from('test_results')
        .select('*')
        .eq('user_id', studentProfile.id)
        .gte('test_date', monthStart)
        .lte('test_date', monthEnd)
        .order('test_date', { ascending: false });

      // 주간 수당 계산
      const weeklyReward = (sessions || [])
        .filter(s => s.is_present)
        .reduce((sum, s) => sum + s.base_amount + s.extra_amount, 0);

      // 월간 수당 (출석 + 시험)
      const monthlyTestReward = (tests || [])
        .reduce((sum, t) => sum + t.reward_amount, 0);

      return {
        profile: studentProfile,
        characterState: charState,
        weekSessions: sessions || [],
        monthlyTests: tests || [],
        weeklyReward,
        monthlyReward: weeklyReward + monthlyTestReward
      };
    });

    const allStudentData = await Promise.all(studentDataPromises);
    setStudents(allStudentData);
    setIsLoading(false);
  }

  // 요일별 출석 현황 가져오기
  function getAttendanceForDay(sessions: StudySession[], date: Date): boolean | null {
    const dateStr = toDateString(date);
    const session = sessions.find(s => s.study_date === dateStr);
    if (!session) return null;
    return session.is_present;
  }

  // 특정 날짜의 세션 가져오기
  function getSessionForDay(sessions: StudySession[], date: Date): StudySession | null {
    const dateStr = toDateString(date);
    return sessions.find(s => s.study_date === dateStr) || null;
  }

  // 특정 날짜의 시험 결과 가져오기
  function getTestForDay(tests: TestResult[], date: Date): TestResult | null {
    const dateStr = toDateString(date);
    return tests.find(t => t.test_date === dateStr) || null;
  }

  // 날짜 클릭 핸들러 (관리자)
  function handleDayClick(student: StudentData, date: Date) {
    const session = getSessionForDay(student.weekSessions, date);
    const testResult = getTestForDay(student.monthlyTests, date);
    
    setDayModal({
      date,
      session,
      testResult,
      userId: student.profile.id,
      studentName: student.profile.nickname
    });
  }

  // 사진 모달 상태
  const [photoModal, setPhotoModal] = useState<{ url: string; name: string } | null>(null);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-chick-50 to-chick-100">
        <div className="text-center">
          <div className="text-6xl animate-bounce-gentle mb-4">🐣</div>
          <p className="text-gray-500">학생 데이터 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-chick-50 to-chick-100 pb-8">
      {/* 헤더 */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-2xl">👑</span>
            <div>
              <h1 className="font-bold text-gray-800">관리자 대시보드</h1>
              <p className="text-xs text-gray-500">{profile?.nickname}님</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => loadAllStudents()}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors"
              title="새로고침"
            >
              🔄
            </button>
            <button
              onClick={signOut}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 pt-6">
        {/* 오늘 날짜 */}
        <div className="text-center mb-6">
          <p className="text-gray-600 text-lg">{formatKoreanDate(today)}</p>
        </div>

        {/* 탭 네비게이션 */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('students')}
            className={`flex-1 py-2 rounded-xl font-medium transition-colors text-sm ${
              activeTab === 'students'
                ? 'bg-chick-500 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            👥 학생
          </button>
          <button
            onClick={() => setActiveTab('test')}
            className={`flex-1 py-2 rounded-xl font-medium transition-colors text-sm ${
              activeTab === 'test'
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            📝 시험
          </button>
          <button
            onClick={() => setActiveTab('settlement')}
            className={`flex-1 py-2 rounded-xl font-medium transition-colors text-sm ${
              activeTab === 'settlement'
                ? 'bg-green-500 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            💳 정산
          </button>
        </div>

        {/* 시험 관리 탭 */}
        {activeTab === 'test' && (
          <div className="space-y-6">
            <TestManager />
          </div>
        )}

        {/* 정산 관리 탭 */}
        {activeTab === 'settlement' && (
          <div className="space-y-6">
            <SettlementManager />
            <BonusApprovalPanel />
            
            {/* 사진 정리 섹션 */}
            <StorageCleanupCard />
          </div>
        )}

        {/* 학생 관리 탭 */}
        {activeTab === 'students' && (
          <>
            {/* 학생이 없는 경우 */}
            {students.length === 0 && (
              <div className="bg-white rounded-2xl p-8 text-center shadow-md">
                <span className="text-5xl mb-4 block">🔍</span>
                <p className="text-gray-600">등록된 학생이 없습니다.</p>
                <p className="text-sm text-gray-400 mt-2">
                  Supabase에서 학생 계정을 생성해주세요.
                </p>
              </div>
            )}

        {/* 학생 카드 목록 */}
        <div className="space-y-6">
          {students.map((student, index) => (
            <motion.div
              key={student.profile.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white rounded-2xl shadow-md overflow-hidden"
            >
              {/* 학생 헤더 */}
              <div 
                className="p-4 bg-gradient-to-r from-chick-100 to-chick-200 cursor-pointer"
                onClick={() => setSelectedStudent(
                  selectedStudent === student.profile.id ? null : student.profile.id
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* 캐릭터 미니 아이콘 */}
                    <div className="text-3xl">
                      {student.characterState 
                        ? getStageEmoji(student.characterState.current_stage)
                        : '🥚'}
                    </div>
                    
                    <div>
                      <h2 className="font-bold text-lg text-gray-800">
                        {student.profile.nickname}
                      </h2>
                      <p className="text-sm text-gray-600">
                        {student.characterState 
                          ? `${getStageName(student.characterState.current_stage)} · ${getColorName(student.characterState.current_color)}`
                          : '캐릭터 없음'}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-sm text-gray-500">이번 주 수당</p>
                    <p className="font-bold text-chick-600">
                      {formatMoney(student.weeklyReward)}
                    </p>
                  </div>
                </div>
              </div>

              {/* 주간 출석 캘린더 (항상 표시) */}
              <div className="p-4 border-b border-gray-100">
                <h3 className="text-sm font-medium text-gray-500 mb-3">📅 이번 주 출석</h3>
                <div className="grid grid-cols-7 gap-1">
                  {weekDays.map((date, i) => {
                    const isToday = date.toDateString() === today.toDateString();
                    const dayOfWeek = date.getDay();
                    const isSunday = dayOfWeek === 0;
                    const session = getSessionForDay(student.weekSessions, date);
                    const attendance = session?.is_present ?? null;
                    
                    return (
                      <div key={i} className="text-center">
                        <p className={`text-xs mb-1 ${isSunday ? 'text-red-400' : 'text-gray-400'}`}>
                          {formatDayOfWeek(date)}
                        </p>
                        <div 
                          className={`
                            w-10 h-10 mx-auto rounded-lg flex items-center justify-center text-lg
                            ${isToday ? 'ring-2 ring-chick-400' : ''}
                            ${isSunday 
                              ? 'bg-gray-100 text-gray-400' 
                              : attendance === true 
                                ? 'bg-green-100 cursor-pointer hover:bg-green-200' 
                                : attendance === false 
                                  ? 'bg-red-100' 
                                  : 'bg-gray-50'}
                          `}
                          onClick={() => handleDayClick(student, date)}
                          title="클릭하여 상세 보기 / 수정"
                        >
                          {isSunday ? '😴' : attendance === true ? '✅' : attendance === false ? '❌' : '·'}
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{date.getDate()}</p>
                        {/* 시간 표시 */}
                        {session?.start_time && session?.end_time && (
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {session.start_time.slice(0, 5)}~{session.end_time.slice(0, 5)}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 상세 정보 (클릭시 펼침) */}
              {selectedStudent === student.profile.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="p-4 bg-gray-50"
                >
                  {/* 캐릭터 상태 */}
                  {student.characterState && (
                    <div className="mb-4">
                      <h3 className="text-sm font-medium text-gray-500 mb-2">🐣 캐릭터 상태</h3>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="bg-white rounded-lg p-3">
                          <p className="text-gray-400">연속 출석</p>
                          <p className="font-bold text-lg">{student.characterState.consecutive_days}일</p>
                        </div>
                        <div className="bg-white rounded-lg p-3">
                          <p className="text-gray-400">총 출석일</p>
                          <p className="font-bold text-lg">{student.characterState.total_days}일</p>
                        </div>
                        <div className="bg-white rounded-lg p-3">
                          <p className="text-gray-400">기분</p>
                          <p className="font-bold text-lg">
                            {getMoodEmoji(student.characterState.mood_level)} {student.characterState.mood_level}%
                          </p>
                        </div>
                        <div className="bg-white rounded-lg p-3">
                          <p className="text-gray-400">연속 결석</p>
                          <p className={`font-bold text-lg ${student.characterState.consecutive_absence > 0 ? 'text-red-500' : ''}`}>
                            {student.characterState.consecutive_absence}일
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 시험 결과 */}
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">📝 이번 달 시험</h3>
                    {student.monthlyTests.length === 0 ? (
                      <p className="text-gray-400 text-sm">아직 시험 기록이 없습니다.</p>
                    ) : (
                      <div className="space-y-2">
                        {student.monthlyTests.map(test => (
                          <div key={test.id} className="bg-white rounded-lg p-3 flex justify-between items-center">
                            <div>
                              <p className="font-medium">{test.test_date}</p>
                              <p className="text-sm text-gray-500">
                                {test.score}점 {test.is_pass ? '✅ 합격' : '❌ 불합격'}
                              </p>
                            </div>
                            <p className={`font-bold ${test.reward_amount > 0 ? 'text-green-600' : 'text-red-500'}`}>
                              {test.reward_amount > 0 ? '+' : ''}{formatMoney(test.reward_amount)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 수당 요약 */}
                  <div className="bg-white rounded-lg p-4">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">💰 수당 현황</h3>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">이번 주 출석 수당</span>
                      <span className="font-bold">{formatMoney(student.weeklyReward)}</span>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-gray-600">이번 달 시험 수당</span>
                      <span className="font-bold">
                        {formatMoney(student.monthlyTests.reduce((sum, t) => sum + t.reward_amount, 0))}
                      </span>
                    </div>
                    <hr className="my-2" />
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-800">총 수당</span>
                      <span className="font-bold text-lg text-chick-600">
                        {formatMoney(student.monthlyReward)}
                      </span>
                    </div>
                  </div>
                  
                  {/* 통계 그래프 */}
                  <div className="mt-4">
                    <StatsGraph userId={student.profile.id} />
                  </div>
                </motion.div>
              )}

              {/* 펼치기 힌트 */}
              <div 
                className="p-2 text-center text-gray-400 text-sm cursor-pointer hover:bg-gray-50"
                onClick={() => setSelectedStudent(
                  selectedStudent === student.profile.id ? null : student.profile.id
                )}
              >
                {selectedStudent === student.profile.id ? '▲ 접기' : '▼ 상세 보기'}
              </div>
            </motion.div>
          ))}
        </div>

        {/* 전체 통계 */}
        {students.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-8 bg-white rounded-2xl shadow-md p-6"
          >
            <h2 className="font-bold text-lg text-gray-800 mb-4">📊 전체 통계</h2>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-chick-50 rounded-xl p-4 text-center">
                <p className="text-gray-500 text-sm">총 학생 수</p>
                <p className="text-3xl font-bold text-chick-600">{students.length}명</p>
              </div>
              
              <div className="bg-green-50 rounded-xl p-4 text-center">
                <p className="text-gray-500 text-sm">오늘 출석</p>
                <p className="text-3xl font-bold text-green-600">
                  {students.filter(s => 
                    getAttendanceForDay(s.weekSessions, today) === true
                  ).length}명
                </p>
              </div>
              
              <div className="bg-blue-50 rounded-xl p-4 text-center">
                <p className="text-gray-500 text-sm">이번 주 총 수당</p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatMoney(students.reduce((sum, s) => sum + s.weeklyReward, 0))}
                </p>
              </div>
              
              <div className="bg-purple-50 rounded-xl p-4 text-center">
                <p className="text-gray-500 text-sm">평균 연속 출석</p>
                <p className="text-3xl font-bold text-purple-600">
                  {students.length > 0 
                    ? Math.round(
                        students.reduce((sum, s) => 
                          sum + (s.characterState?.consecutive_days || 0), 0
                        ) / students.length
                      )
                    : 0}일
                </p>
              </div>
            </div>
          </motion.div>
        )}
          </>
        )}


        {/* 하단 여백 */}
        <div className="h-8"></div>
      </main>

      {/* 사진 모달 */}
      {photoModal && (
        <div 
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setPhotoModal(null)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl overflow-hidden max-w-lg w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-chick-100 flex justify-between items-center">
              <h3 className="font-bold text-gray-800">📸 {photoModal.name}의 공부 인증</h3>
              <button 
                onClick={() => setPhotoModal(null)}
                className="w-8 h-8 rounded-full bg-white/50 hover:bg-white transition-colors"
              >
                ✕
              </button>
            </div>
            <img 
              src={photoModal.url} 
              alt="공부 인증 사진" 
              className="w-full max-h-[60vh] object-contain bg-gray-100"
            />
          </motion.div>
        </div>
      )}

      {/* 날짜 상세/수정 모달 */}
      {dayModal && (
        <DayDetailModal
          date={dayModal.date}
          session={dayModal.session}
          testResult={dayModal.testResult}
          isAdmin={true}
          userId={dayModal.userId}
          studentName={dayModal.studentName}
          onClose={() => setDayModal(null)}
          onUpdate={() => {
            loadAllStudents();
            setDayModal(null);
          }}
        />
      )}
    </div>
  );
}
