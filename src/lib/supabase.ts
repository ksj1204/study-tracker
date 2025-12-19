import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// Supabase 설정 (직접 입력)
const supabaseUrl = 'https://ecygfbfqremwgwzytarl.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjeWdmYmZxcmVtd2d3enl0YXJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MzQ4MjQsImV4cCI6MjA4MTAxMDgyNH0.EnDqmvkbkgrmKojINRJwk4JsPljRKLgBePBICf94YIU';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// 헬퍼 함수들
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// 업로드 옵션 인터페이스
interface UploadOptions {
  timeout?: number;  // 업로드 타임아웃 (기본 60초)
}

// 이미지 업로드 (타임아웃 및 에러 처리 강화)
// ============================================================================
// File을 Base64로 변환 (Netlify Function용)
// ============================================================================
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ============================================================================
// Netlify Function을 통한 업로드 (Android용 - 안정적)
// ============================================================================
async function uploadViaNetlifyFunction(
  file: File, 
  fileName: string, 
  bucket: string
): Promise<string> {
  console.log(`[NetlifyUpload] 서버 중계 업로드 시작: ${bucket}/${fileName}`);
  
  // File → Base64 변환
  const imageData = await fileToBase64(file);
  console.log(`[NetlifyUpload] Base64 변환 완료, 길이: ${imageData.length}`);
  
  // Netlify Function 호출
  const response = await fetch('/.netlify/functions/upload-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageData, fileName, bucket })
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(`서버 업로드 실패: ${errorData.error || response.statusText}`);
  }
  
  const result = await response.json();
  console.log(`[NetlifyUpload] 업로드 성공:`, result.url);
  return result.url;
}

// ============================================================================
// 이미지 업로드 (출석 사진)
// ============================================================================
export async function uploadStudyImage(
  userId: string, 
  file: File, 
  options: UploadOptions = {}
): Promise<string> {
  const { timeout = 30000 } = options;
  const fileExt = file.name.split('.').pop() || 'jpg';
  const fileName = `${userId}/${Date.now()}.${fileExt}`;
  
  // Android 감지
  const isAndroid = /android/i.test(navigator.userAgent);
  
  // Android: Netlify Function 서버 중계 (WebView 문제 우회)
  if (isAndroid) {
    console.log('[uploadStudyImage] Android 감지 - 서버 중계 업로드 사용');
    try {
      return await uploadViaNetlifyFunction(file, fileName, 'study-images');
    } catch (error) {
      console.error('[uploadStudyImage] 서버 중계 실패:', error);
      throw error;
    }
  }
  
  // PC/iOS: Supabase 직접 업로드
  console.log('[uploadStudyImage] Supabase 직접 업로드');
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error('업로드 시간이 초과되었습니다.'));
    }, timeout);
  });
  
  const uploadPromise = (async () => {
    const { data, error } = await supabase.storage
      .from('study-images')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: 'image/jpeg'
      });
    
    if (error) throw new Error(`업로드 실패: ${error.message}`);
    
    const { data: { publicUrl } } = supabase.storage
      .from('study-images')
      .getPublicUrl(data.path);
    
    return publicUrl;
  })();
  
  return Promise.race([uploadPromise, timeoutPromise]);
}

// ============================================================================
// 이미지 업로드 (시험 사진)
// ============================================================================
export async function uploadTestImage(
  userId: string, 
  file: File,
  options: UploadOptions = {}
): Promise<string> {
  const { timeout = 30000 } = options;
  const fileExt = file.name.split('.').pop() || 'jpg';
  const fileName = `${userId}/${Date.now()}.${fileExt}`;
  
  // Android 감지
  const isAndroid = /android/i.test(navigator.userAgent);
  
  console.log('[uploadTestImage] 업로드 시작:', fileName, file.size, isAndroid ? '(Android)' : '');
  
  // Android: Netlify Function 서버 중계
  if (isAndroid) {
    console.log('[uploadTestImage] Android 감지 - 서버 중계 업로드 사용');
    try {
      return await uploadViaNetlifyFunction(file, fileName, 'test-images');
    } catch (error) {
      console.error('[uploadTestImage] 서버 중계 실패:', error);
      throw error;
    }
  }
  
  // PC/iOS: Supabase 직접 업로드
  console.log('[uploadTestImage] Supabase 직접 업로드');
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error('업로드 시간이 초과되었습니다.'));
    }, timeout);
  });
  
  const uploadPromise = (async () => {
    const { data, error } = await supabase.storage
      .from('test-images')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: 'image/jpeg'
      });
    
    if (error) throw new Error(`업로드 실패: ${error.message}`);
    
    const { data: { publicUrl } } = supabase.storage
      .from('test-images')
      .getPublicUrl(data.path);
    
    return publicUrl;
  })();
  
  return Promise.race([uploadPromise, timeoutPromise]);
}

