-- ============================================================================
-- 🐣 병아리 스터디 - Schema V2 (정산 시스템 추가)
-- ============================================================================
-- 기존 schema.sql 실행 후 이 파일을 실행하세요

-- ============================================================================
-- 1. 정산 테이블 (주별 정산 기록)
-- ============================================================================
CREATE TABLE IF NOT EXISTS settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  week_start DATE NOT NULL,           -- 주 시작일 (월요일)
  week_end DATE NOT NULL,             -- 주 종료일 (일요일)
  
  -- 수당 내역
  attendance_amount INTEGER DEFAULT 0,  -- 출석 수당
  test_amount INTEGER DEFAULT 0,        -- 시험 수당
  bonus_amount INTEGER DEFAULT 0,       -- 추가 수당
  total_amount INTEGER DEFAULT 0,       -- 총 예상 수당
  
  -- 지급 정보
  is_paid BOOLEAN DEFAULT FALSE,        -- 지급 여부
  paid_amount INTEGER DEFAULT 0,        -- 실제 지급액
  paid_at TIMESTAMPTZ,                  -- 지급 일시
  payment_proof_url TEXT,               -- 지급 증빙 사진
  payment_note TEXT,                    -- 지급 메모
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, week_start)
);

-- RLS 정책
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "학생은 본인 정산만 조회" ON settlements;
CREATE POLICY "학생은 본인 정산만 조회"
  ON settlements FOR SELECT
  USING (
    auth.uid() = user_id 
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "관리자만 정산 생성 가능" ON settlements;
CREATE POLICY "관리자만 정산 생성 가능"
  ON settlements FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "관리자만 정산 수정 가능" ON settlements;
CREATE POLICY "관리자만 정산 수정 가능"
  ON settlements FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));


-- ============================================================================
-- 2. 추가수당 신청 테이블
-- ============================================================================
CREATE TABLE IF NOT EXISTS bonus_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  request_date DATE NOT NULL,
  amount INTEGER DEFAULT 200,           -- 고정 200원
  reason TEXT NOT NULL,                 -- 신청 사유 (간략 한줄)
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES profiles(id),
  reject_reason TEXT,                   -- 거절 사유
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 정책
ALTER TABLE bonus_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "학생은 본인 신청만 조회" ON bonus_requests;
CREATE POLICY "학생은 본인 신청만 조회"
  ON bonus_requests FOR SELECT
  USING (
    auth.uid() = user_id 
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "학생은 본인 신청만 생성" ON bonus_requests;
CREATE POLICY "학생은 본인 신청만 생성"
  ON bonus_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "관리자만 신청 수정 가능" ON bonus_requests;
CREATE POLICY "관리자만 신청 수정 가능"
  ON bonus_requests FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));


-- ============================================================================
-- 3. 출결 수정 이력 테이블
-- ============================================================================
CREATE TABLE IF NOT EXISTS attendance_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES study_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,                -- 대상 학생
  study_date DATE NOT NULL,             -- 수정 대상 날짜
  edited_by UUID REFERENCES profiles(id) NOT NULL,
  old_is_present BOOLEAN,
  new_is_present BOOLEAN,
  edit_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 정책
ALTER TABLE attendance_edits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "출결 수정 이력 조회" ON attendance_edits;
CREATE POLICY "출결 수정 이력 조회"
  ON attendance_edits FOR SELECT
  USING (
    auth.uid() = user_id 
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "관리자만 출결 수정 이력 생성" ON attendance_edits;
CREATE POLICY "관리자만 출결 수정 이력 생성"
  ON attendance_edits FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));


-- ============================================================================
-- 4. 인덱스 설정
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_settlements_user_week
  ON settlements (user_id, week_start);

CREATE INDEX IF NOT EXISTS idx_bonus_requests_user_date
  ON bonus_requests (user_id, request_date);

CREATE INDEX IF NOT EXISTS idx_bonus_requests_status
  ON bonus_requests (status);

CREATE INDEX IF NOT EXISTS idx_attendance_edits_user
  ON attendance_edits (user_id, study_date);


-- ============================================================================
-- 5. Storage 버킷 추가 (지급 증빙 사진용)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public) 
VALUES ('payment-proofs', 'payment-proofs', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS
DROP POLICY IF EXISTS "관리자만 증빙 업로드 가능" ON storage.objects;
CREATE POLICY "관리자만 증빙 업로드 가능"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'payment-proofs'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "증빙 사진 조회 가능" ON storage.objects;
CREATE POLICY "증빙 사진 조회 가능"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'payment-proofs');


-- ============================================================================
-- 6. study_sessions 테이블에 관리자 수정 권한 추가
-- ============================================================================
DROP POLICY IF EXISTS "학생은 본인 기록만 수정" ON study_sessions;
DROP POLICY IF EXISTS "본인 또는 관리자가 수정 가능" ON study_sessions;

CREATE POLICY "본인 또는 관리자가 수정 가능"
  ON study_sessions FOR UPDATE
  USING (
    auth.uid() = user_id 
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 관리자도 세션 생성 가능하도록
DROP POLICY IF EXISTS "학생은 본인 기록만 생성" ON study_sessions;
DROP POLICY IF EXISTS "본인 또는 관리자가 생성 가능" ON study_sessions;

CREATE POLICY "본인 또는 관리자가 생성 가능"
  ON study_sessions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id 
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );


-- ============================================================================
-- 완료! 🎉
-- ============================================================================
