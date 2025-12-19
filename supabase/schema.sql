-- ============================================================================
-- 🐣 병아리 스터디 - Supabase Database Schema
-- ============================================================================
-- 이 파일을 Supabase SQL Editor에서 실행하세요

-- ============================================================================
-- 1. 프로필 테이블 (사용자 정보)
-- ============================================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'student')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 정책
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "프로필 조회는 모든 인증 사용자 가능"
  ON profiles FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "본인 프로필만 수정 가능"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "프로필 생성 허용"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);


-- ============================================================================
-- 2. 일일 출석/공부 기록 테이블
-- ============================================================================
CREATE TABLE IF NOT EXISTS study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  study_date DATE NOT NULL,
  is_present BOOLEAN DEFAULT FALSE,
  study_photo_url TEXT,
  base_amount INTEGER DEFAULT 0,
  extra_amount INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, study_date)
);

-- RLS 정책
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "학생은 본인 기록만 조회"
  ON study_sessions FOR SELECT
  USING (
    auth.uid() = user_id 
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "학생은 본인 기록만 생성"
  ON study_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "학생은 본인 기록만 수정"
  ON study_sessions FOR UPDATE
  USING (
    auth.uid() = user_id 
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );


-- ============================================================================
-- 3. 시험 결과 테이블
-- ============================================================================
CREATE TABLE IF NOT EXISTS test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  test_date DATE NOT NULL,
  score INTEGER NOT NULL,
  prev_score INTEGER,
  is_pass BOOLEAN NOT NULL,
  reward_amount INTEGER NOT NULL,
  test_photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, test_date)
);

-- RLS 정책
ALTER TABLE test_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "학생은 본인 시험 기록만 조회"
  ON test_results FOR SELECT
  USING (
    auth.uid() = user_id 
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "학생은 본인 시험 기록만 생성"
  ON test_results FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "관리자만 시험 기록 수정 가능"
  ON test_results FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));


-- ============================================================================
-- 4. 캐릭터 상태 테이블
-- ============================================================================
CREATE TABLE IF NOT EXISTS character_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  current_stage TEXT NOT NULL DEFAULT 'egg',
  current_color TEXT NOT NULL DEFAULT 'red',
  consecutive_days INTEGER DEFAULT 0,
  consecutive_absence INTEGER DEFAULT 0,
  total_days INTEGER DEFAULT 0,
  mood_level INTEGER DEFAULT 50 CHECK (mood_level >= 0 AND mood_level <= 100),
  last_active_date DATE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 정책
ALTER TABLE character_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "캐릭터 상태 조회"
  ON character_state FOR SELECT
  USING (
    auth.uid() = user_id 
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "본인 캐릭터만 수정"
  ON character_state FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "본인 캐릭터만 생성"
  ON character_state FOR INSERT
  WITH CHECK (auth.uid() = user_id);


-- ============================================================================
-- 5. 업적/뱃지 테이블
-- ============================================================================
CREATE TABLE IF NOT EXISTS achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  achievement_type TEXT NOT NULL,
  achieved_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, achievement_type)
);

-- RLS 정책
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "업적 조회"
  ON achievements FOR SELECT
  USING (
    auth.uid() = user_id 
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "업적 생성"
  ON achievements FOR INSERT
  WITH CHECK (auth.uid() = user_id);


-- ============================================================================
-- 6. 인덱스 설정 (조회 성능 최적화)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_study_sessions_user_date
  ON study_sessions (user_id, study_date);

CREATE INDEX IF NOT EXISTS idx_test_results_user_date
  ON test_results (user_id, test_date);

CREATE INDEX IF NOT EXISTS idx_character_state_user
  ON character_state (user_id);


-- ============================================================================
-- 7. Storage 버킷 설정
-- ============================================================================
INSERT INTO storage.buckets (id, name, public) 
VALUES ('study-images', 'study-images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('test-images', 'test-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS
CREATE POLICY "인증된 사용자 업로드 가능"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id IN ('study-images', 'test-images')
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "모든 사용자 조회 가능"
  ON storage.objects FOR SELECT
  USING (bucket_id IN ('study-images', 'test-images'));


-- ============================================================================
-- 8. 사용자 생성 시 자동으로 프로필 생성하는 트리거 (선택)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nickname, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nickname', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'student')
  );
  
  INSERT INTO public.character_state (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 트리거 생성
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================================
-- 완료! 🎉
-- ============================================================================
-- 이제 Authentication > Users에서 테스트 계정을 생성하세요:
-- 1. 관리자: admin@study.com (비밀번호: test1234)
--    - User Metadata: {"nickname": "KSJ", "role": "admin"}
-- 2. 학생1: taeyeon@study.com (비밀번호: test1234)
--    - User Metadata: {"nickname": "태연", "role": "student"}
-- 3. 학생2: siyeon@study.com (비밀번호: test1234)
--    - User Metadata: {"nickname": "시연", "role": "student"}
