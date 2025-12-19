import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// 캐릭터 성장 로직 (characterUtils.ts 원본 로직)
const STAGES = ['egg', 'hatching', 'baby', 'adult', 'golden', 'legend'] as const;
const COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'violet'] as const;

/**
 * 출석 시 캐릭터 업데이트
 * - 색상 1단계 상승
 * - 보라(7일차)에서 출석하면 다음 캐릭터 단계로 승급 + 빨강 리셋
 */
function onAttendance(currentStage: string, currentColor: string) {
  const colorIndex = COLORS.indexOf(currentColor as any);
  const stageIndex = STAGES.indexOf(currentStage as any);
  
  if (colorIndex === 6) {  // 보라색(마지막)에서 출석
    // 다음 캐릭터 단계로 승급 + 빨강으로 리셋
    const newStage = stageIndex < 5 ? STAGES[stageIndex + 1] : 'legend';
    return { stage: newStage, color: 'red' };
  } else {
    // 색상만 1단계 상승
    const newColor = colorIndex < 6 ? COLORS[colorIndex + 1] : 'violet';
    return { stage: currentStage, color: newColor };
  }
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
        // 원래 로직: 출석할 때마다 색상 1단계 상승, 보라에서 출석하면 승급
        const result = onAttendance(charState.current_stage, charState.current_color);
        const newConsecutive = charState.consecutive_days + 1;
        const newMood = increaseMood(charState.mood_level, newConsecutive);

        console.log('[save-attendance] 캐릭터 성장:', {
          before: { stage: charState.current_stage, color: charState.current_color },
          after: { stage: result.stage, color: result.color }
        });

        const { error: updateError } = await supabase
          .from('character_state')
          .update({
            current_stage: result.stage,
            current_color: result.color,
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
          console.log('[save-attendance] 캐릭터 업데이트 성공:', { 
            stage: result.stage, 
            color: result.color, 
            consecutiveDays: newConsecutive 
          });
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
