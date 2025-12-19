// ============================================================================
// 정산 관리 (관리자용) - 학생별 정산 처리
// ============================================================================

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useSettlementStore } from '@/stores/settlementStore';
import { supabase } from '@/lib/supabase';
import { formatMoney } from '@/lib/moneyUtils';
import { getWeekStart, getWeekEnd, toDateString, formatKoreanDate } from '@/lib/dateUtils';
import { validateImageFile } from '@/lib/imageUtils';
import type { Settlement, Profile } from '@/types/database';

interface SettlementWithProfile extends Settlement {
  profiles?: { nickname: string };
}

interface SettlementManagerProps {
  onClose?: () => void;
}

export default function SettlementManager({ onClose }: SettlementManagerProps) {
  const { 
    fetchAllSettlements, 
    createSettlement, 
    processPayment,
    cancelPayment,
    deleteSettlement,
    recalculateSettlement,
    calculateWeeklySettlement 
  } = useSettlementStore();

  const [settlements, setSettlements] = useState<SettlementWithProfile[]>([]);
  const [students, setStudents] = useState<Profile[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<Date>(getWeekStart(new Date()));
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // 지급 모달 상태
  const [paymentModal, setPaymentModal] = useState<{
    settlement: SettlementWithProfile;
    paidAmount: number;
    note: string;
  } | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 파일 선택 핸들러 (유효성 검사 추가)
  const handleProofFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    
    // input 초기화 (같은 파일 재선택 가능하게)
    if (e.target) {
      e.target.value = '';
    }
    
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    setProofFile(file);
  };

  useEffect(() => {
    loadData();
  }, [selectedWeek]);

  async function loadData() {
    setIsLoading(true);
    try {
      // 학생 목록 가져오기
      const { data: studentProfiles } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student');

      setStudents(studentProfiles || []);

      // 해당 주 정산 가져오기
      const data = await fetchAllSettlements(selectedWeek);
      setSettlements(data as SettlementWithProfile[]);
    } catch (error) {
      console.error('데이터 로드 실패:', error);
      setSettlements([]);
    } finally {
      setIsLoading(false);
    }
  }

  // 정산 생성 (모든 학생)
  async function handleCreateSettlements() {
    setIsLoading(true);
    try {
      // 최신 학생 목록 다시 가져오기 (새로 추가된 학생 포함)
      const { data: latestStudents } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student');

      const studentsToProcess = (latestStudents || []) as Profile[];
      
      if (studentsToProcess.length === 0) {
        alert('등록된 학생이 없습니다.');
        return;
      }

      // 기존 정산이 있는 학생 ID 목록
      const existingUserIds = new Set(settlements.map(s => s.user_id));
      
      // 정산이 없는 학생만 필터링
      const studentsToCreate = studentsToProcess.filter(
        student => !existingUserIds.has(student.id)
      );

      if (studentsToCreate.length === 0) {
        alert('모든 학생의 정산이 이미 생성되어 있습니다.');
        return;
      }

      for (const student of studentsToCreate) {
        await createSettlement(student.id, selectedWeek);
      }
      await loadData();
      alert(`${studentsToCreate.length}명의 학생 정산이 생성되었습니다!`);
    } catch (error) {
      console.error('정산 생성 실패:', error);
      alert('정산 생성에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }

  // 전체 정산 재생성 (기존 삭제 후 재생성)
  async function handleRecreateAllSettlements() {
    if (!confirm('이번 주 모든 정산을 삭제하고 다시 생성하시겠습니까?\n지급 완료된 정산도 삭제됩니다!')) {
      return;
    }

    setIsLoading(true);
    try {
      // 기존 정산 모두 삭제
      for (const settlement of settlements) {
        await deleteSettlement(settlement.id);
      }

      // 최신 학생 목록으로 정산 재생성
      const { data: latestStudents } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student');

      const studentsToProcess = (latestStudents || []) as Profile[];
      
      if (studentsToProcess.length === 0) {
        alert('등록된 학생이 없습니다.');
        return;
      }

      for (const student of studentsToProcess) {
        await createSettlement(student.id, selectedWeek);
      }
      
      await loadData();
      alert(`${studentsToProcess.length}명의 학생 정산이 재생성되었습니다!`);
    } catch (error) {
      console.error('정산 재생성 실패:', error);
      alert('정산 재생성에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }

  // 지급 처리
  async function handlePayment() {
    if (!paymentModal) return;

    setProcessingId(paymentModal.settlement.id);
    try {
      let proofUrl: string | undefined;

      // 증빙 사진 업로드
      if (proofFile) {
        const fileExt = proofFile.name.split('.').pop();
        const fileName = `${paymentModal.settlement.user_id}/${Date.now()}.${fileExt}`;

        const { data, error } = await supabase.storage
          .from('payment-proofs')
          .upload(fileName, proofFile);

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
          .from('payment-proofs')
          .getPublicUrl(data.path);

        proofUrl = publicUrl;
      }

      await processPayment(
        paymentModal.settlement.id,
        paymentModal.paidAmount,
        proofUrl,
        paymentModal.note
      );

      setPaymentModal(null);
      setProofFile(null);
      await loadData();
      alert('지급 처리가 완료되었습니다!');
    } catch (error) {
      console.error('지급 처리 실패:', error);
      alert('지급 처리에 실패했습니다.');
    } finally {
      setProcessingId(null);
    }
  }

  // 주 이동
  function changeWeek(direction: number) {
    const newDate = new Date(selectedWeek);
    newDate.setDate(newDate.getDate() + direction * 7);
    setSelectedWeek(getWeekStart(newDate));
  }

  const weekEndDate = getWeekEnd(selectedWeek);

  return (
    <div className="bg-white rounded-2xl shadow-md overflow-hidden">
      {/* 헤더 */}
      <div className="p-4 bg-gradient-to-r from-green-100 to-green-200 flex justify-between items-center">
        <h2 className="font-bold text-lg text-gray-800">💳 정산 관리</h2>
        {onClose && (
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        )}
      </div>

      <div className="p-4">
        {/* 주 선택 */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => changeWeek(-1)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            ◀
          </button>
          <div className="text-center">
            <p className="font-medium text-gray-800">
              {toDateString(selectedWeek)} ~ {toDateString(weekEndDate)}
            </p>
            <p className="text-sm text-gray-500">
              {formatKoreanDate(selectedWeek).split(' ').slice(0, 3).join(' ')} 주
            </p>
          </div>
          <button
            onClick={() => changeWeek(1)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            ▶
          </button>
        </div>

        {/* 정산 생성 버튼 */}
        {settlements.length === 0 && !isLoading && (
          <button
            onClick={handleCreateSettlements}
            className="w-full py-3 bg-chick-500 text-white rounded-xl hover:bg-chick-600 mb-4"
          >
            📊 이번 주 정산 생성하기
          </button>
        )}

        {/* 정산 관리 버튼 (정산이 있을 때) */}
        {settlements.length > 0 && !isLoading && (
          <div className="flex gap-2 mb-4">
            <button
              onClick={handleCreateSettlements}
              className="flex-1 py-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 text-sm"
            >
              ➕ 누락된 학생 추가
            </button>
            <button
              onClick={handleRecreateAllSettlements}
              className="flex-1 py-2 bg-orange-100 text-orange-600 rounded-lg hover:bg-orange-200 text-sm"
            >
              🔄 전체 재생성
            </button>
          </div>
        )}

        {/* 로딩 */}
        {isLoading ? (
          <div className="text-center py-8">
            <div className="text-4xl animate-bounce">🐣</div>
            <p className="text-gray-500 mt-2">로딩 중...</p>
          </div>
        ) : settlements.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>해당 주의 정산 기록이 없습니다.</p>
            <p className="text-sm mt-1">위 버튼을 눌러 정산을 생성하세요.</p>
          </div>
        ) : (
          /* 정산 목록 */
          <div className="space-y-3">
            {settlements.map((settlement) => (
              <motion.div
                key={settlement.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`border rounded-xl p-4 ${
                  settlement.is_paid 
                    ? 'border-green-200 bg-green-50' 
                    : 'border-gray-200'
                }`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-gray-800">
                      {settlement.profiles?.nickname || '알 수 없음'}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {settlement.is_paid ? '✅ 지급 완료' : '⏳ 지급 대기'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">예상 수당</p>
                    <p className="font-bold text-lg text-chick-600">
                      {formatMoney(settlement.total_amount)}
                    </p>
                  </div>
                </div>

                {/* 수당 상세 */}
                <div className="grid grid-cols-3 gap-2 text-sm mb-3">
                  <div className="bg-white rounded-lg p-2 text-center">
                    <p className="text-gray-400 text-xs">출석</p>
                    <p className="font-medium">{formatMoney(settlement.attendance_amount)}</p>
                  </div>
                  <div className="bg-white rounded-lg p-2 text-center">
                    <p className="text-gray-400 text-xs">시험</p>
                    <p className="font-medium">{formatMoney(settlement.test_amount)}</p>
                  </div>
                  <div className="bg-white rounded-lg p-2 text-center">
                    <p className="text-gray-400 text-xs">추가</p>
                    <p className="font-medium">{formatMoney(settlement.bonus_amount)}</p>
                  </div>
                </div>

                {/* 지급 정보 */}
                {settlement.is_paid ? (
                  <div className="bg-white rounded-lg p-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">지급액</span>
                      <span className="font-bold text-green-600">
                        {formatMoney(settlement.paid_amount)}
                      </span>
                    </div>
                    {settlement.paid_at && (
                      <div className="flex justify-between text-sm mt-1">
                        <span className="text-gray-500">지급일</span>
                        <span>{new Date(settlement.paid_at).toLocaleDateString('ko-KR')}</span>
                      </div>
                    )}
                    {settlement.payment_note && (
                      <p className="text-xs text-gray-400 mt-2">
                        메모: {settlement.payment_note}
                      </p>
                    )}
                    {settlement.payment_proof_url && (
                      <a
                        href={settlement.payment_proof_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block mt-2 text-sm text-blue-500 hover:underline"
                      >
                        📎 증빙 사진 보기
                      </a>
                    )}
                    {/* 지급 취소 버튼 */}
                    <button
                      onClick={async () => {
                        if (!confirm('지급을 취소하시겠습니까?\n지급 완료 상태가 대기 상태로 변경됩니다.')) return;
                        setProcessingId(settlement.id);
                        try {
                          await cancelPayment(settlement.id);
                          await loadData();
                          alert('지급이 취소되었습니다.');
                        } catch (error) {
                          console.error('지급 취소 실패:', error);
                          alert('지급 취소에 실패했습니다.');
                        } finally {
                          setProcessingId(null);
                        }
                      }}
                      disabled={processingId === settlement.id}
                      className="w-full mt-2 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 disabled:opacity-50 text-sm"
                    >
                      {processingId === settlement.id ? '처리 중...' : '❌ 지급 취소'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <button
                      onClick={() => setPaymentModal({
                        settlement,
                        paidAmount: settlement.total_amount,
                        note: ''
                      })}
                      disabled={processingId === settlement.id}
                      className="w-full py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
                    >
                      {processingId === settlement.id ? '처리 중...' : '💸 지급 처리'}
                    </button>
                    {/* 재정산 버튼 */}
                    <button
                      onClick={async () => {
                        if (!confirm('정산을 다시 계산하시겠습니까?\n기존 정산 데이터가 삭제되고 최신 데이터로 재계산됩니다.')) return;
                        setProcessingId(settlement.id);
                        try {
                          await recalculateSettlement(settlement.id);
                          await loadData();
                          alert('재정산이 완료되었습니다!');
                        } catch (error) {
                          console.error('재정산 실패:', error);
                          alert('재정산에 실패했습니다.');
                        } finally {
                          setProcessingId(null);
                        }
                      }}
                      disabled={processingId === settlement.id}
                      className="w-full py-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 disabled:opacity-50 text-sm"
                    >
                      {processingId === settlement.id ? '처리 중...' : '🔄 재정산'}
                    </button>
                    {/* 정산 삭제 버튼 */}
                    <button
                      onClick={async () => {
                        if (!confirm('이 정산을 삭제하시겠습니까?\n삭제된 데이터는 복구할 수 없습니다.')) return;
                        setProcessingId(settlement.id);
                        try {
                          await deleteSettlement(settlement.id);
                          await loadData();
                          alert('정산이 삭제되었습니다.');
                        } catch (error) {
                          console.error('삭제 실패:', error);
                          alert('삭제에 실패했습니다.');
                        } finally {
                          setProcessingId(null);
                        }
                      }}
                      disabled={processingId === settlement.id}
                      className="w-full py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 disabled:opacity-50 text-sm"
                    >
                      {processingId === settlement.id ? '처리 중...' : '🗑️ 삭제'}
                    </button>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}

        {/* 통계 요약 */}
        {settlements.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-sm text-gray-500">총 예상 수당</p>
                <p className="font-bold text-lg">
                  {formatMoney(settlements.reduce((sum, s) => sum + s.total_amount, 0))}
                </p>
              </div>
              <div className="bg-green-50 rounded-xl p-3">
                <p className="text-sm text-gray-500">지급 완료</p>
                <p className="font-bold text-lg text-green-600">
                  {formatMoney(settlements.filter(s => s.is_paid).reduce((sum, s) => sum + s.paid_amount, 0))}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 지급 모달 */}
      {paymentModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setPaymentModal(null)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-lg mb-4">
              💸 {paymentModal.settlement.profiles?.nickname} 지급 처리
            </h3>

            <div className="space-y-4">
              {/* 지급 금액 */}
              <div>
                <label className="block text-sm text-gray-600 mb-1">지급 금액</label>
                <input
                  type="number"
                  value={paymentModal.paidAmount}
                  onChange={(e) => setPaymentModal({
                    ...paymentModal,
                    paidAmount: parseInt(e.target.value) || 0
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
                />
                <p className="text-xs text-gray-400 mt-1">
                  예상 수당: {formatMoney(paymentModal.settlement.total_amount)}
                </p>
              </div>

              {/* 메모 */}
              <div>
                <label className="block text-sm text-gray-600 mb-1">메모 (선택)</label>
                <input
                  type="text"
                  value={paymentModal.note}
                  onChange={(e) => setPaymentModal({
                    ...paymentModal,
                    note: e.target.value
                  })}
                  placeholder="지급 관련 메모"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
                />
              </div>

              {/* 증빙 사진 */}
              <div>
                <label className="block text-sm text-gray-600 mb-1">증빙 사진 (선택)</label>
                {/* 단일 input - 모든 기기 호환 */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleProofFileSelect}
                  className="hidden"
                />
                {proofFile ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">{proofFile.name}</span>
                    <button
                      onClick={() => setProofFile(null)}
                      className="text-red-500 text-sm"
                    >
                      삭제
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-green-400 hover:text-green-600"
                  >
                    📷 사진 선택
                  </button>
                )}
              </div>

              {/* 버튼 */}
              <div className="flex gap-2 pt-4">
                <button
                  onClick={() => {
                    setPaymentModal(null);
                    setProofFile(null);
                  }}
                  className="flex-1 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                >
                  취소
                </button>
                <button
                  onClick={handlePayment}
                  disabled={processingId !== null}
                  className="flex-1 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
                >
                  {processingId ? '처리 중...' : '지급 완료'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
