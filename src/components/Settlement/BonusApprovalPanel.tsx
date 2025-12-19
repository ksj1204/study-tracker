// ============================================================================
// 관리자용 보너스(추가수당) 승인 패널
// ============================================================================

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettlementStore } from '@/stores/settlementStore';
import { useAuthStore } from '@/stores/authStore';
import type { BonusRequest } from '@/types/database';

export function BonusApprovalPanel() {
  const [pendingRequests, setPendingRequests] = useState<BonusRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectModalOpen, setRejectModalOpen] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { fetchPendingBonusRequests, approveBonus, rejectBonus } = useSettlementStore();
  const { user } = useAuthStore();

  useEffect(() => {
    loadPendingRequests();
  }, []);

  const loadPendingRequests = async () => {
    setIsLoading(true);
    try {
      const requests = await fetchPendingBonusRequests();
      setPendingRequests(requests);
    } catch (error) {
      console.error('대기 중 요청 로드 실패:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (requestId: string) => {
    if (!user?.id) return;
    
    setProcessingId(requestId);
    try {
      await approveBonus(requestId, user.id);
      setPendingRequests(prev => prev.filter(r => r.id !== requestId));
    } catch (error) {
      console.error('승인 실패:', error);
      alert('승인 처리 중 오류가 발생했습니다.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async () => {
    if (!user?.id || !rejectModalOpen) return;
    if (!rejectReason.trim()) {
      alert('거절 사유를 입력해주세요.');
      return;
    }

    setProcessingId(rejectModalOpen);
    try {
      await rejectBonus(rejectModalOpen, user.id, rejectReason.trim());
      setPendingRequests(prev => prev.filter(r => r.id !== rejectModalOpen));
      setRejectModalOpen(null);
      setRejectReason('');
    } catch (error) {
      console.error('거절 실패:', error);
      alert('거절 처리 중 오류가 발생했습니다.');
    } finally {
      setProcessingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-purple-200">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">🎁</span>
          <h3 className="text-lg font-bold text-gray-800">추가수당 신청 관리</h3>
        </div>
        <div className="flex justify-center py-8">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1 }}
            className="text-2xl"
          >
            ⏳
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-purple-200">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎁</span>
          <h3 className="text-lg font-bold text-gray-800">추가수당 신청 관리</h3>
        </div>
        <button
          onClick={loadPendingRequests}
          className="text-sm bg-gray-100 text-gray-600 px-3 py-1 rounded-full hover:bg-gray-200 transition-colors"
        >
          🔄 새로고침
        </button>
      </div>

      {/* 신청 목록 */}
      {pendingRequests.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p className="text-4xl mb-2">📭</p>
          <p>대기 중인 신청이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingRequests.map((request) => (
            <motion.div
              key={request.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-purple-50 rounded-lg p-4 border border-purple-200"
            >
              {/* 학생 정보 */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">👤</span>
                  <span className="font-bold text-gray-800">
                    {(request as any).profiles?.nickname || '학생'}
                  </span>
                </div>
                <span className="text-xs text-gray-500">
                  {formatDate(request.created_at)}
                </span>
              </div>

              {/* 신청 사유 */}
              <div className="bg-white rounded-lg p-3 mb-3">
                <p className="text-sm text-gray-700">{request.reason}</p>
              </div>

              {/* 액션 버튼 */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleApprove(request.id)}
                  disabled={processingId === request.id}
                  className={`flex-1 py-2 rounded-lg font-bold transition-all ${
                    processingId === request.id
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-green-500 text-white hover:bg-green-600'
                  }`}
                >
                  {processingId === request.id ? '처리 중...' : '✅ 승인'}
                </button>
                <button
                  onClick={() => setRejectModalOpen(request.id)}
                  disabled={processingId === request.id}
                  className={`flex-1 py-2 rounded-lg font-bold transition-all ${
                    processingId === request.id
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-red-100 text-red-600 hover:bg-red-200'
                  }`}
                >
                  ❌ 거절
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* 거절 모달 */}
      <AnimatePresence>
        {rejectModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setRejectModalOpen(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-xl p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h4 className="text-lg font-bold text-gray-800 mb-4">
                ❌ 거절 사유 입력
              </h4>
              
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="거절 사유를 입력해주세요..."
                className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-red-300 focus:outline-none resize-none"
                rows={3}
              />

              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => {
                    setRejectModalOpen(null);
                    setRejectReason('');
                  }}
                  className="flex-1 py-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleReject}
                  disabled={processingId !== null}
                  className="flex-1 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  거절하기
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
