// ============================================================================
// 정산 상태 관리 (Zustand)
// ============================================================================
/* eslint-disable @typescript-eslint/no-explicit-any */

import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { getWeekStart, getWeekEnd, toDateString, getMonthStart, getMonthEnd } from '@/lib/dateUtils';
import type { Settlement, BonusRequest, SettlementSummary, StudySession, TestResult } from '@/types/database';

interface SettlementStore {
  // 상태
  settlements: Settlement[];
  currentWeekSettlement: Settlement | null;
  bonusRequests: BonusRequest[];
  summary: SettlementSummary | null;
  isLoading: boolean;
  error: string | null;

  // 학생 액션
  fetchMySettlements: (userId: string) => Promise<void>;
  fetchSettlementSummary: (userId: string) => Promise<void>;
  fetchMyBonusRequests: (userId: string) => Promise<void>;
  requestBonus: (userId: string, reason: string) => Promise<void>;

  // 관리자 액션
  fetchAllSettlements: (weekStart?: Date) => Promise<Settlement[]>;
  createSettlement: (userId: string, weekStart: Date) => Promise<void>;
  processPayment: (settlementId: string, paidAmount: number, proofUrl?: string, note?: string) => Promise<void>;
  cancelPayment: (settlementId: string) => Promise<void>;
  deleteSettlement: (settlementId: string) => Promise<void>;
  recalculateSettlement: (settlementId: string) => Promise<void>;
  approveBonus: (requestId: string, adminId: string) => Promise<void>;
  rejectBonus: (requestId: string, adminId: string, reason: string) => Promise<void>;
  fetchPendingBonusRequests: () => Promise<BonusRequest[]>;
  
  // 정산 계산
  calculateWeeklySettlement: (userId: string, weekStart: Date) => Promise<{
    attendance: number;
    test: number;
    bonus: number;
    total: number;
  }>;
}

