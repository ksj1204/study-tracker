import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    // study_sessions upsert
    const { data, error } = await supabase
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

    if (error) {
      console.error('[save-attendance] DB 에러:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: error.message }),
      };
    }

    console.log('[save-attendance] 성공:', data);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, data }),
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
