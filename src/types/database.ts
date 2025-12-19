// ============================================================================
// 데이터베이스 타입 정의
// ============================================================================

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at'>;
        Update: Partial<Profile>;
      };
      study_sessions: {
        Row: StudySession;
        Insert: Omit<StudySession, 'id' | 'created_at'>;
        Update: Partial<StudySession>;
      };
      test_results: {
        Row: TestResult;
        Insert: Omit<TestResult, 'id' | 'created_at' | 'is_approved' | 'approved_at' | 'approved_by'> & {
          is_approved?: boolean;
          approved_at?: string;
          approved_by?: string;
        };
        Update: Partial<TestResult>;
      };
      character_state: {
        Row: CharacterState;
        Insert: Omit<CharacterState, 'id' | 'updated_at'>;
        Update: Partial<CharacterState>;
      };
      achievements: {
        Row: Achievement;
        Insert: Omit<Achievement, 'id' | 'achieved_at'>;
        Update: Partial<Achievement>;
      };
      settlements: {
        Row: Settlement;
        Insert: Omit<Settlement, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Settlement>;
      };
      bonus_requests: {
        Row: BonusRequest;
        Insert: Omit<BonusRequest, 'id' | 'created_at'>;
        Update: Partial<BonusRequest>;
      };
      attendance_edits: {
        Row: AttendanceEdit;
        Insert: Omit<AttendanceEdit, 'id' | 'created_at'>;
        Update: Partial<AttendanceEdit>;
      };
    };
  };
}

// 사용자 프로필
export interface Profile {
  id: string;
  nickname: string;
  role: 'admin' | 'student';
  avatar_url?: string;
  created_at: string;
}

// 일일 출석/공부 기록
export interface StudySession {
  id: string;
  user_id: string;
  study_date: string;
  is_present: boolean;
  study_photo_url?: string;
  start_time?: string;  // HH:MM 형식
  end_time?: string;    // HH:MM 형식
  base_amount: number;
  extra_amount: number;
  created_at: string;
}

// 시험 결과
export interface TestResult {
  id: string;
  user_id: string;
  test_date: string;
  score: number;
  prev_score?: number;
  is_pass: boolean;
  is_approved?: boolean;           // 관리자 승인 여부
  reward_amount: number;
  test_photo_url?: string;
  test_photo_urls?: string[];      // 여러 장의 사진 URL
  manual_score_input?: boolean;    // 수동 점수 입력 여부
  approved_by?: string;            // 승인한 관리자 ID
  approved_at?: string;            // 승인 일시
  created_at: string;
}

// 캐릭터 상태
export interface CharacterState {
  id: string;
  user_id: string;
  current_stage: CharacterStage;
  current_color: RainbowColor;
  consecutive_days: number;
  consecutive_absence: number;
  total_days: number;
  mood_level: number;
  last_active_date?: string;
  updated_at: string;
}

// 업적
export interface Achievement {
  id: string;
  user_id: string;
  achievement_type: string;
  achieved_at: string;
}

// ============================================================================
// 캐릭터 타입 정의
// ============================================================================

export type CharacterStage = 
  | 'egg'        // 🥚 1~7일
  | 'hatching'   // 🐣 8~14일
  | 'baby'       // 🐥 15~28일
  | 'adult'      // 🐔 29~42일
  | 'golden'     // ✨🐔 43~56일
  | 'legend';    // 👑🐔 57일+

export type RainbowColor = 
  | 'red'      // 🔴 1일차
  | 'orange'   // 🟠 2일차
  | 'yellow'   // 🟡 3일차
  | 'green'    // 🟢 4일차
  | 'blue'     // 🔵 5일차
  | 'indigo'   // 🟣 6일차
  | 'violet';  // 💜 7일차

export type MoodState = 
  | 'very_happy'
  | 'happy'
  | 'neutral'
  | 'sad'
  | 'depressed'
  | 'dying';

// ============================================================================
// 캐릭터 설정 상수
// ============================================================================

export interface CharacterConfig {
  stage: CharacterStage;
  name: string;
  minDays: number;
  maxDays: number;
  emoji: string;
}

