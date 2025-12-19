-- ============================================================================
-- 출석에 시작/종료 시간 컬럼 추가
-- Supabase SQL Editor에서 실행하세요!
-- ============================================================================

-- study_sessions 테이블에 시작/종료 시간 컬럼 추가
ALTER TABLE study_sessions 
ADD COLUMN IF NOT EXISTS start_time TIME,
ADD COLUMN IF NOT EXISTS end_time TIME;

-- 확인
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'study_sessions';
