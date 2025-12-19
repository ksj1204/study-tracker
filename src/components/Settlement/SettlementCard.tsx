// ============================================================================
// 정산 카드 (학생용) - 수당 현황 표시
// ============================================================================

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSettlementStore } from '@/stores/settlementStore';
import { formatMoney } from '@/lib/moneyUtils';

interface SettlementCardProps {
  userId: string;
}

export default function SettlementCard({ userId }: SettlementCardProps) {
  const { summary, fetchSettlementSummary, isLoading } = useSettlementStore();

  useEffect(() => {
    if (userId) {
      fetchSettlementSummary(userId);
    }
  }, [userId]);

  // 기본값 설정 (데이터가 없을 때)
  const displaySummary = summary || {
    currentWeekExpected: 0,
    currentWeekPaid: 0,
    monthlyPaid: 0,
    totalPaid: 0,
    unpaidAmount: 0
  };

  if (isLoading) {
    return (
      <div className="card animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card"
    >
      <h2 className="text-lg font-bold text-gray-800 mb-4">
        💰 수당 현황
      </h2>

      <div className="space-y-3">
        {/* 이번 주 예상 수당 */}
        <div className="flex justify-between items-center py-2 border-b border-gray-100">
          <div>
            <span className="text-gray-600">이번 주 예상 수당</span>
            <p className="text-xs text-gray-400">출석 + 시험 + 추가수당</p>
          </div>
          <span className="text-xl font-bold text-chick-600">
            {formatMoney(displaySummary.currentWeekExpected)}
          </span>
        </div>

        {/* 이번 달 지급액 */}
        <div className="flex justify-between items-center py-2 border-b border-gray-100">
          <span className="text-gray-600">이번 달 지급액</span>
          <span className="font-bold text-green-600">
            {formatMoney(displaySummary.monthlyPaid)}
          </span>
        </div>

        {/* 총 누적 수당 */}
        <div className="flex justify-between items-center py-2 border-b border-gray-100">
          <span className="text-gray-600">총 누적 수당</span>
          <span className="font-bold text-blue-600">
            {formatMoney(displaySummary.totalPaid)}
          </span>
        </div>

        {/* 미지급 금액 */}
        {displaySummary.unpaidAmount > 0 && (
          <div className="flex justify-between items-center py-2 bg-red-50 -mx-4 px-4 rounded-lg">
            <div>
              <span className="text-red-600 font-medium">⚠️ 미지급 금액</span>
              <p className="text-xs text-red-400">정산 대기 중</p>
            </div>
            <span className="text-xl font-bold text-red-600">
              {formatMoney(displaySummary.unpaidAmount)}
            </span>
          </div>
        )}

        {/* 지급 완료 메시지 */}
        {displaySummary.unpaidAmount === 0 && displaySummary.totalPaid > 0 && (
          <div className="text-center py-2 bg-green-50 -mx-4 px-4 rounded-lg">
            <span className="text-green-600">✅ 모든 수당이 지급되었습니다!</span>
          </div>
        )}
      </div>

      {/* 정산 안내 */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <p className="text-xs text-gray-400 text-center">
          📅 정산은 매주 일요일에 진행됩니다
        </p>
      </div>
    </motion.div>
  );
}
