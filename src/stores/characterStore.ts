// ============================================================================
// 캐릭터 상태 관리 (Zustand)
// ============================================================================

import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { 
  onAttendance, 
  processAbsence, 
  increaseMood, 
  decreaseMood,
  getCharacterDisplay,
  getColorHex,
  getStageName,
  getColorProgress
} from '@/lib/characterUtils';
import { getMissedStudyDays, toDateString } from '@/lib/dateUtils';
import type { CharacterState, CharacterStage, RainbowColor } from '@/types/database';

interface CharacterStore {
  // 상태
  characterState: CharacterState | null;
  isLoading: boolean;
  error: string | null;
  
  // 액션
  fetchCharacterState: (userId: string) => Promise<void>;
  handleAttendance: (userId: string) => Promise<void>;
  checkAndProcessAbsences: (userId: string) => Promise<number>;
  initializeCharacter: (userId: string) => Promise<void>;
  
  // 헬퍼
  getDisplay: () => string;
  getColor: () => string;
  getName: () => string;
  getProgress: () => { current: number; total: number };
}

export const useCharacterStore = create<CharacterStore>((set, get) => ({
  characterState: null,
  isLoading: false,
  error: null,
  
  // 캐릭터 상태 가져오기
  fetchCharacterState: async (userId: string) => {
    try {
      set({ isLoading: true, error: null });
      
      const { data, error } = await supabase
        .from('character_state')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows returned (신규 사용자)
        throw error;
      }
      
      set({ characterState: data, isLoading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : '캐릭터 로드 실패',
        isLoading: false 
      });
    }
  },
  
  // 신규 사용자 캐릭터 초기화
  initializeCharacter: async (userId: string) => {
    try {
      const initialState: Omit<CharacterState, 'id' | 'updated_at'> = {
        user_id: userId,
        current_stage: 'egg',
        current_color: 'red',
        consecutive_days: 0,
        consecutive_absence: 0,
        total_days: 0,
        mood_level: 50,
        last_active_date: undefined,
      };
      
      const { data, error } = await supabase
        .from('character_state')
        .insert(initialState)
        .select()
        .single();
      
      if (error) throw error;
      set({ characterState: data });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '캐릭터 초기화 실패' });
    }
  },
  
  // 출석 시 캐릭터 업데이트
  handleAttendance: async (userId: string) => {
    const { characterState } = get();
    if (!characterState) return;
    
    try {
      // 캐릭터 성장/색상 업데이트
      const result = onAttendance(
        characterState.current_stage,
        characterState.current_color
      );
      
      // 감정 증가
      const newMood = increaseMood(
        characterState.mood_level,
        characterState.consecutive_days + 1
      );
      
      const updates = {
        current_stage: result.stage,
        current_color: result.color,
        consecutive_days: characterState.consecutive_days + 1,
        consecutive_absence: 0,
        total_days: characterState.total_days + 1,
        mood_level: newMood,
        last_active_date: toDateString(new Date()),
        updated_at: new Date().toISOString(),
      };
      
      const { data, error } = await supabase
        .from('character_state')
        .update(updates)
        .eq('user_id', userId)
        .select()
        .single();
      
      if (error) throw error;
      set({ characterState: data });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '캐릭터 업데이트 실패' });
    }
  },
  
  // 결석 체크 및 처리 (접속 시 호출)
  checkAndProcessAbsences: async (userId: string) => {
    const { characterState } = get();
    if (!characterState?.last_active_date) return 0;
    
    try {
      // 놓친 공부일 계산
      const missedDays = getMissedStudyDays(characterState.last_active_date);
      
      if (missedDays.length === 0) return 0;
      
      // 결석 처리 반복
      let { current_stage, current_color, consecutive_absence, mood_level } = characterState;
      
      for (let i = 0; i < missedDays.length; i++) {
        const result = processAbsence(
          current_stage as CharacterStage,
          current_color as RainbowColor,
          consecutive_absence
        );
        current_stage = result.stage;
        current_color = result.color;
        consecutive_absence = result.consecutiveAbsence;
        
        // 감정 감소
        mood_level = decreaseMood(mood_level, i + 1);
      }
      
      // 업데이트
      const updates = {
        current_stage,
        current_color,
        consecutive_absence,
        consecutive_days: 0,  // 연속 출석 리셋
        mood_level,
        updated_at: new Date().toISOString(),
      };
      
      const { data, error } = await supabase
        .from('character_state')
        .update(updates)
        .eq('user_id', userId)
        .select()
        .single();
      
      if (error) throw error;
      set({ characterState: data });
      
      return missedDays.length;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '결석 처리 실패' });
      return 0;
    }
  },
  
  // 헬퍼 함수들
  getDisplay: () => {
    const { characterState } = get();
    if (!characterState) return '🥚';
    return getCharacterDisplay(
      characterState.current_stage,
      characterState.mood_level
    );
  },
  
  getColor: () => {
    const { characterState } = get();
    if (!characterState) return '#FF6B6B';
    return getColorHex(characterState.current_color);
  },
  
  getName: () => {
    const { characterState } = get();
    if (!characterState) return '달걀';
    return getStageName(characterState.current_stage);
  },
  
  getProgress: () => {
    const { characterState } = get();
    if (!characterState) return { current: 1, total: 7 };
    return getColorProgress(characterState.current_color);
  },
}));
