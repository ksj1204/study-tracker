/**
 * 시험 결과 관리 컴포넌트 (관리자용)
 * - 시험 점수 승인/수정/직접 등록
 * - 지난주 대비 점수 상승 시 보너스 지급
 */

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { supabase, uploadTestImage } from '@/lib/supabase';
import { formatMoney } from '@/lib/moneyUtils';
import { getWeekStart, getWeekEnd, toDateString, formatKoreanDate, getTodayString } from '@/lib/dateUtils';
import { validateImageFile, resizeAndCompressImage, isAndroid } from '@/lib/imageUtils';
import type { TestResult, Profile } from '@/types/database';

interface TestResultWithProfile extends TestResult {
  profiles?: { nickname: string };
}

interface TestManagerProps {
  onClose?: () => void;
}

export default function TestManager({ onClose }: TestManagerProps) {
  const [testResults, setTestResults] = useState<TestResultWithProfile[]>([]);
  const [students, setStudents] = useState<Profile[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(getTodayString());
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // 점수 등록 모달
  const [scoreModal, setScoreModal] = useState<{
    studentId: string;
    studentName: string;
    currentScore: number;
    prevScore: number | null;
    isNew: boolean;
    testResultId?: string;
  } | null>(null);
  const [newScore, setNewScore] = useState<string>('');

  // 사진 뷰어 모달
  const [photoViewer, setPhotoViewer] = useState<{
    urls: string[];
    currentIndex: number;
    studentName: string;
  } | null>(null);

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  async function loadData() {
    setIsLoading(true);
    try {
      // 학생 목록
      const { data: studentProfiles } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student');

      setStudents(studentProfiles || []);

      // 선택한 날짜의 시험 결과
      const { data: results } = await supabase
        .from('test_results')
        .select('*, profiles(nickname)')
        .eq('test_date', selectedDate)
        .order('created_at', { ascending: false });

      setTestResults(results as TestResultWithProfile[] || []);
    } catch (error) {
      console.error('데이터 로드 실패:', error);
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * 지난주 시험 점수 가져오기
   */
  async function getPrevWeekScore(userId: string, currentDate: string): Promise<number | null> {
    // 현재 날짜에서 7일 전 범위 계산
    const current = new Date(currentDate);
    const prevWeekStart = new Date(current);
    prevWeekStart.setDate(prevWeekStart.getDate() - 14);
    const prevWeekEnd = new Date(current);
    prevWeekEnd.setDate(prevWeekEnd.getDate() - 7);

    const { data } = await supabase
      .from('test_results')
      .select('score')
      .eq('user_id', userId)
      .eq('is_approved', true)
      .gte('test_date', toDateString(prevWeekStart))
      .lt('test_date', toDateString(prevWeekEnd))
      .order('test_date', { ascending: false })
      .limit(1);

    return (data as any)?.[0]?.score ?? null;
  }

  /**
   * 시험 결과 승인
   */
  async function handleApprove(testResult: TestResultWithProfile, approvedScore?: number) {
    if (processingId) return;
    setProcessingId(testResult.id);

    try {
      const score = approvedScore ?? testResult.score;
      const prevScore = await getPrevWeekScore(testResult.user_id, testResult.test_date);
      
      // 점수 상승 보너스 계산 (0.1점 이상 상승 시 500원)
      let rewardAmount = 0;
      let isPass = false;
      
      if (prevScore !== null && score > prevScore) {
        // 0.1점 이상 상승
        if (score - prevScore >= 0.1) {
          rewardAmount = 500;
          isPass = true;
        }
      }

      const { error } = await (supabase
        .from('test_results') as any)
        .update({
          score,
          prev_score: prevScore,
          is_approved: true,
          is_pass: isPass,
          reward_amount: rewardAmount,
          approved_at: new Date().toISOString(),
        })
        .eq('id', testResult.id);

      if (error) throw error;

      alert(`승인 완료! ${rewardAmount > 0 ? `보너스 ${formatMoney(rewardAmount)} 지급` : '점수 하락/유지'}`);
      loadData();
    } catch (error) {
      console.error('승인 실패:', error);
      alert('승인에 실패했습니다.');
    } finally {
      setProcessingId(null);
    }
  }

  /**
   * 점수 수정 모달 열기
   */
  async function openScoreModal(testResult?: TestResultWithProfile, student?: Profile) {
    if (testResult) {
      // 기존 결과 수정
      const prevScore = await getPrevWeekScore(testResult.user_id, testResult.test_date);
      setScoreModal({
        studentId: testResult.user_id,
        studentName: testResult.profiles?.nickname || '알 수 없음',
        currentScore: testResult.score,
        prevScore,
        isNew: false,
        testResultId: testResult.id,
      });
      setNewScore(String(testResult.score));
    } else if (student) {
      // 새 등록
      const prevScore = await getPrevWeekScore(student.id, selectedDate);
      setScoreModal({
        studentId: student.id,
        studentName: student.nickname,
        currentScore: 0,
        prevScore,
        isNew: true,
      });
      setNewScore('');
    }
  }

  /**
   * 점수 저장 (수정 또는 새 등록)
   */
  async function handleSaveScore() {
    if (!scoreModal) return;

    const score = parseFloat(newScore);
    if (isNaN(score) || score < 0 || score > 100) {
      alert('점수는 0~100 사이의 숫자여야 합니다.');
      return;
    }

    setProcessingId(scoreModal.testResultId || 'new');

    try {
      // 보너스 계산
      let rewardAmount = 0;
      let isPass = false;
      
      if (scoreModal.prevScore !== null && score > scoreModal.prevScore) {
        if (score - scoreModal.prevScore >= 0.1) {
          rewardAmount = 500;
          isPass = true;
        }
      }

      if (scoreModal.isNew) {
        // 새 등록
        const { error } = await supabase
          .from('test_results')
          .insert({
            user_id: scoreModal.studentId,
            test_date: selectedDate,
            score,
            prev_score: scoreModal.prevScore,
            is_approved: true,
            is_pass: isPass,
            reward_amount: rewardAmount,
            manual_score_input: true,
            approved_at: new Date().toISOString(),
          } as any);

        if (error) throw error;
      } else {
        // 수정
        const { error } = await (supabase
          .from('test_results') as any)
          .update({
            score,
            prev_score: scoreModal.prevScore,
            is_approved: true,
            is_pass: isPass,
            reward_amount: rewardAmount,
            approved_at: new Date().toISOString(),
          })
          .eq('id', scoreModal.testResultId);

        if (error) throw error;
      }

      alert(`점수 저장 완료! ${rewardAmount > 0 ? `보너스 ${formatMoney(rewardAmount)} 지급` : ''}`);
      setScoreModal(null);
      loadData();
    } catch (error) {
      console.error('저장 실패:', error);
      alert('저장에 실패했습니다.');
    } finally {
      setProcessingId(null);
    }
  }

  /**
   * 시험 결과 삭제
   */
  async function handleDelete(testResultId: string) {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    
    setProcessingId(testResultId);
    try {
      const { error } = await supabase
        .from('test_results')
        .delete()
        .eq('id', testResultId);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('삭제 실패:', error);
      alert('삭제에 실패했습니다.');
    } finally {
      setProcessingId(null);
    }
  }

  // 등록되지 않은 학생 목록
  const studentsWithoutResult = students.filter(
    s => !testResults.some(t => t.user_id === s.id)
  );

  if (isLoading) {
    return (
      <div className="card text-center py-8">
        <div className="text-4xl animate-bounce-gentle mb-2">📝</div>
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-800">📝 시험 점수 관리</h2>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        )}
      </div>

      {/* 날짜 선택 */}
      <div className="mb-4">
        <label className="block text-sm text-gray-600 mb-1">날짜 선택</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      {/* 승인 대기 목록 */}
      {testResults.filter(t => !t.is_approved).length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-orange-600 mb-2">⏳ 승인 대기 ({testResults.filter(t => !t.is_approved).length})</h3>
          <div className="space-y-2">
            {testResults.filter(t => !t.is_approved).map(result => (
              <div key={result.id} className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="font-medium">{result.profiles?.nickname}</span>
                    <span className="text-gray-500 text-sm ml-2">
                      {result.manual_score_input ? '(수동 입력)' : '(사진 제출)'}
                    </span>
                  </div>
                  <div className="text-lg font-bold">{result.score}점</div>
                </div>
                
                {/* 사진 미리보기 */}
                {(result.test_photo_urls?.length || result.test_photo_url) && (
                  <div className="flex gap-2 mb-2 overflow-x-auto">
                    {(result.test_photo_urls || [result.test_photo_url]).filter(Boolean).map((url, i) => (
                      <img
                        key={i}
                        src={url!}
                        alt={`시험 사진 ${i + 1}`}
                        className="w-16 h-16 object-cover rounded cursor-pointer hover:opacity-80"
                        onClick={() => setPhotoViewer({
                          urls: result.test_photo_urls || [result.test_photo_url!],
                          currentIndex: i,
                          studentName: result.profiles?.nickname || ''
                        })}
                      />
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(result)}
                    disabled={processingId === result.id}
                    className="flex-1 py-1.5 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 text-sm"
                  >
                    ✅ 승인
                  </button>
                  <button
                    onClick={() => openScoreModal(result)}
                    className="flex-1 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                  >
                    ✏️ 점수 수정
                  </button>
                  <button
                    onClick={() => handleDelete(result.id)}
                    disabled={processingId === result.id}
                    className="py-1.5 px-3 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 text-sm"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 승인 완료 목록 */}
      {testResults.filter(t => t.is_approved).length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-green-600 mb-2">✅ 승인 완료 ({testResults.filter(t => t.is_approved).length})</h3>
          <div className="space-y-2">
            {testResults.filter(t => t.is_approved).map(result => (
              <div key={result.id} className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">{result.profiles?.nickname}</span>
                    <span className="text-gray-500 text-sm ml-2">
                      {result.prev_score !== null && result.prev_score !== undefined 
                        ? `(이전: ${result.prev_score}점)` 
                        : '(첫 시험)'}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">{result.score}점</div>
                    {result.reward_amount > 0 && (
                      <div className="text-green-600 text-sm">+{formatMoney(result.reward_amount)}</div>
                    )}
                  </div>
                </div>

                {/* 사진 미리보기 - 승인 완료 항목에도 추가 */}
                {(result.test_photo_urls?.length || result.test_photo_url) && (
                  <div className="flex gap-2 mt-2 overflow-x-auto">
                    {(result.test_photo_urls || [result.test_photo_url]).filter(Boolean).map((url, i) => (
                      <img
                        key={i}
                        src={url!}
                        alt={`시험 사진 ${i + 1}`}
                        className="w-16 h-16 object-cover rounded cursor-pointer hover:opacity-80"
                        onClick={() => setPhotoViewer({
                          urls: result.test_photo_urls || [result.test_photo_url!],
                          currentIndex: i,
                          studentName: result.profiles?.nickname || ''
                        })}
                      />
                    ))}
                  </div>
                )}

                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => openScoreModal(result)}
                    className="flex-1 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 text-sm"
                  >
                    ✏️ 수정
                  </button>
                  <button
                    onClick={() => handleDelete(result.id)}
                    disabled={processingId === result.id}
                    className="py-1 px-3 bg-gray-100 text-red-500 rounded hover:bg-gray-200 disabled:opacity-50 text-sm"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 미등록 학생 목록 */}
      {studentsWithoutResult.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-2">📋 미등록 학생</h3>
          <div className="space-y-2">
            {studentsWithoutResult.map(student => (
              <div key={student.id} className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-center justify-between">
                <span>{student.nickname}</span>
                <button
                  onClick={() => openScoreModal(undefined, student)}
                  className="py-1 px-3 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                >
                  ➕ 점수 등록
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 점수 입력 모달 */}
      {scoreModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl p-6 max-w-sm w-full"
          >
            <h3 className="text-lg font-bold mb-4">
              {scoreModal.isNew ? '📝 점수 등록' : '✏️ 점수 수정'}
            </h3>
            
            <div className="mb-4">
              <p className="text-gray-600 mb-2">학생: <strong>{scoreModal.studentName}</strong></p>
              {scoreModal.prevScore !== null && (
                <p className="text-sm text-gray-500">지난주 점수: {scoreModal.prevScore}점</p>
              )}
            </div>

            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-1">점수</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={newScore}
                  onChange={(e) => setNewScore(e.target.value)}
                  placeholder="0 ~ 100"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <span className="text-gray-500">점</span>
              </div>
            </div>

            {/* 예상 보너스 표시 */}
            {newScore && scoreModal.prevScore !== null && (
              <div className="mb-4 p-2 bg-blue-50 rounded-lg text-sm">
                {parseFloat(newScore) - scoreModal.prevScore >= 0.1 ? (
                  <span className="text-green-600">✅ 점수 상승! +500원 보너스</span>
                ) : (
                  <span className="text-gray-500">점수 유지/하락 - 보너스 없음</span>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setScoreModal(null)}
                className="flex-1 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
              >
                취소
              </button>
              <button
                onClick={handleSaveScore}
                disabled={processingId !== null}
                className="flex-1 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
              >
                {processingId ? '저장 중...' : '저장'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* 사진 뷰어 모달 */}
      {photoViewer && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setPhotoViewer(null)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative max-w-2xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white rounded-t-2xl p-3 flex justify-between items-center">
              <span className="font-medium">{photoViewer.studentName}의 시험 사진 ({photoViewer.currentIndex + 1}/{photoViewer.urls.length})</span>
              <button onClick={() => setPhotoViewer(null)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <img
              src={photoViewer.urls[photoViewer.currentIndex]}
              alt="시험 사진"
              className="w-full max-h-[70vh] object-contain bg-gray-100"
            />
            {photoViewer.urls.length > 1 && (
              <div className="bg-white rounded-b-2xl p-3 flex justify-center gap-2">
                {photoViewer.urls.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPhotoViewer({ ...photoViewer, currentIndex: i })}
                    className={`w-3 h-3 rounded-full ${i === photoViewer.currentIndex ? 'bg-blue-500' : 'bg-gray-300'}`}
                  />
                ))}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}
