-- ============================================================================
-- 관리자 계정 역할 수정 쿼리
-- Supabase SQL Editor에서 실행하세요!
-- ============================================================================

-- 1. 먼저 현재 프로필 확인
SELECT id, nickname, role, created_at 
FROM profiles;

-- 2. admin@study.com 계정의 역할을 'admin'으로 변경
-- (이메일로 찾아서 역할 업데이트)
UPDATE profiles 
SET role = 'admin', nickname = 'KSJ'
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'admin@study.com'
);

-- 3. 변경 확인
SELECT id, nickname, role FROM profiles;
