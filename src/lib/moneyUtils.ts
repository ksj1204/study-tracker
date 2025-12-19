// ============================================================================
// 수당 계산 유틸리티
// ============================================================================

import type { StudySession, TestResult } from '@/types/database';

// 기본 수당 설정
export const REWARD_CONFIG = {
  DAILY_BASE: 500,      // 일일 기본 수당 (월~금)
  TEST_PASS: 1000,      // 시험 통과 수당
  TEST_FAIL: 500,       // 시험 미통과 수당 (참여 수당)
  EXTRA_UNIT: 200,      // 추가 수당 단위
};

// ============================================================================
// 기본 수당 계산
// ============================================================================

/**
 * 일일 기본 수당 (출석 시 500원)
 */
export function calculateDailyBase(isPresent: boolean): number {
  return isPresent ? REWARD_CONFIG.DAILY_BASE : 0;
}

/**
 * 시험 수당 계산
 */
export function calculateTestReward(isPass: boolean): number {
  return isPass ? REWARD_CONFIG.TEST_PASS : REWARD_CONFIG.TEST_FAIL;
}

/**
 * 시험 통과 여부 판정
 */
export function checkTestPass(currentScore: number, prevScore: number | null): boolean {
  if (prevScore === null) {
    return true;  // 첫 시험은 무조건 통과
  }
  return currentScore > prevScore;  // 점수 상승 시 통과
}

// ============================================================================
// 주간 정산
// ============================================================================

export interface WeeklySettlement {
  userId: string;
  nickname: string;
  attendanceDays: number;       // 출석 일수
  totalStudyDays: number;       // 총 공부일 (월~금 = 5)
  baseReward: number;           // 일반 수당 합계
  extraReward: number;          // 추가 수당 합계
  testReward: number;           // 시험 수당
  totalReward: number;          // 총 수당
  testPassed?: boolean;         // 시험 통과 여부
  testScore?: number;           // 시험 점수
}

/**
 * 주간 정산 계산
 */
export function calculateWeeklySettlement(
  sessions: StudySession[],
  testResult: TestResult | null,
  nickname: string
): WeeklySettlement {
  // 출석한 세션만 필터
  const presentSessions = sessions.filter(s => s.is_present);
  
  // 수당 계산
  const baseReward = presentSessions.reduce((sum, s) => sum + s.base_amount, 0);
  const extraReward = presentSessions.reduce((sum, s) => sum + s.extra_amount, 0);
  const testReward = testResult?.reward_amount || 0;
  
  return {
    userId: sessions[0]?.user_id || '',
    nickname,
    attendanceDays: presentSessions.length,
    totalStudyDays: 5,  // 월~금
    baseReward,
    extraReward,
    testReward,
    totalReward: baseReward + extraReward + testReward,
    testPassed: testResult?.is_pass,
    testScore: testResult?.score,
  };
}

// ============================================================================
// 월간 정산
// ============================================================================

export interface MonthlySettlement {
  totalStudyDays: number;       // 해당 월 총 공부일
  attendedDays: number;         // 출석 일수
  attendanceRate: number;       // 출석률 (%)
  totalTests: number;           // 총 시험 횟수
  passedTests: number;          // 통과한 시험 수
  testPassRate: number;         // 시험 통과율 (%)
  baseReward: number;           // 일반 수당 합계
  extraReward: number;          // 추가 수당 합계
  testReward: number;           // 시험 수당 합계
  totalReward: number;          // 총 수당
}

/**
 * 월간 정산 계산
 */
export function calculateMonthlySettlement(
  sessions: StudySession[],
  testResults: TestResult[],
  totalStudyDaysInMonth: number
): MonthlySettlement {
  // 출석 세션
  const presentSessions = sessions.filter(s => s.is_present);
  const attendedDays = presentSessions.length;
  
  // 수당 계산
  const baseReward = presentSessions.reduce((sum, s) => sum + s.base_amount, 0);
  const extraReward = presentSessions.reduce((sum, s) => sum + s.extra_amount, 0);
  const testReward = testResults.reduce((sum, t) => sum + t.reward_amount, 0);
  
  // 시험 통과
  const passedTests = testResults.filter(t => t.is_pass).length;
  
  return {
    totalStudyDays: totalStudyDaysInMonth,
    attendedDays,
    attendanceRate: totalStudyDaysInMonth > 0 
      ? Math.round((attendedDays / totalStudyDaysInMonth) * 100) 
      : 0,
    totalTests: testResults.length,
    passedTests,
    testPassRate: testResults.length > 0 
      ? Math.round((passedTests / testResults.length) * 100) 
      : 0,
    baseReward,
    extraReward,
    testReward,
    totalReward: baseReward + extraReward + testReward,
  };
}

// ============================================================================
// 포맷 헬퍼
// ============================================================================

/**
 * 금액을 한국 원화 형식으로 포맷
 */
export function formatMoney(amount: number): string {
  return amount.toLocaleString('ko-KR') + '원';
}

/**
 * 퍼센트 포맷
 */
export function formatPercent(value: number): string {
  return value + '%';
}
