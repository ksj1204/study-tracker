// ============================================================================
// 캐릭터 성장 가이드 컴포넌트
// ============================================================================

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CHARACTER_STAGES, RAINBOW_COLORS, MOOD_STATES } from '@/types/database';
import type { CharacterStage, RainbowColor } from '@/types/database';
import { getColorsToNextStage, getStageName, getStageEmoji, getColorHex, getColorName } from '@/lib/characterUtils';

interface GrowthGuideProps {
  currentStage: CharacterStage;
  currentColor: RainbowColor;
  moodLevel: number;
  consecutiveAbsence: number;
}

export function GrowthGuide({ 
  currentStage, 
  currentColor, 
  moodLevel, 
  consecutiveAbsence 
}: GrowthGuideProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'stages' | 'colors' | 'mood' | 'tips'>('stages');

  const colorsToNext = getColorsToNextStage(currentColor);
  const currentStageIndex = CHARACTER_STAGES.findIndex(s => s.stage === currentStage);
  const currentColorIndex = RAINBOW_COLORS.findIndex(c => c.id === currentColor);

  return (
    <div className="bg-white rounded-xl shadow-lg border-2 border-green-200 overflow-hidden">
      {/* 헤더 */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="p-4 cursor-pointer hover:bg-green-50 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📖</span>
            <h3 className="font-bold text-gray-800">성장 가이드</h3>
          </div>
          <motion.span
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="text-gray-500"
          >
            ▼
          </motion.span>
        </div>

        {/* 현재 상태 요약 */}
        <div className="mt-2 flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            <span>{getStageEmoji(currentStage)}</span>
            <span className="text-gray-600">{getStageName(currentStage)}</span>
          </div>
          <div className="flex items-center gap-1">
            <span 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: getColorHex(currentColor) }}
            />
            <span className="text-gray-600">{getColorName(currentColor)}</span>
          </div>
          <div className="text-gray-400">
            다음 단계까지 {colorsToNext}일
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            {/* 탭 메뉴 */}
            <div className="flex border-t border-b border-gray-200">
              {[
                { id: 'stages', label: '단계', emoji: '🐣' },
                { id: 'colors', label: '무지개', emoji: '🌈' },
                { id: 'mood', label: '감정', emoji: '😊' },
                { id: 'tips', label: '팁', emoji: '💡' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-green-100 text-green-700'
                      : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <span className="mr-1">{tab.emoji}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* 탭 내용 */}
            <div className="p-4">
              {activeTab === 'stages' && (
                <StagesTab 
                  currentStageIndex={currentStageIndex}
                  colorsToNext={colorsToNext}
                />
              )}
              {activeTab === 'colors' && (
                <ColorsTab 
                  currentColorIndex={currentColorIndex}
                  currentStage={currentStage}
                />
              )}
              {activeTab === 'mood' && (
                <MoodTab moodLevel={moodLevel} />
              )}
              {activeTab === 'tips' && (
                <TipsTab 
                  currentStage={currentStage}
                  consecutiveAbsence={consecutiveAbsence}
                  moodLevel={moodLevel}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// 단계 탭
// ============================================================================

function StagesTab({ currentStageIndex, colorsToNext }: { 
  currentStageIndex: number; 
  colorsToNext: number 
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600 mb-4">
        7일 연속 출석하면 다음 단계로 성장해요! 🎉
      </p>

      {CHARACTER_STAGES.map((stage, idx) => (
        <motion.div
          key={stage.stage}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: idx * 0.1 }}
          className={`flex items-center gap-3 p-3 rounded-lg ${
            idx === currentStageIndex 
              ? 'bg-green-100 border-2 border-green-400' 
              : idx < currentStageIndex 
                ? 'bg-gray-100' 
                : 'bg-gray-50 opacity-60'
          }`}
        >
          <span className="text-2xl">{stage.emoji}</span>
          <div className="flex-1">
            <p className="font-bold text-gray-800">{stage.name}</p>
            <p className="text-xs text-gray-500">
              {stage.minDays === 57 
                ? '최종 단계!'
                : `${stage.minDays}~${stage.maxDays}일차`}
            </p>
          </div>
          {idx === currentStageIndex && (
            <span className="text-sm bg-green-500 text-white px-2 py-1 rounded-full">
              현재
            </span>
          )}
          {idx === currentStageIndex + 1 && (
            <span className="text-xs text-green-600">
              {colorsToNext}일 후!
            </span>
          )}
        </motion.div>
      ))}
    </div>
  );
}

// ============================================================================
// 무지개 색상 탭
// ============================================================================

function ColorsTab({ currentColorIndex, currentStage }: { 
  currentColorIndex: number; 
  currentStage: CharacterStage;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        매일 출석하면 색상이 빨강 → 보라로 변해요. 보라색에서 출석하면 다음 단계로! 🌈
      </p>

      {/* 무지개 색상 진행 바 */}
      <div className="relative">
        <div className="flex gap-1 h-8 rounded-full overflow-hidden">
          {RAINBOW_COLORS.map((color, idx) => (
            <motion.div
              key={color.id}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: idx * 0.1 }}
              className="flex-1 relative"
              style={{ backgroundColor: color.hex }}
            >
              {idx === currentColorIndex && (
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <span className="text-white text-xs font-bold drop-shadow-md">
                    현재
                  </span>
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* 색상 설명 */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {RAINBOW_COLORS.map((color, idx) => (
          <div 
            key={color.id}
            className={`text-xs ${
              idx === currentColorIndex ? 'font-bold' : 'text-gray-400'
            }`}
          >
            <div 
              className="w-4 h-4 rounded-full mx-auto mb-1"
              style={{ backgroundColor: color.hex }}
            />
            {color.day}일
          </div>
        ))}
      </div>

      <div className="bg-yellow-50 rounded-lg p-3 text-sm">
        <p className="text-yellow-800">
          💡 <strong>주의!</strong> 결석하면 색상이 한 칸 후퇴해요. 
          빨강에서 2일 연속 결석하면 캐릭터 단계가 강등됩니다!
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// 감정 탭
// ============================================================================

function MoodTab({ moodLevel }: { moodLevel: number }) {
  const currentMood = MOOD_STATES.find(
    m => moodLevel >= m.minLevel && moodLevel <= m.maxLevel
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        캐릭터의 감정은 출석과 시험 결과에 따라 변해요! 😊
      </p>

      {/* 현재 감정 레벨 바 */}
      <div className="relative">
        <div className="h-6 bg-gray-200 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${moodLevel}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className={`h-full rounded-full ${
              moodLevel >= 70 ? 'bg-green-400' :
              moodLevel >= 50 ? 'bg-yellow-400' :
              moodLevel >= 30 ? 'bg-orange-400' : 'bg-red-400'
            }`}
          />
        </div>
        <div className="absolute inset-0 flex items-center justify-center text-xs font-bold">
          {moodLevel}%
        </div>
      </div>

      {/* 감정 단계들 */}
      <div className="space-y-2">
        {MOOD_STATES.map((mood) => (
          <div
            key={mood.state}
            className={`flex items-center gap-3 p-2 rounded-lg ${
              currentMood?.state === mood.state
                ? 'bg-blue-100 border-2 border-blue-400'
                : 'bg-gray-50'
            }`}
          >
            <span className="text-xl">{mood.emoji}</span>
            <div className="flex-1">
              <p className="text-sm font-medium">{mood.description}</p>
              <p className="text-xs text-gray-400">
                {mood.minLevel}% ~ {mood.maxLevel}%
              </p>
            </div>
            {currentMood?.state === mood.state && (
              <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">
                현재
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="bg-blue-50 rounded-lg p-3 text-sm space-y-1">
        <p className="text-blue-800"><strong>📈 감정 올리기:</strong></p>
        <ul className="text-blue-700 text-xs list-disc list-inside">
          <li>매일 출석 (+10~25)</li>
          <li>시험 통과 (+20)</li>
          <li>연속 출석 보너스 (+5~10)</li>
        </ul>
        <p className="text-blue-800 mt-2"><strong>📉 감정 내리기:</strong></p>
        <ul className="text-blue-700 text-xs list-disc list-inside">
          <li>결석 (-15~35)</li>
          <li>시험 불합격 (-5)</li>
        </ul>
      </div>
    </div>
  );
}

// ============================================================================
// 팁 탭
// ============================================================================

function TipsTab({ currentStage, consecutiveAbsence, moodLevel }: { 
  currentStage: CharacterStage;
  consecutiveAbsence: number;
  moodLevel: number;
}) {
  const tips = [];

  // 연속 결석 경고
  if (consecutiveAbsence >= 1) {
    tips.push({
      emoji: '⚠️',
      title: '주의! 연속 결석 중',
      content: `현재 ${consecutiveAbsence}일 연속 결석입니다. 한 번 더 결석하면 캐릭터가 강등될 수 있어요!`,
      type: 'warning'
    });
  }

  // 감정 낮음 경고
  if (moodLevel < 30) {
    tips.push({
      emoji: '😢',
      title: '캐릭터가 슬퍼하고 있어요',
      content: '매일 출석하고 시험을 통과하면 기분이 좋아져요!',
      type: 'warning'
    });
  }

  // 일반 팁들
  tips.push({
    emoji: '📅',
    title: '매일 꾸준히 출석하세요',
    content: '7일 연속 출석하면 다음 캐릭터 단계로 성장해요!',
    type: 'info'
  });

  tips.push({
    emoji: '📝',
    title: '시험을 통과하면 보너스!',
    content: '시험을 통과하면 감정 +20, 추가 수당 500원을 받아요.',
    type: 'info'
  });

  tips.push({
    emoji: '🌈',
    title: '무지개 색상 변화',
    content: '빨강 → 주황 → 노랑 → 초록 → 파랑 → 남색 → 보라 순으로 매일 변해요.',
    type: 'info'
  });

  tips.push({
    emoji: '💸',
    title: '수당 받는 법',
    content: '출석 500원 + 시험 통과 500원! 일요일마다 정산해요.',
    type: 'info'
  });

  // 현재 단계별 특별 팁
  if (currentStage === 'egg') {
    tips.push({
      emoji: '🥚',
      title: '달걀에서 부화시키세요!',
      content: '7일 연속 출석하면 부화가 시작됩니다!',
      type: 'success'
    });
  } else if (currentStage === 'legend') {
    tips.push({
      emoji: '👑',
      title: '축하합니다! 전설이 되셨어요!',
      content: '최고 단계에 도달했어요! 계속 출석해서 전설을 유지하세요!',
      type: 'success'
    });
  }

  return (
    <div className="space-y-3">
      {tips.map((tip, idx) => (
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.1 }}
          className={`p-3 rounded-lg ${
            tip.type === 'warning' ? 'bg-red-50 border border-red-200' :
            tip.type === 'success' ? 'bg-green-50 border border-green-200' :
            'bg-gray-50 border border-gray-200'
          }`}
        >
          <p className="font-bold text-sm flex items-center gap-2">
            <span>{tip.emoji}</span>
            <span>{tip.title}</span>
          </p>
          <p className="text-xs text-gray-600 mt-1 ml-6">{tip.content}</p>
        </motion.div>
      ))}
    </div>
  );
}
