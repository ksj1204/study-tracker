-- ============================================================================
-- test_results 테이블에 누락된 컬럼 추가
-- Supabase SQL Editor에서 실행하세요
-- ============================================================================

-- 1. is_approved 컬럼 추가 (관리자 승인 여부)
ALTER TABLE test_results 
ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE;

-- 2. test_photo_urls 컬럼 추가 (여러 장 사진 저장)
ALTER TABLE test_results 
ADD COLUMN IF NOT EXISTS test_photo_urls TEXT[] DEFAULT '{}';

-- 3. manual_score_input 컬럼 추가 (수동 점수 입력 여부)
ALTER TABLE test_results 
ADD COLUMN IF NOT EXISTS manual_score_input BOOLEAN DEFAULT FALSE;

-- 4. approved_at 컬럼 추가 (승인 일시)
ALTER TABLE test_results 
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- 5. study_sessions에 start_time, end_time 컬럼 확인 (이미 있으면 무시됨)
ALTER TABLE study_sessions 
ADD COLUMN IF NOT EXISTS start_time TIME;

ALTER TABLE study_sessions 
ADD COLUMN IF NOT EXISTS end_time TIME;

-- 6. 확인 쿼리
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'test_results'
ORDER BY ordinal_position;

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'study_sessions'
ORDER BY ordinal_position;