export const CHARACTER_STAGES: CharacterConfig[] = [
  { stage: 'egg', name: '달걀', minDays: 1, maxDays: 7, emoji: '🥚' },
  { stage: 'hatching', name: '부화 중', minDays: 8, maxDays: 14, emoji: '🐣' },
  { stage: 'baby', name: '아기 병아리', minDays: 15, maxDays: 28, emoji: '🐥' },
  { stage: 'adult', name: '성인 닭', minDays: 29, maxDays: 42, emoji: '🐔' },
  { stage: 'golden', name: '황금 닭', minDays: 43, maxDays: 56, emoji: '✨🐔' },
  { stage: 'legend', name: '전설의 닭', minDays: 57, maxDays: Infinity, emoji: '👑🐔' },
];

export interface RainbowColorConfig {
  id: RainbowColor;
  name: string;
  hex: string;
  day: number;
}

export const RAINBOW_COLORS: RainbowColorConfig[] = [
  { id: 'red', name: '빨강', hex: '#FF6B6B', day: 1 },
  { id: 'orange', name: '주황', hex: '#FFA94D', day: 2 },
  { id: 'yellow', name: '노랑', hex: '#FFD93D', day: 3 },
  { id: 'green', name: '초록', hex: '#6BCB77', day: 4 },
  { id: 'blue', name: '파랑', hex: '#4D96FF', day: 5 },
  { id: 'indigo', name: '남색', hex: '#6C5CE7', day: 6 },
  { id: 'violet', name: '보라', hex: '#A66CFF', day: 7 },
];

// 표정 설정
export interface MoodConfig {
  state: MoodState;
  minLevel: number;
  maxLevel: number;
  emoji: string;
  description: string;
}

export const MOOD_STATES: MoodConfig[] = [
  { state: 'very_happy', minLevel: 90, maxLevel: 100, emoji: '😄', description: '매우 행복' },
  { state: 'happy', minLevel: 70, maxLevel: 89, emoji: '😊', description: '행복' },
  { state: 'neutral', minLevel: 50, maxLevel: 69, emoji: '😐', description: '보통' },
  { state: 'sad', minLevel: 30, maxLevel: 49, emoji: '😢', description: '슬픔' },
  { state: 'depressed', minLevel: 10, maxLevel: 29, emoji: '😭', description: '우울' },
  { state: 'dying', minLevel: 0, maxLevel: 9, emoji: '💀', description: '빈사' },
];

// ============================================================================
// 주간 통계 타입
// ============================================================================

export interface WeeklyStats {
  userId: string;
  nickname: string;
  attendanceDays: number;
  totalDays: number;
  baseReward: number;
  extraReward: number;
  testReward: number;
  totalReward: number;
  characterStage: CharacterStage;
  characterColor: RainbowColor;
  consecutiveDays: number;
}

export interface MonthlyStats {
  attendanceRate: number;
  testPassRate: number;
  totalReward: number;
  baseReward: number;
  testReward: number;
  extraReward: number;
  achievementBonus: number;
}

// ============================================================================
// 정산 타입 정의
// ============================================================================

// 주별 정산
export interface Settlement {
  id: string;
  user_id: string;
  week_start: string;           // 주 시작일 (월요일)
  week_end: string;             // 주 종료일 (일요일)
  attendance_amount: number;    // 출석 수당
  test_amount: number;          // 시험 수당
  bonus_amount: number;         // 추가 수당
  total_amount: number;         // 총 예상 수당
  is_paid: boolean;             // 지급 여부
  paid_amount: number;          // 실제 지급액
  paid_at?: string;             // 지급 일시
  payment_proof_url?: string;   // 지급 증빙 사진
  payment_note?: string;        // 지급 메모
  created_at: string;
  updated_at: string;
}

// 추가수당 신청
export interface BonusRequest {
  id: string;
  user_id: string;
  request_date: string;
  amount: number;               // 고정 200원
  reason: string;               // 신청 사유
  status: 'pending' | 'approved' | 'rejected';
  reviewed_at?: string;
  reviewed_by?: string;
  reject_reason?: string;       // 거절 사유
  created_at: string;
}

// 출결 수정 이력
export interface AttendanceEdit {
  id: string;
  session_id?: string;
  user_id: string;
  study_date: string;
  edited_by: string;
  old_is_present?: boolean;
  new_is_present?: boolean;
  edit_reason?: string;
  created_at: string;
}

// 정산 현황 요약 (학생용)
export interface SettlementSummary {
  currentWeekExpected: number;    // 이번 주 예상 수당
  currentWeekPaid: number;        // 이번 주 지급액
  monthlyPaid: number;            // 이번 달 지급 총액
  totalPaid: number;              // 총 지급 받은 금액
  unpaidAmount: number;           // 미지급 금액
}

