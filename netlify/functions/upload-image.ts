/**
 * Netlify Function: 이미지 업로드 중계
 * Android WebView에서 Supabase Storage 직접 업로드가 불안정하므로
 * 서버를 통해 중계하여 안정적인 업로드를 보장
 */

import { createClient } from '@supabase/supabase-js';
import type { Handler, HandlerEvent } from '@netlify/functions';

// Supabase 클라이언트 (service role key 사용)
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Base64 → Buffer 변환
function base64ToBuffer(base64: string): Buffer {
  // data:image/jpeg;base64, 접두사 제거
  const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
  return Buffer.from(base64Data, 'base64');
}

export const handler: Handler = async (event: HandlerEvent) => {
  // CORS 헤더
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Preflight 요청 처리
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // POST만 허용
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // 요청 바디 파싱
    const body = JSON.parse(event.body || '{}');
    const { imageData, fileName, bucket } = body;

    if (!imageData || !fileName || !bucket) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields: imageData, fileName, bucket' })
      };
    }

    // 허용된 버킷만 사용
    const allowedBuckets = ['study-images', 'test-images'];
    if (!allowedBuckets.includes(bucket)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid bucket' })
      };
    }

    console.log(`[upload-image] 업로드 시작: ${bucket}/${fileName}`);

    // Base64 → Buffer 변환
    const buffer = base64ToBuffer(imageData);
    console.log(`[upload-image] 버퍼 크기: ${buffer.length} bytes`);

    // Supabase Storage에 업로드
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, buffer, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('[upload-image] Supabase 에러:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: error.message })
      };
    }

    // Public URL 생성
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    console.log(`[upload-image] 업로드 성공: ${publicUrl}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ url: publicUrl, path: data.path })
    };

  } catch (error) {
    console.error('[upload-image] 서버 에러:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' })
    };
  }
};