// ============================================================================
// 3개월 지난 사진 자동 삭제 함수
// ============================================================================

/**
 * 3개월 지난 사진 삭제 (Storage 정리)
 * 관리자 대시보드에서 수동으로 호출하거나, 앱 시작 시 자동 실행
 */
export async function cleanupOldPhotos(): Promise<{ deleted: number; errors: string[] }> {
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const cutoffDate = threeMonthsAgo.toISOString().split('T')[0];
  
  console.log('[Cleanup] 3개월 이전 사진 삭제 시작, 기준일:', cutoffDate);
  
  let deleted = 0;
  const errors: string[] = [];
  
  try {
    // 1. 3개월 이전 출석 세션의 사진 URL 가져오기
    const { data: oldSessions } = await supabase
      .from('study_sessions')
      .select('id, study_photo_url, study_date')
      .lt('study_date', cutoffDate)
      .not('study_photo_url', 'is', null);
    
    // 2. 3개월 이전 시험 결과의 사진 URL 가져오기
    const { data: oldTests } = await supabase
      .from('test_results')
      .select('id, test_photo_url, test_photo_urls, test_date')
      .lt('test_date', cutoffDate);
    
    // 3. study-images 버킷에서 파일 삭제
    if (oldSessions && oldSessions.length > 0) {
      for (const session of oldSessions) {
        if (session.study_photo_url) {
          try {
            // URL에서 파일 경로 추출
            const urlParts = session.study_photo_url.split('/study-images/');
            if (urlParts[1]) {
              const filePath = decodeURIComponent(urlParts[1]);
              const { error } = await supabase.storage
                .from('study-images')
                .remove([filePath]);
              
              if (!error) {
                deleted++;
                // DB에서 URL 제거
                await supabase
                  .from('study_sessions')
                  .update({ study_photo_url: null })
                  .eq('id', session.id);
              } else {
                errors.push(`study-images: ${filePath}`);
              }
            }
          } catch (e) {
            errors.push(`Error: ${session.study_photo_url}`);
          }
        }
      }
    }
    
    // 4. test-images 버킷에서 파일 삭제
    if (oldTests && oldTests.length > 0) {
      for (const test of oldTests) {
        const urls = (test as any).test_photo_urls || 
          (test.test_photo_url ? [test.test_photo_url] : []);
        
        for (const url of urls) {
          if (!url) continue;
          try {
            const urlParts = url.split('/test-images/');
            if (urlParts[1]) {
              const filePath = decodeURIComponent(urlParts[1]);
              const { error } = await supabase.storage
                .from('test-images')
                .remove([filePath]);
              
              if (!error) {
                deleted++;
              } else {
                errors.push(`test-images: ${filePath}`);
              }
            }
          } catch (e) {
            errors.push(`Error: ${url}`);
          }
        }
        
        // DB에서 URL 제거
        await supabase
          .from('test_results')
          .update({ 
            test_photo_url: null,
            test_photo_urls: []
          } as any)
          .eq('id', test.id);
      }
    }
    
    console.log(`[Cleanup] 완료: ${deleted}개 파일 삭제, ${errors.length}개 오류`);
    
  } catch (error) {
    console.error('[Cleanup] 오류:', error);
    errors.push(`General error: ${error}`);
  }
  
  return { deleted, errors };
}

/**
 * Storage 용량 확인 (DB 기반 - 더 빠름)
 */
export async function getStorageUsage(): Promise<{ studyImages: number; testImages: number }> {
  let studyImages = 0;
  let testImages = 0;
  
  try {
    // DB에서 사진 URL이 있는 레코드 수 카운트 (Storage API보다 빠름)
    const { count: studyCount } = await supabase
      .from('study_sessions')
      .select('*', { count: 'exact', head: true })
      .not('study_photo_url', 'is', null);
    
    const { count: testCount } = await supabase
      .from('test_results')
      .select('*', { count: 'exact', head: true })
      .not('test_photo_url', 'is', null);
    
    studyImages = studyCount || 0;
    testImages = testCount || 0;
    
  } catch (error) {
    console.error('[Storage] 용량 확인 실패:', error);
  }
  
  return { studyImages, testImages };
}
