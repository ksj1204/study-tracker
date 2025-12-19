import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// 캐릭터 성장 로직 (characterUtils.ts에서 복사)
const STAGES = ['egg', 'baby', 'teenager', 'adult', 'golden'] as const;
const COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'violet'] as const;

function getNextStage(stage: string): string {
  const idx = STAGES.indexOf(stage as any);
  if (idx === -1 || idx >= STAGES.length - 1) return stage;
  return STAGES[idx + 1];
}

function getNextColor(color: string): string {
  const idx = COLORS.indexOf(color as any);
  if (idx === -1 || idx >= COLORS.length - 1) return color;
  return COLORS[idx + 1];
}

function increaseMood(current: number, consecutiveDays: number): number {
  const increase = Math.min(5 + consecutiveDays, 15);
  return Math.min(current + increase, 100);
}

export const handler: Handler = async (event) => {
  // CORS 헤더
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Preflight 요청 처리
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { userId, studyDate, photoUrl, startTime, endTime } = body;

    console.log('[save-attendance] 요청:', { userId, studyDate, startTime, endTime });

    if (!userId || !studyDate || !photoUrl) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '필수 필드 누락' }),
      };
    }

    // 1. study_sessions upsert
    const { data: sessionData, error: sessionError } = await supabase
      .from('study_sessions')
      .upsert({
        user_id: userId,
        study_date: studyDate,
        is_present: true,
        study_photo_url: photoUrl,
        start_time: startTime,
        end_time: endTime,
        base_amount: 500,
        extra_amount: 0,
      }, { onConflict: 'user_id,study_date' })
      .select()
      .single();

    if (sessionError) {
      console.error('[save-attendance] 출석 DB 에러:', sessionError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: sessionError.message }),
      };
    }

    console.log('[save-attendance] 출석 저장 성공');

    // 2. 캐릭터 업데이트
    try {
      // 현재 캐릭터 상태 가져오기
      const { data: charState, error: charError } = await supabase
        .from('character_state')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (charError) {
        console.warn('[save-attendance] 캐릭터 조회 실패:', charError);
      } else if (charState) {
        // 성장 계산
        const newConsecutive = charState.consecutive_days + 1;
        let newStage = charState.current_stage;
        let newColor = charState.current_color;

        // 7일 연속 출석마다 성장
        if (newConsecutive % 7 === 0 && newStage !== 'golden') {
          if (newStage === 'adult') {
            // adult에서 golden으로
            newStage = 'golden';
          } else {
            newStage = getNextStage(newStage);
          }
        }

        // 21일 연속 출석마다 색상 변경
        if (newConsecutive % 21 === 0 && newColor !== 'violet') {
          newColor = getNextColor(newColor);
        }

        const newMood = increaseMood(charState.mood_level, newConsecutive);

        const { error: updateError } = await supabase
          .from('character_state')
          .update({
            current_stage: newStage,
            current_color: newColor,
            consecutive_days: newConsecutive,
            consecutive_absence: 0,
            total_days: charState.total_days + 1,
            mood_level: newMood,
            last_active_date: studyDate,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);

        if (updateError) {
          console.warn('[save-attendance] 캐릭터 업데이트 실패:', updateError);
        } else {
          console.log('[save-attendance] 캐릭터 업데이트 성공:', { newStage, newColor, newConsecutive });
        }
      }
    } catch (charErr) {
      console.warn('[save-attendance] 캐릭터 처리 오류:', charErr);
      // 캐릭터 업데이트 실패해도 출석은 성공
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, data: sessionData }),
    };
  } catch (err) {
    console.error('[save-attendance] 오류:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: String(err) }),
    };
  }
};
