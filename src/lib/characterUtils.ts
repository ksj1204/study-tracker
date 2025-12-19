// ============================================================================
// 캐릭터 유틸리티 함수들
// ============================================================================

import type { CharacterStage, RainbowColor, MoodState } from '@/types/database';
import { CHARACTER_STAGES, RAINBOW_COLORS, MOOD_STATES } from '@/types/database';

const COLORS: RainbowColor[] = ['red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'violet'];
const STAGES: CharacterStage[] = ['egg', 'hatching', 'baby', 'adult', 'golden', 'legend'];

// ============================================================================
// 출석 처리
// ============================================================================

interface CharacterUpdateResult {
  stage: CharacterStage;
  color: RainbowColor;
  consecutiveAbsence: number;
}

/**
 * 출석 시 캐릭터 업데이트
 * - 색상 1단계 상승
 * - 보라(7일차)에서 출석하면 다음 캐릭터 단계로 승급 + 빨강 리셋
 */
export function onAttendance(
  currentStage: CharacterStage, 
  currentColor: RainbowColor
): CharacterUpdateResult {
  const colorIndex = COLORS.indexOf(currentColor);
  
  if (colorIndex === 6) {  // 보라색(마지막)에서 출석
    // 다음 캐릭터 단계로 승급 + 빨강으로 리셋
    const stageIndex = STAGES.indexOf(currentStage);
    const newStage = stageIndex < 5 ? STAGES[stageIndex + 1] : 'legend';
    return { stage: newStage, color: 'red', consecutiveAbsence: 0 };
  } else {
    // 색상만 1단계 상승
    return { stage: currentStage, color: COLORS[colorIndex + 1], consecutiveAbsence: 0 };
  }
}

// ============================================================================
// 결석 처리
// ============================================================================

/**
 * 결석 처리 (빨강 + 연속 2일 시 등급 강등)
 * - 색상 1단계 강등
 * - 빨강에서 결석하면 빨강 유지 + 연속결석 카운트 증가
 * - 빨강 + 연속결석 1일 이상이면 등급 강등!
 */
export function processAbsence(
  currentStage: CharacterStage, 
  currentColor: RainbowColor, 
  consecutiveAbsence: number
): CharacterUpdateResult {
  const stageIndex = STAGES.indexOf(currentStage);
  const colorIndex = COLORS.indexOf(currentColor);
  
  // 빨강 상태에서 이미 1일 이상 연속 결석 중인 경우 (= 이번이 2일째)
  if (colorIndex === 0 && consecutiveAbsence >= 1) {
    // 등급 강등!
    if (stageIndex === 0) {
      // 달걀은 더 이상 강등 불가 → 달걀+빨강 유지
      return { stage: 'egg', color: 'red', consecutiveAbsence: consecutiveAbsence + 1 };
    } else {
      // 이전 단계 + 보라색으로 강등
      return { stage: STAGES[stageIndex - 1], color: 'violet', consecutiveAbsence: 0 };
    }
  }
  
  // 빨강에서 첫 결석 (연속결석 0 → 1)
  if (colorIndex === 0) {
    return { 
      stage: currentStage, 
      color: 'red', 
      consecutiveAbsence: consecutiveAbsence + 1 
    };
  }
  
  // 일반 결석: 색상만 1단계 강등, 연속 결석 리셋
  return { 
    stage: currentStage, 
    color: COLORS[colorIndex - 1],
    consecutiveAbsence: 0
  };
}

// ============================================================================
// 감정 처리
// ============================================================================

/**
 * 출석 시 감정 증가
 */
export function increaseMood(currentMood: number, consecutiveDays: number): number {
  let bonus = 10;  // 기본 증가량
  
  if (consecutiveDays >= 7) bonus += 5;   // 주간 보너스
  if (consecutiveDays >= 14) bonus += 5;  // 2주 보너스
  if (consecutiveDays >= 30) bonus += 10; // 월간 보너스
  
  return Math.min(100, currentMood + bonus);
}

/**
 * 결석 시 감정 감소
 */
export function decreaseMood(currentMood: number, absentDays: number): number {
  let penalty = 15;  // 기본 감소량
  
  if (absentDays >= 2) penalty = 25;
  if (absentDays >= 3) penalty = 35;
  
  return Math.max(0, currentMood - penalty);
}

/**
 * 시험 통과 시 감정 보너스
 */
export function onTestPass(currentMood: number): number {
  return Math.min(100, currentMood + 20);
}

/**
 * 시험 실패 시 감정 감소
 */
export function onTestFail(currentMood: number): number {
  return Math.max(0, currentMood - 5);
}

// ============================================================================
// 헬퍼 함수들
// ============================================================================

/**
 * 감정 레벨로 표정 상태 가져오기
 */
export function getMoodState(moodLevel: number): MoodState {
  const mood = MOOD_STATES.find(m => moodLevel >= m.minLevel && moodLevel <= m.maxLevel);
  return mood?.state || 'neutral';
}

/**
 * 감정 레벨로 이모지 가져오기
 */
export function getMoodEmoji(moodLevel: number): string {
  const mood = MOOD_STATES.find(m => moodLevel >= m.minLevel && moodLevel <= m.maxLevel);
  return mood?.emoji || '😐';
}

/**
 * 캐릭터 단계로 이모지 가져오기
 */
export function getStageEmoji(stage: CharacterStage): string {
  const config = CHARACTER_STAGES.find(s => s.stage === stage);
  return config?.emoji || '🥚';
}

/**
 * 캐릭터 단계로 이름 가져오기
 */
export function getStageName(stage: CharacterStage): string {
  const config = CHARACTER_STAGES.find(s => s.stage === stage);
  return config?.name || '달걀';
}

/**
 * 색상 ID로 HEX 코드 가져오기
 */
export function getColorHex(color: RainbowColor): string {
  const config = RAINBOW_COLORS.find(c => c.id === color);
  return config?.hex || '#FF6B6B';
}

/**
 * 색상 ID로 이름 가져오기
 */
export function getColorName(color: RainbowColor): string {
  const config = RAINBOW_COLORS.find(c => c.id === color);
  return config?.name || '빨강';
}

/**
 * 현재 색상 진행도 (1~7)
 */
export function getColorProgress(color: RainbowColor): { current: number; total: number } {
  return {
    current: COLORS.indexOf(color) + 1,
    total: 7
  };
}

/**
 * 다음 단계까지 필요한 색상 수
 */
export function getColorsToNextStage(color: RainbowColor): number {
  return 7 - COLORS.indexOf(color);
}

/**
 * 전체 캐릭터 + 표정 이모지 조합
 */
export function getCharacterDisplay(stage: CharacterStage, moodLevel: number): string {
  const stageEmoji = getStageEmoji(stage);
  const moodEmoji = getMoodEmoji(moodLevel);
  return `${stageEmoji}${moodEmoji}`;
}