export const useSettlementStore = create<SettlementStore>((set, get) => ({
  settlements: [],
  currentWeekSettlement: null,
  bonusRequests: [],
  summary: null,
  isLoading: false,
  error: null,

  // 내 정산 기록 가져오기
  fetchMySettlements: async (userId: string) => {
    try {
      set({ isLoading: true, error: null });

      const { data, error } = await supabase
        .from('settlements')
        .select('*')
        .eq('user_id', userId)
        .order('week_start', { ascending: false });

      if (error) throw error;

      const settlements = (data || []) as Settlement[];

      // 이번 주 정산 찾기
      const today = new Date();
      const weekStartStr = toDateString(getWeekStart(today));
      const currentWeek = settlements.find(s => s.week_start === weekStartStr) || null;

      set({ 
        settlements, 
        currentWeekSettlement: currentWeek,
        isLoading: false 
      });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : '정산 기록 로드 실패',
        isLoading: false 
      });
    }
  },

  // 정산 요약 계산 (학생용)
  fetchSettlementSummary: async (userId: string) => {
    try {
      const today = new Date();
      const weekStart = getWeekStart(today);
      const weekEnd = getWeekEnd(today);
      const monthStart = getMonthStart(today);
      const monthEnd = getMonthEnd(today);

      // 이번 주 출석 수당 계산
      const { data: weekSessionsData, error: sessionsError } = await supabase
        .from('study_sessions')
        .select('base_amount, extra_amount, is_present')
        .eq('user_id', userId)
        .gte('study_date', toDateString(weekStart))
        .lte('study_date', toDateString(weekEnd));

      if (sessionsError) {
        console.error('세션 로드 실패:', sessionsError);
      }

      const weekSessions = (weekSessionsData || []) as Pick<StudySession, 'base_amount' | 'extra_amount' | 'is_present'>[];
      const weeklyAttendance = weekSessions
        .filter(s => s.is_present)
        .reduce((sum, s) => sum + s.base_amount + s.extra_amount, 0);

      // 이번 주 시험 수당
      const { data: weekTestsData } = await supabase
        .from('test_results')
        .select('reward_amount')
        .eq('user_id', userId)
        .gte('test_date', toDateString(weekStart))
        .lte('test_date', toDateString(weekEnd));

      const weekTests = (weekTestsData || []) as Pick<TestResult, 'reward_amount'>[];
      const weeklyTest = weekTests.reduce((sum, t) => sum + t.reward_amount, 0);

      // 이번 주 승인된 추가수당
      const { data: weekBonusData } = await supabase
        .from('bonus_requests')
        .select('amount')
        .eq('user_id', userId)
        .eq('status', 'approved')
        .gte('request_date', toDateString(weekStart))
        .lte('request_date', toDateString(weekEnd));

      const weekBonus = (weekBonusData || []) as Pick<BonusRequest, 'amount'>[];
      const weeklyBonus = weekBonus.reduce((sum, b) => sum + b.amount, 0);

      const currentWeekExpected = weeklyAttendance + weeklyTest + weeklyBonus;

      // settlements 테이블 관련 쿼리 (테이블이 없으면 기본값 사용)
      let currentWeekPaid = 0;
      let monthlyPaid = 0;
      let totalPaid = 0;
      let unpaidAmount = 0;

      try {
        // 이번 주 지급액 - maybeSingle()로 결과 없을 때 406 방지
        const { data: currentSettlementData } = await supabase
          .from('settlements')
          .select('paid_amount, is_paid')
          .eq('user_id', userId)
          .eq('week_start', toDateString(weekStart))
          .maybeSingle();

        const currentSettlement = currentSettlementData as Pick<Settlement, 'paid_amount' | 'is_paid'> | null;
        currentWeekPaid = currentSettlement?.is_paid ? currentSettlement.paid_amount : 0;

        // 이번 달 지급 총액
        const { data: monthSettlementsData } = await supabase
          .from('settlements')
          .select('paid_amount')
          .eq('user_id', userId)
          .eq('is_paid', true)
          .gte('week_start', toDateString(monthStart))
          .lte('week_end', toDateString(monthEnd));

        const monthSettlements = (monthSettlementsData || []) as Pick<Settlement, 'paid_amount'>[];
        monthlyPaid = monthSettlements.reduce((sum, s) => sum + s.paid_amount, 0);

        // 총 지급 받은 금액
        const { data: allSettlementsData } = await supabase
          .from('settlements')
          .select('paid_amount')
          .eq('user_id', userId)
          .eq('is_paid', true);

        const allSettlements = (allSettlementsData || []) as Pick<Settlement, 'paid_amount'>[];
        totalPaid = allSettlements.reduce((sum, s) => sum + s.paid_amount, 0);

        // 미지급 금액 (지급되지 않은 정산들의 total_amount 합계)
        const { data: unpaidSettlementsData } = await supabase
          .from('settlements')
          .select('total_amount')
          .eq('user_id', userId)
          .eq('is_paid', false);

        const unpaidSettlements = (unpaidSettlementsData || []) as Pick<Settlement, 'total_amount'>[];
        unpaidAmount = unpaidSettlements.reduce((sum, s) => sum + s.total_amount, 0);
      } catch (settlementError) {
        // settlements 테이블이 없으면 기본값 사용
        console.log('settlements 테이블이 아직 없습니다. 기본값 사용.');
      }

      set({
        summary: {
          currentWeekExpected,
          currentWeekPaid,
          monthlyPaid,
          totalPaid,
          unpaidAmount
        }
      });
    } catch (error) {
      console.error('정산 요약 계산 실패:', error);
    }
  },

  // 내 추가수당 신청 목록
  fetchMyBonusRequests: async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('bonus_requests')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      set({ bonusRequests: (data || []) as BonusRequest[] });
    } catch (error) {
      console.error('추가수당 신청 목록 로드 실패:', error);
    }
  },

  // 추가수당 신청
  requestBonus: async (userId: string, reason: string) => {
    try {
      const today = toDateString(new Date());

      const { error } = await supabase
        .from('bonus_requests')
        .insert({
          user_id: userId,
          request_date: today,
          amount: 200,
          reason,
          status: 'pending'
        } as any);

      if (error) throw error;

      // 목록 새로고침
      await get().fetchMyBonusRequests(userId);
    } catch (error) {
      throw error;
    }
  },

  // 모든 학생의 정산 기록 (관리자용)
  fetchAllSettlements: async (weekStart?: Date) => {
    try {
      let query = supabase
        .from('settlements')
        .select(`
          *,
          profiles:user_id (nickname)
        `)
        .order('week_start', { ascending: false });

      if (weekStart) {
        query = query.eq('week_start', toDateString(weekStart));
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []) as Settlement[];
    } catch (error) {
      console.error('정산 목록 로드 실패:', error);
      return [];
    }
  },

  // 주간 수당 계산
  calculateWeeklySettlement: async (userId: string, weekStart: Date) => {
    const weekEnd = getWeekEnd(weekStart);

    // 출석 수당
    const { data: sessionsData } = await supabase
      .from('study_sessions')
      .select('base_amount, extra_amount, is_present')
      .eq('user_id', userId)
      .gte('study_date', toDateString(weekStart))
      .lte('study_date', toDateString(weekEnd));

    const sessions = (sessionsData || []) as Pick<StudySession, 'base_amount' | 'extra_amount' | 'is_present'>[];
    const attendance = sessions
      .filter(s => s.is_present)
      .reduce((sum, s) => sum + s.base_amount + s.extra_amount, 0);

    // 시험 수당
    const { data: testsData } = await supabase
      .from('test_results')
      .select('reward_amount')
      .eq('user_id', userId)
      .gte('test_date', toDateString(weekStart))
      .lte('test_date', toDateString(weekEnd));

    const tests = (testsData || []) as Pick<TestResult, 'reward_amount'>[];
    const test = tests.reduce((sum, t) => sum + t.reward_amount, 0);

    // 추가 수당 (승인된 것만)
    const { data: bonusesData } = await supabase
      .from('bonus_requests')
      .select('amount')
      .eq('user_id', userId)
      .eq('status', 'approved')
      .gte('request_date', toDateString(weekStart))
      .lte('request_date', toDateString(weekEnd));

    const bonuses = (bonusesData || []) as Pick<BonusRequest, 'amount'>[];
    const bonus = bonuses.reduce((sum, b) => sum + b.amount, 0);

    return {
      attendance,
      test,
      bonus,
      total: attendance + test + bonus
    };
  },

  // 정산 생성 (관리자)
  createSettlement: async (userId: string, weekStart: Date) => {
    try {
      const weekEnd = getWeekEnd(weekStart);
      const amounts = await get().calculateWeeklySettlement(userId, weekStart);

      const { error } = await supabase
        .from('settlements')
        .upsert({
          user_id: userId,
          week_start: toDateString(weekStart),
          week_end: toDateString(weekEnd),
          attendance_amount: amounts.attendance,
          test_amount: amounts.test,
          bonus_amount: amounts.bonus,
          total_amount: amounts.total,
          is_paid: false,
          paid_amount: 0
        } as any, { onConflict: 'user_id,week_start' });

      if (error) throw error;
    } catch (error) {
      throw error;
    }
  },

  // 지급 처리 (관리자)
  processPayment: async (settlementId: string, paidAmount: number, proofUrl?: string, note?: string) => {
    try {
      const updateData = {
        is_paid: true,
        paid_amount: paidAmount,
        paid_at: new Date().toISOString(),
        payment_proof_url: proofUrl,
        payment_note: note,
        updated_at: new Date().toISOString()
      };
      // @ts-expect-error - 새 테이블이 DB에 생성되면 타입 자동 인식됨
      const { error } = await supabase.from('settlements').update(updateData).eq('id', settlementId);

      if (error) throw error;
    } catch (error) {
      throw error;
    }
  },

  // 대기 중인 추가수당 신청 목록 (관리자)
  fetchPendingBonusRequests: async () => {
    try {
      const { data, error } = await supabase
        .from('bonus_requests')
        .select(`
          *,
          profiles:user_id (nickname)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as BonusRequest[];
    } catch (error) {
      console.error('대기 중 신청 목록 로드 실패:', error);
      return [];
    }
  },

  // 추가수당 승인 (관리자)
  approveBonus: async (requestId: string, adminId: string) => {
    try {
      const updateData = {
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminId
      };
      // @ts-expect-error - 새 테이블이 DB에 생성되면 타입 자동 인식됨
      const { error } = await supabase.from('bonus_requests').update(updateData).eq('id', requestId);

      if (error) throw error;
    } catch (error) {
      throw error;
    }
  },

  // 추가수당 거절 (관리자)
  rejectBonus: async (requestId: string, adminId: string, reason: string) => {
    try {
      const updateData = {
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminId,
        reject_reason: reason
      };
      // @ts-expect-error - 새 테이블이 DB에 생성되면 타입 자동 인식됨
      const { error } = await supabase.from('bonus_requests').update(updateData).eq('id', requestId);

      if (error) throw error;
    } catch (error) {
      throw error;
    }
  },

  // 지급 취소 (관리자)
  cancelPayment: async (settlementId: string) => {
    try {
      const updateData = {
        is_paid: false,
        paid_amount: 0,
        paid_at: null,
        payment_proof_url: null,
        payment_note: null,
        updated_at: new Date().toISOString()
      };
      // @ts-expect-error - 새 테이블이 DB에 생성되면 타입 자동 인식됨
      const { error } = await supabase.from('settlements').update(updateData).eq('id', settlementId);

      if (error) throw error;
    } catch (error) {
      throw error;
    }
  },

  // 정산 삭제 (관리자)
  deleteSettlement: async (settlementId: string) => {
    try {
      const { error } = await supabase
        .from('settlements')
        .delete()
        .eq('id', settlementId);

      if (error) throw error;
    } catch (error) {
      throw error;
    }
  },

  // 재정산 (관리자) - 기존 정산 삭제 후 재계산
  recalculateSettlement: async (settlementId: string) => {
    try {
      // 기존 정산 정보 가져오기
      const { data: settlement, error: fetchError } = await supabase
        .from('settlements')
        .select('user_id, week_start')
        .eq('id', settlementId)
        .single();

      if (fetchError) throw fetchError;
      if (!settlement) throw new Error('정산을 찾을 수 없습니다.');

      // @ts-expect-error - settlements 테이블의 타입이 자동 생성되면 해결됨
      const userId = settlement.user_id as string;
      // @ts-expect-error - settlements 테이블의 타입이 자동 생성되면 해결됨
      const weekStartStr = settlement.week_start as string;

      // 기존 정산 삭제
      await get().deleteSettlement(settlementId);

      // 재정산 생성
      const weekStart = new Date(weekStartStr);
      await get().createSettlement(userId, weekStart);
    } catch (error) {
      throw error;
    }
  }
}));
