// ============================================================================
// 날짜 유틸리티 함수들
// ============================================================================

import { 
  format, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth,
  endOfMonth,
  eachDayOfInterval, 
  isWeekend, 
  isSaturday,
  isSunday,
  parseISO,
  differenceInDays,
  addDays,
  isToday,
  isBefore,
  isAfter
} from 'date-fns';
import { ko } from 'date-fns/locale';

// ============================================================================
// 한국 시간대 유틸리티
// ============================================================================

/**
 * 한국 시간 기준 현재 날짜 가져오기
 */
export function getKoreanNow(): Date {
  // 한국은 UTC+9
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + (9 * 60 * 60 * 1000));
}

/**
 * 한국 시간 기준 오늘 날짜 문자열 (YYYY-MM-DD)
 */
export function getKoreanTodayString(): string {
  const kst = getKoreanNow();
  const year = kst.getFullYear();
  const month = String(kst.getMonth() + 1).padStart(2, '0');
  const day = String(kst.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ============================================================================
// 날짜 포맷
// ============================================================================

/**
 * 날짜를 YYYY-MM-DD 형식으로 변환 (로컬 시간대 기준)
 */
export function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 한국어 날짜 표시 (예: 2025년 12월 11일 (목))
 */
export function formatKoreanDate(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'yyyy년 M월 d일 (E)', { locale: ko });
}

/**
 * 짧은 날짜 표시 (예: 12/11)
 */
export function formatShortDate(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'M/d');
}

/**
 * 요일만 표시 (예: 월)
 */
export function formatDayOfWeek(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'E', { locale: ko });
}

// ============================================================================
// 주간/월간 기간
// ============================================================================

/**
 * 이번 주 시작일 (월요일)
 */
export function getWeekStart(date: Date = new Date()): Date {
  return startOfWeek(date, { weekStartsOn: 1 });
}

/**
 * 이번 주 종료일 (일요일)
 */
export function getWeekEnd(date: Date = new Date()): Date {
  return endOfWeek(date, { weekStartsOn: 1 });
}

/**
 * 이번 달 시작일
 */
export function getMonthStart(date: Date = new Date()): Date {
  return startOfMonth(date);
}

/**
 * 이번 달 종료일
 */
export function getMonthEnd(date: Date = new Date()): Date {
  return endOfMonth(date);
}

// ============================================================================
// 공부일/시험일 판단
// ============================================================================

/**
 * 공부일인지 확인 (월~금)
 */
export function isStudyDay(date: Date | string): boolean {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return !isWeekend(d);
}

/**
 * 시험일인지 확인 (토요일)
 */
export function isTestDay(date: Date | string): boolean {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return isSaturday(d);
}

/**
 * 휴무일인지 확인 (일요일)
 */
export function isRestDay(date: Date | string): boolean {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return isSunday(d);
}

/**
 * 오늘이 공부 가능한 날인지 (월~토)
 */
export function canStudyToday(): boolean {
  const today = new Date();
  return !isSunday(today);
}

// ============================================================================
// 기간 내 날짜 목록
// ============================================================================

/**
 * 이번 주 공부일 목록 (월~금)
 */
export function getWeekStudyDays(date: Date = new Date()): Date[] {
  const start = getWeekStart(date);
  const end = getWeekEnd(date);
  
  return eachDayOfInterval({ start, end }).filter(d => isStudyDay(d));
}

/**
 * 이번 주 모든 날짜 목록
 */
export function getWeekDays(date: Date = new Date()): Date[] {
  const start = getWeekStart(date);
  const end = getWeekEnd(date);
  
  return eachDayOfInterval({ start, end });
}

/**
 * 이번 달 공부일 수 (평일 수)
 */
export function getMonthStudyDaysCount(date: Date = new Date()): number {
  const start = getMonthStart(date);
  const end = getMonthEnd(date);
  
  return eachDayOfInterval({ start, end }).filter(d => isStudyDay(d)).length;
}

/**
 * 이번 달 시험일 수 (토요일 수)
 */
export function getMonthTestDaysCount(date: Date = new Date()): number {
  const start = getMonthStart(date);
  const end = getMonthEnd(date);
  
  return eachDayOfInterval({ start, end }).filter(d => isTestDay(d)).length;
}

// ============================================================================
// 결석 처리용
// ============================================================================

/**
 * 두 날짜 사이의 놓친 공부일 목록 (월~금만)
 * 결석 처리 시 사용
 */
export function getMissedStudyDays(lastActiveDate: Date | string, today: Date = new Date()): Date[] {
  const lastActive = typeof lastActiveDate === 'string' ? parseISO(lastActiveDate) : lastActiveDate;
  
  // 마지막 활동일 다음 날부터 어제까지
  const startDate = addDays(lastActive, 1);
  const endDate = addDays(today, -1);
  
  // 기간이 유효하지 않으면 빈 배열
  if (isBefore(endDate, startDate)) {
    return [];
  }
  
  // 해당 기간의 평일(월~금)만 반환
  return eachDayOfInterval({ start: startDate, end: endDate })
    .filter(d => isStudyDay(d));
}

/**
 * 결석 일수 계산
 */
export function countMissedDays(lastActiveDate: Date | string): number {
  return getMissedStudyDays(lastActiveDate).length;
}

// ============================================================================
// 기타 헬퍼
// ============================================================================

/**
 * 오늘 날짜 문자열 (한국 시간 기준)
 */
export function getTodayString(): string {
  return getKoreanTodayString();
}

/**
 * 날짜가 오늘인지 확인
 */
export function checkIsToday(date: Date | string): boolean {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return isToday(d);
}

/**
 * 날짜가 오늘 이전인지 확인
 */
export function isPastDate(date: Date | string): boolean {
  const d = typeof date === 'string' ? parseISO(date) : date;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return isBefore(d, today);
}

/**
 * 날짜가 오늘 이후인지 확인
 */
export function isFutureDate(date: Date | string): boolean {
  const d = typeof date === 'string' ? parseISO(date) : date;
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return isAfter(d, today);
}

/**
 * 두 날짜 사이의 일수 차이
 */
export function getDaysDifference(date1: Date | string, date2: Date | string): number {
  const d1 = typeof date1 === 'string' ? parseISO(date1) : date1;
  const d2 = typeof date2 === 'string' ? parseISO(date2) : date2;
  return Math.abs(differenceInDays(d1, d2));
}

/**
 * 주간 기간 문자열 (예: "12/9 ~ 12/15")
 */
export function getWeekRangeString(date: Date = new Date()): string {
  const start = getWeekStart(date);
  const end = getWeekEnd(date);
  return `${formatShortDate(start)} ~ ${formatShortDate(end)}`;
}

/**
 * 월간 기간 문자열 (예: "2025년 12월")
 */
export function getMonthString(date: Date = new Date()): string {
  return format(date, 'yyyy년 M월', { locale: ko });
}
