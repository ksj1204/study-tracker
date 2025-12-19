-- 시험 결과 테이블에 새 컬럼 추가
-- 여러 장의 사진, 승인 관련 필드

-- 기존 테이블에 컬럼 추가
ALTER TABLE test_results 
ADD COLUMN IF NOT EXISTS test_photo_urls TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS manual_score_input BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- 인덱스 추가 (승인 대기 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_test_results_is_approved ON test_results(is_approved);
CREATE INDEX IF NOT EXISTS idx_test_results_test_date ON test_results(test_date);

-- 기존 데이터 승인 처리 (이미 등록된 데이터는 승인된 것으로 처리)
UPDATE test_results SET is_approved = TRUE WHERE is_approved IS NULL OR is_approved = FALSE;
