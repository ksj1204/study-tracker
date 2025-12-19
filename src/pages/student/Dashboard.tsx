import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/stores/authStore';
import { useCharacterStore } from '@/stores/characterStore';
import { useSettlementStore } from '@/stores/settlementStore';
import { supabase } from '@/lib/supabase';
import { 
  formatKoreanDate, 
  getWeekDays, 
  getTodayString,
  isStudyDay,
  isTestDay,
  isRestDay,
  formatDayOfWeek,
  checkIsToday,
  toDateString
} from '@/lib/dateUtils';
import { formatMoney } from '@/lib/moneyUtils';
import { getColorHex, getStageEmoji, getMoodEmoji, getStageName, getColorName } from '@/lib/characterUtils';
import type { StudySession, TestResult } from '@/types/database';
import CharacterDisplay from '@/components/Character/CharacterDisplay';
import WeeklyCalendar from '@/components/Attendance/WeeklyCalendar';
import AttendanceButton from '@/components/Attendance/AttendanceButton';
import TestSubmission from '@/components/Attendance/TestSubmission';
import SettlementCard from '@/components/Settlement/SettlementCard';
import DayDetailModal from '@/components/Attendance/DayDetailModal';
import { GrowthGuide } from '@/components/Character/GrowthGuide';
import { BonusRequestForm } from '@/components/Settlement/BonusRequestForm';
import StatsGraph from '@/components/Stats/StatsGraph';

// 출석 완료 카드 컴포넌트
function AttendanceCompleteCard({ 
  session, 
  onEdit 
}: { 
  session: StudySession; 
  onEdit: () => void;
}) {
  const [showPhoto, setShowPhoto] = useState(false);
  
  return (
    <div className="card bg-green-50">
      <div className="text-center py-4">
        <p className="text-3xl mb-2">✅</p>
        <p className="text-green-700 font-medium">오늘 출석 완료!</p>
        <p className="text-sm text-green-600 mt-1">
          수고했어요! +500원 적립 💪
        </p>
        {session.start_time && session.end_time && (
          <p className="text-sm text-green-600 mt-1">
            ⏰ {session.start_time.slice(0, 5)} ~ {session.end_time.slice(0, 5)}
          </p>
        )}
      </div>
      
      {/* 사진 보기/숨기기 */}
      {session.study_photo_url && (
        <div className="border-t border-green-200 pt-3">
          <button
            onClick={() => setShowPhoto(!showPhoto)}
            className="w-full text-sm text-green-600 hover:text-green-700"
          >
            {showPhoto ? '📷 사진 숨기기 ▲' : '📷 사진 보기 ▼'}
          </button>
          
          {showPhoto && (
            <div className="mt-3">
              <img 
                src={session.study_photo_url} 
                alt="출석 인증" 
                className="w-full rounded-lg max-h-60 object-cover"
              />
            </div>
          )}
        </div>
      )}
      
      {/* 수정 버튼 */}
      <div className="border-t border-green-200 pt-3 mt-3">
        <button
          onClick={onEdit}
          className="w-full py-2 text-sm text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
        >
          ⚠️ 수정하기 (출석 취소됨)
        </button>
        <p className="text-xs text-gray-400 text-center mt-1">
          수정 시 출석이 취소되고 다시 제출해야 합니다
        </p>
      </div>
    </div>
  );
}

