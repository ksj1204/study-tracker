// ============================================================================
// 인증 상태 관리 (Zustand)
// ============================================================================

import { create } from 'zustand';
import { supabase, getProfile } from '@/lib/supabase';
import type { Profile } from '@/types/database';
import type { User } from '@supabase/supabase-js';

interface AuthState {
  // 상태
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  
  // 액션
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  // 초기 상태
  user: null,
  profile: null,
  isLoading: false,
  isInitialized: false,
  error: null,
  
  // 앱 시작 시 세션 확인
  initialize: async () => {
    try {
      set({ isLoading: true });
      
      // 현재 세션 확인
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        // 프로필 가져오기
        const profile = await getProfile(session.user.id);
        set({ user: session.user, profile, isInitialized: true, isLoading: false });
      } else {
        set({ isInitialized: true, isLoading: false });
      }
      
      // 인증 상태 변경 리스너
      supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const profile = await getProfile(session.user.id);
          set({ user: session.user, profile });
        } else if (event === 'SIGNED_OUT') {
          set({ user: null, profile: null });
        }
      });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : '초기화 실패',
        isInitialized: true,
        isLoading: false 
      });
    }
  },
  
  // 로그인
  signIn: async (email: string, password: string) => {
    try {
      set({ isLoading: true, error: null });
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;
      
      if (data.user) {
        const profile = await getProfile(data.user.id);
        set({ user: data.user, profile, isLoading: false });
      }
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : '로그인 실패',
        isLoading: false 
      });
      throw error;
    }
  },
  
  // 로그아웃
  signOut: async () => {
    try {
      set({ isLoading: true });
      await supabase.auth.signOut();
      set({ user: null, profile: null, isLoading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : '로그아웃 실패',
        isLoading: false 
      });
    }
  },
  
  // 에러 클리어
  clearError: () => set({ error: null }),
}));

// 편의 훅
export function useAuth() {
  const store = useAuthStore();
  return {
    user: store.user,
    profile: store.profile,
    isLoading: store.isLoading,
    isInitialized: store.isInitialized,
    error: store.error,
    isAdmin: store.profile?.role === 'admin',
    isStudent: store.profile?.role === 'student',
    isAuthenticated: !!store.user,
    signIn: store.signIn,
    signOut: store.signOut,
    clearError: store.clearError,
  };
}
