// ============================================================================
// 추가수당 신청 폼 컴포넌트
// ============================================================================

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettlementStore } from '@/stores/settlementStore';

interface BonusRequestFormProps {
  userId: string;
  onSubmitSuccess?: () => void;
}

export function BonusRequestForm({ userId, onSubmitSuccess }: BonusRequestFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const { requestBonus } = useSettlementStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!reason.trim()) {
      setError('신청 사유를 입력해주세요.');
      return;
    }

    if (reason.trim().length < 10) {
      setError('신청 사유를 10자 이상 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await requestBonus(userId, reason.trim());
      setSuccess(true);
      setReason('');
      
      setTimeout(() => {
        setSuccess(false);
        setIsOpen(false);
        onSubmitSuccess?.();
      }, 2000);
    } catch (err) {
      console.error('추가수당 신청 실패:', err);
      setError('신청 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const reasonExamples = [
    '어려운 시험에서 좋은 성적을 받았어요',
    '특별히 열심히 공부했어요',
    '연속 출석 달성했어요',
    '목표를 초과 달성했어요'
  ];

  return (
    <div className="bg-white rounded-xl shadow-lg p-4 border-2 border-yellow-200">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎁</span>
          <h3 className="font-bold text-gray-800">추가수당 신청</h3>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="text-sm bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full hover:bg-yellow-200 transition-colors"
        >
          {isOpen ? '접기' : '신청하기'}
        </button>
      </div>

      <p className="text-sm text-gray-500 mb-3">
        열심히 공부했다면 추가 수당을 신청해보세요! 선생님이 검토 후 지급해드려요.
      </p>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 사유 입력 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  신청 사유
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="왜 추가수당을 받아야 하는지 적어주세요..."
                  className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-yellow-400 focus:outline-none resize-none transition-colors"
                  rows={3}
                  maxLength={200}
                  disabled={isSubmitting}
                />
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-gray-400">최소 10자 이상</span>
                  <span className="text-xs text-gray-400">{reason.length}/200</span>
                </div>
              </div>

              {/* 예시 */}
              <div>
                <p className="text-xs text-gray-500 mb-2">💡 예시:</p>
                <div className="flex flex-wrap gap-2">
                  {reasonExamples.map((example, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setReason(example)}
                      className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full hover:bg-gray-200 transition-colors"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>

              {/* 에러 메시지 */}
              {error && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm text-red-500 bg-red-50 p-2 rounded-lg"
                >
                  ❌ {error}
                </motion.p>
              )}

              {/* 성공 메시지 */}
              {success && (
                <motion.p
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-sm text-green-600 bg-green-50 p-3 rounded-lg text-center"
                >
                  ✅ 신청이 완료되었습니다! 선생님이 검토 후 알려드릴게요.
                </motion.p>
              )}

              {/* 제출 버튼 */}
              <button
                type="submit"
                disabled={isSubmitting || success}
                className={`w-full py-3 rounded-lg font-bold transition-all ${
                  isSubmitting || success
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-yellow-400 text-yellow-900 hover:bg-yellow-500 shadow-md hover:shadow-lg'
                }`}
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1 }}
                    >
                      ⏳
                    </motion.span>
                    신청 중...
                  </span>
                ) : success ? (
                  '✅ 신청 완료!'
                ) : (
                  '신청하기'
                )}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