// 시험 완료 카드 컴포넌트
function TestCompleteCard({ 
  testResult, 
  onEdit 
}: { 
  testResult: TestResult | null;
  onEdit: () => void;
}) {
  const [showPhotos, setShowPhotos] = useState(false);
  
  if (!testResult) return null;
  
  const photoUrls = (testResult as any).test_photo_urls?.length > 0 
    ? (testResult as any).test_photo_urls 
    : testResult.test_photo_url 
      ? [testResult.test_photo_url]
      : [];
  
  const isApproved = (testResult as any).is_approved;
  
  return (
    <div className="card bg-blue-50">
      <div className="text-center py-4">
        <p className="text-3xl mb-2">📝</p>
        <p className="text-blue-700 font-medium">시험 결과 제출 완료!</p>
        
        {isApproved ? (
          <div className="mt-2">
            <p className="text-lg font-bold text-blue-700">{testResult.score}점</p>
            {testResult.reward_amount > 0 && (
              <p className="text-green-600 text-sm">+{formatMoney(testResult.reward_amount)} 보너스!</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-blue-600 mt-1">
            ⏳ 관리자 승인 대기중 (입력 점수: {testResult.score}점)
          </p>
        )}
      </div>
      
      {/* 사진 보기/숨기기 */}
      {photoUrls.length > 0 && (
        <div className="border-t border-blue-200 pt-3">
          <button
            onClick={() => setShowPhotos(!showPhotos)}
            className="w-full text-sm text-blue-600 hover:text-blue-700"
          >
            {showPhotos ? `📷 사진 숨기기 (${photoUrls.length}장) ▲` : `📷 사진 보기 (${photoUrls.length}장) ▼`}
          </button>
          
          {showPhotos && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {photoUrls.map((url: string, index: number) => (
                <img 
                  key={index}
                  src={url} 
                  alt={`시험 사진 ${index + 1}`} 
                  className="w-full rounded-lg h-32 object-cover"
                />
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* 수정 버튼 - 승인 전에만 */}
      {!isApproved && (
        <div className="border-t border-blue-200 pt-3 mt-3">
          <button
            onClick={onEdit}
            className="w-full py-2 text-sm text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
          >
            ⚠️ 수정하기 (제출 취소됨)
          </button>
          <p className="text-xs text-gray-400 text-center mt-1">
            수정 시 기존 제출이 취소되고 다시 제출해야 합니다
          </p>
        </div>
      )}
    </div>
  );
}


export default function StudentDashboard() {
  const { profile, signOut } = useAuth();
  const { 
    characterState, 
    fetchCharacterState, 
    checkAndProcessAbsences,
    handleAttendance,
    initializeCharacter 
  } = useCharacterStore();
  
  const [weekSessions, setWeekSessions] = useState<StudySession[]>([]);
  const [todaySession, setTodaySession] = useState<StudySession | null>(null);
  const [weeklyReward, setWeeklyReward] = useState(0);
  const [isAttending, setIsAttending] = useState(false);
  const [missedDaysCount, setMissedDaysCount] = useState(0);
  
  // 날짜 상세 모달
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSession, setSelectedSession] = useState<StudySession | null>(null);
  const [selectedTestResult, setSelectedTestResult] = useState<TestResult | null>(null);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  
  // 오늘 시험 제출 여부
  const [todayTestSubmitted, setTodayTestSubmitted] = useState(false);
  
  // 저번주 시험 점수
  const [prevWeekScore, setPrevWeekScore] = useState<number | null>(null);

  const userId = profile?.id;
  const today = new Date();

  // 초기 데이터 로드
  useEffect(() => {
    if (!userId) return;
    
    async function loadData() {
      // 캐릭터 상태 로드
      await fetchCharacterState(userId);
      
      // 캐릭터가 없으면 초기화
      const { characterState } = useCharacterStore.getState();
      if (!characterState) {
        await initializeCharacter(userId);
      }
      
      // 결석 체크 및 처리
      const missed = await checkAndProcessAbsences(userId);
      setMissedDaysCount(missed);
      
      // 이번 주 세션 로드
      await loadWeekSessions();
      
      // 이번 주 시험 결과 로드
      await loadTestResults();
      
      // 저번주 시험 점수 로드
      await loadPrevWeekScore();
    }
    
    loadData();
  }, [userId]);

  // 저번주 시험 점수 로드
  async function loadPrevWeekScore() {
    if (!userId) return;
    
    // 이번 주 월요일 기준으로 지난주 날짜 계산
    const weekDays = getWeekDays();
    const thisWeekStart = weekDays[0];
    
    const prevWeekStart = new Date(thisWeekStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);
    const prevWeekEnd = new Date(thisWeekStart);
    prevWeekEnd.setDate(prevWeekEnd.getDate() - 1);
    
    const { data, error } = await supabase
      .from('test_results')
      .select('score')
      .eq('user_id', userId)
      .eq('is_approved', true)
      .gte('test_date', prevWeekStart.toISOString().split('T')[0])
      .lte('test_date', prevWeekEnd.toISOString().split('T')[0])
      .order('test_date', { ascending: false })
      .limit(1);
    
    if (!error && data && data.length > 0) {
      setPrevWeekScore(data[0].score);
    }
  }

  // 이번 주 세션 로드
  async function loadWeekSessions() {
    if (!userId) return;
    
    const weekDays = getWeekDays();
    const startDate = weekDays[0].toISOString().split('T')[0];
    const endDate = weekDays[6].toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('study_sessions')
      .select('*')
      .eq('user_id', userId)
      .gte('study_date', startDate)
      .lte('study_date', endDate)
      .order('study_date', { ascending: true });
    
    if (!error && data) {
      setWeekSessions(data);
      
      // 오늘 세션 찾기
      const todayStr = getTodayString();
      const todaySess = data.find(s => s.study_date === todayStr);
      setTodaySession(todaySess || null);
      
      // 주간 수당 계산
      const total = data
        .filter(s => s.is_present)
        .reduce((sum, s) => sum + s.base_amount + s.extra_amount, 0);
      setWeeklyReward(total);
    }
  }

  // 이번 주 시험 결과 로드
  async function loadTestResults() {
    if (!userId) return;
    
    const weekDays = getWeekDays();
    const startDate = weekDays[0].toISOString().split('T')[0];
    const endDate = weekDays[6].toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('test_results')
      .select('*')
      .eq('user_id', userId)
      .gte('test_date', startDate)
      .lte('test_date', endDate);
    
    if (!error && data) {
      setTestResults(data);
      
      // 오늘 시험 제출 여부 확인
      const todayStr = getTodayString();
      const todayTest = data.find(t => t.test_date === todayStr);
      setTodayTestSubmitted(!!todayTest);
    }
  }

  // 날짜 클릭 핸들러
  function handleDayClick(date: Date) {
    const dateStr = toDateString(date);
    const session = weekSessions.find(s => s.study_date === dateStr) || null;
    const testResult = testResults.find(t => t.test_date === dateStr) || null;
    
    setSelectedDate(date);
    setSelectedSession(session);
    setSelectedTestResult(testResult);
  }

  // 출석 처리
  async function onAttendance(photoUrl: string, startTime: string, endTime: string) {
    if (!userId) return;
    
    setIsAttending(true);
    
    try {
      const todayStr = getTodayString();
      
      // 세션 생성/업데이트
      const { error } = await supabase
        .from('study_sessions')
        .upsert({
          user_id: userId,
          study_date: todayStr,
          is_present: true,
          study_photo_url: photoUrl,
          start_time: startTime,
          end_time: endTime,
          base_amount: 500,
          extra_amount: 0,
        }, { onConflict: 'user_id,study_date' });
      
      if (error) throw error;
      
      // 캐릭터 업데이트
      await handleAttendance(userId);
      
      // 세션 다시 로드
      await loadWeekSessions();
      
    } catch (error) {
      console.error('출석 처리 실패:', error);
      alert('출석 처리에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsAttending(false);
    }
  }

  // 출석 수정 핸들러 (출석 취소 후 다시 제출 가능하게)
  async function handleEditAttendance() {
    if (!userId || !todaySession) return;
    
    const confirmed = confirm(
      '출석을 수정하시겠습니까?\n\n⚠️ 주의: 기존 출석이 취소되고, 다시 제출해야 합니다.'
    );
    
    if (!confirmed) return;
    
    try {
      // 출석 취소 (is_present = false, 수당 0으로)
      const { error } = await supabase
        .from('study_sessions')
        .update({
          is_present: false,
          base_amount: 0,
          extra_amount: 0
        })
        .eq('id', todaySession.id);
      
      if (error) throw error;
      
      // 세션 다시 로드
      await loadWeekSessions();
      alert('출석이 취소되었습니다. 다시 제출해주세요.');
      
    } catch (error) {
      console.error('출석 수정 실패:', error);
      alert('수정에 실패했습니다.');
    }
  }

  // 시험 수정 핸들러 (제출 취소 후 다시 제출 가능하게)
  async function handleEditTest() {
    if (!userId) return;
    
    const todayTest = testResults.find(t => t.test_date === getTodayString());
    if (!todayTest) return;
    
    // 승인된 건 수정 불가
    if ((todayTest as any).is_approved) {
      alert('이미 승인된 시험 결과는 수정할 수 없습니다.');
      return;
    }
    
    const confirmed = confirm(
      '시험 결과를 수정하시겠습니까?\n\n⚠️ 주의: 기존 제출이 삭제되고, 다시 제출해야 합니다.'
    );
    
    if (!confirmed) return;
    
    try {
      // 시험 결과 삭제
      const { error } = await supabase
        .from('test_results')
        .delete()
        .eq('id', todayTest.id);
      
      if (error) throw error;
      
      // 상태 초기화 (TestSubmission이 다시 보이게)
      setTodayTestSubmitted(false);
      
      // 다시 로드
      await loadTestResults();
      alert('시험 제출이 취소되었습니다. 다시 제출해주세요.');
      
    } catch (error) {
      console.error('시험 수정 실패:', error);
      alert('수정에 실패했습니다.');
    }
  }

  // 오늘 출석 가능 여부
  const canAttendToday = isStudyDay(today) && !todaySession?.is_present;
  const isRest = isRestDay(today);
  const isTest = isTestDay(today);

  return (
    <div className="min-h-screen bg-gradient-to-br from-chick-50 via-white to-chick-100">
      {/* 헤더 */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-800">
              안녕, {profile?.nickname}! 👋
            </h1>
            <p className="text-sm text-gray-500">
              {formatKoreanDate(today)}
            </p>
          </div>
          <button
            onClick={signOut}
            className="text-sm text-gray-400 hover:text-gray-600"
          >
            로그아웃
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* 결석 알림 */}
        {missedDaysCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700"
          >
            <p className="font-medium">
              😢 {missedDaysCount}일 결석 처리되었어요
            </p>
            <p className="text-sm mt-1">
              오늘 출석하면 다시 연속 출석을 시작할 수 있어요!
            </p>
          </motion.div>
        )}

        {/* 캐릭터 카드 */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="card text-center"
        >
          <CharacterDisplay 
            stage={characterState?.current_stage || 'egg'}
            color={characterState?.current_color || 'red'}
            moodLevel={characterState?.mood_level || 50}
            consecutiveDays={characterState?.consecutive_days || 0}
          />
          
          {/* 진행 바 */}
          <div className="mt-4">
            <div className="flex justify-between text-sm text-gray-500 mb-1">
              <span>다음 색상까지</span>
              <span>
                {characterState?.current_color !== 'violet' 
                  ? `${getColorName(characterState?.current_color || 'red')} → 다음 색`
                  : '🎉 최고 단계!'}
              </span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill rainbow-gradient"
                style={{ 
                  width: characterState?.current_color === 'violet' 
                    ? '100%' 
                    : `${(((['red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'violet'].indexOf(characterState?.current_color || 'red')) + 1) / 7) * 100}%`
                }}
              />
            </div>
          </div>
        </motion.div>

        {/* 이번 주 출석 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card"
        >
          <h2 className="text-lg font-bold text-gray-800 mb-4">
            📅 이번 주 출석
          </h2>
          <WeeklyCalendar 
            sessions={weekSessions} 
            today={today}
            onDayClick={handleDayClick}
          />
          <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
            <span className="text-gray-600">이번 주 예상 수당</span>
            <span className="text-xl font-bold text-chick-600">
              {formatMoney(weeklyReward)} 💰
            </span>
          </div>
        </motion.div>

        {/* 저번주 시험 점수 & 이번주 목표 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="card bg-gradient-to-r from-blue-50 to-indigo-50"
        >
          <h2 className="text-lg font-bold text-gray-800 mb-4">
            📝 시험 점수 현황
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {/* 저번주 점수 */}
            <div className="bg-white rounded-xl p-4 text-center shadow-sm">
              <p className="text-sm text-gray-500 mb-1">저번주 점수</p>
              <p className="text-3xl font-bold text-blue-600">
                {prevWeekScore !== null ? `${prevWeekScore}점` : '-'}
              </p>
              {prevWeekScore === null && (
                <p className="text-xs text-gray-400 mt-1">기록 없음</p>
              )}
            </div>
            
            {/* 이번주 점수 */}
            <div className="bg-white rounded-xl p-4 text-center shadow-sm">
              <p className="text-sm text-gray-500 mb-1">이번주 점수</p>
              {(() => {
                const thisWeekTest = testResults.find(t => t.is_approved);
                if (thisWeekTest) {
                  const diff = prevWeekScore !== null ? thisWeekTest.score - prevWeekScore : null;
                  return (
                    <>
                      <p className="text-3xl font-bold text-green-600">
                        {thisWeekTest.score}점
                      </p>
                      {diff !== null && (
                        <p className={`text-sm font-medium ${diff >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {diff >= 0 ? '↑' : '↓'} {Math.abs(diff).toFixed(1)}점
                          {diff >= 0.1 && ' 🎉+500원'}
                        </p>
                      )}
                    </>
                  );
                } else {
                  return (
                    <>
                      <p className="text-3xl font-bold text-gray-400">-</p>
                      <p className="text-xs text-gray-400 mt-1">아직 미등록</p>
                    </>
                  );
                }
              })()}
            </div>
          </div>
          
          {/* 목표 안내 */}
          {prevWeekScore !== null && !testResults.find(t => t.is_approved) && (
            <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <p className="text-sm text-yellow-700">
                🎯 <strong>{(prevWeekScore + 0.1).toFixed(1)}점</strong> 이상 받으면 +500원 보너스!
              </p>
            </div>
          )}
        </motion.div>

        {/* 통계 그래프 */}
        {userId && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.13 }}
          >
            <StatsGraph userId={userId} />
          </motion.div>
        )}

        {/* 수당 현황 카드 */}
        {userId && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <SettlementCard userId={userId} />
          </motion.div>
        )}

        {/* 추가수당 신청 */}
        {userId && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
          >
            <BonusRequestForm userId={userId} />
          </motion.div>
        )}

        {/* 성장 가이드 */}
        {characterState && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22 }}
          >
            <GrowthGuide
              currentStage={characterState.current_stage}
              currentColor={characterState.current_color}
              moodLevel={characterState.mood_level}
              consecutiveAbsence={characterState.consecutive_absence}
            />
          </motion.div>
        )}

        {/* 출석/시험 버튼 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {isRest ? (
            <div className="card text-center py-8">
              <p className="text-4xl mb-2">💤</p>
              <p className="text-gray-600">오늘은 휴무일이에요!</p>
              <p className="text-sm text-gray-400 mt-1">푹 쉬고 내일 만나요~</p>
            </div>
          ) : isTest ? (
            // 시험일 UI - 출석 + 시험 둘 다 표시
            <div className="space-y-4">
              {/* 출석 영역 */}
              {todaySession?.is_present ? (
                <AttendanceCompleteCard 
                  session={todaySession}
                  onEdit={() => handleEditAttendance()}
                />
              ) : (
                <AttendanceButton
                  onAttendance={onAttendance}
                  isLoading={isAttending}
                  disabled={false}
                />
              )}
              
              {/* 시험 영역 */}
              {todayTestSubmitted ? (
                <TestCompleteCard
                  testResult={testResults.find(t => t.test_date === getTodayString()) || null}
                  onEdit={() => handleEditTest()}
                />
              ) : (
                <TestSubmission 
                  userId={userId!} 
                  onSubmitted={() => {
                    setTodayTestSubmitted(true);
                    loadTestResults();
                  }}
                />
              )}
            </div>
          ) : todaySession?.is_present ? (
            <AttendanceCompleteCard 
              session={todaySession}
              onEdit={() => handleEditAttendance()}
            />
          ) : (
            <AttendanceButton
              onAttendance={onAttendance}
              isLoading={isAttending}
              disabled={!canAttendToday}
            />
          )}
        </motion.div>
      </main>

      {/* 날짜 상세 모달 */}
      {selectedDate && userId && (
        <DayDetailModal
          date={selectedDate}
          session={selectedSession}
          testResult={selectedTestResult}
          isAdmin={false}
          userId={userId}
          onClose={() => setSelectedDate(null)}
          onUpdate={() => {
            loadWeekSessions();
            loadTestResults();
          }}
        />
      )}
    </div>
  );
}
