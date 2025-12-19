/**
 * 모바일 안전 이미지 처리 유틸리티
 * v6 - 갤럭시(안드로이드) 완전 호환 버전
 * 
 * 핵심 원칙:
 * 1. 실패하면 무조건 원본 사용 (절대 에러 throw 안함)
 * 2. Android에서는 최소한의 처리만
 * 3. 모든 예외 상황 방어적 처리
 */

export interface ImageProcessingOptions {
  maxSize?: number;
  quality?: number;
  timeout?: number;
  skipIfSmall?: boolean;
}

export type ProcessingStatus = 
  | 'idle' 
  | 'reading' 
  | 'resizing' 
  | 'compressing' 
  | 'uploading' 
  | 'retrying'
  | 'done' 
  | 'error';

// ============================================================================
// 디바이스 감지
// ============================================================================

export function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /android/i.test(navigator.userAgent);
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isMobile(): boolean {
  return isAndroid() || isIOS();
}

export function getDeviceInfo(): string {
  const ua = navigator.userAgent;
  if (isAndroid()) {
    const match = ua.match(/Android\s([0-9.]+)/);
    return `Android ${match?.[1] || 'unknown'}`;
  }
  if (isIOS()) {
    const match = ua.match(/OS\s([0-9_]+)/);
    return `iOS ${match?.[1]?.replace(/_/g, '.') || 'unknown'}`;
  }
  return 'Desktop';
}

// ============================================================================
// 네트워크 상태
// ============================================================================

export function isOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

export function checkNetworkBeforeUpload(): { ok: boolean; message?: string } {
  if (!isOnline()) {
    return { 
      ok: false, 
      message: '인터넷 연결이 끊어졌습니다. Wi-Fi 또는 데이터를 확인해주세요.' 
    };
  }
  return { ok: true };
}

// ============================================================================
// 파일 유효성 검사 (매우 관대하게)
// ============================================================================

/**
 * 이미지 파일인지 확인 (관대한 검사)
 * Android에서 file.type이 빈 문자열인 경우가 많음
 */
export function isImageFile(file: File): boolean {
  // 1. MIME 타입으로 확인
  if (file.type && file.type.startsWith('image/')) {
    return true;
  }
  
  // 2. 파일 확장자로 확인 (Android fallback)
  const ext = file.name.toLowerCase().split('.').pop() || '';
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'bmp', 'tiff'];
  if (imageExtensions.includes(ext)) {
    return true;
  }
  
  // 3. 타입이 없어도 파일 이름에 확장자가 없으면 이미지로 간주 (카메라 촬영)
  if (!file.type && !ext) {
    console.log('[ImageUtils] 타입/확장자 없음 - 카메라 촬영으로 간주');
    return true;
  }
  
  return false;
}

/**
 * 이미지 파일 유효성 검사 (매우 관대)
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  console.log('[ImageUtils] 파일 검사:', {
    name: file.name,
    type: file.type || '(없음)',
    size: formatFileSize(file.size),
    device: getDeviceInfo()
  });

  // 파일이 있는지만 확인
  if (!file) {
    return { valid: false, error: '파일이 선택되지 않았습니다.' };
  }

  // 이미지 파일 확인 (관대하게)
  if (!isImageFile(file)) {
    return { valid: false, error: '이미지 파일만 업로드 가능합니다.' };
  }

  // 파일 크기 체크 (100MB까지 허용)
  const maxSize = 100 * 1024 * 1024;
  if (file.size > maxSize) {
    return { valid: false, error: '파일이 너무 큽니다. (최대 100MB)' };
  }

  // 빈 파일 체크
  if (file.size === 0) {
    return { valid: false, error: '빈 파일입니다. 다시 시도해주세요.' };
  }

  return { valid: true };
}

// ============================================================================
// 이미지 처리 (실패 시 무조건 원본 반환)
// ============================================================================

/**
 * FileReader로 이미지 로드 (가장 호환성 좋음)
 */
function loadImageSafe(file: File, timeout: number = 15000): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      console.warn('[ImageUtils] 이미지 로드 타임아웃');
      resolve(null);
    }, timeout);

    try {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const img = new Image();
          
          img.onload = () => {
            clearTimeout(timeoutId);
            resolve(img);
          };
          
          img.onerror = () => {
            clearTimeout(timeoutId);
            console.warn('[ImageUtils] 이미지 디코딩 실패');
            resolve(null);
          };
          
          img.src = e.target?.result as string;
        } catch (err) {
          clearTimeout(timeoutId);
          console.warn('[ImageUtils] 이미지 생성 실패:', err);
          resolve(null);
        }
      };
      
      reader.onerror = () => {
        clearTimeout(timeoutId);
        console.warn('[ImageUtils] FileReader 에러');
        resolve(null);
      };
      
      reader.readAsDataURL(file);
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn('[ImageUtils] 파일 읽기 실패:', err);
      resolve(null);
    }
  });
}

/**
 * 이미지 리사이즈 및 압축
 * 절대 에러를 throw하지 않음 - 실패 시 원본 반환
 */
export async function resizeAndCompressImage(
  file: File,
  options: ImageProcessingOptions = {}
): Promise<File> {
  const { 
    maxSize = 1920,      // 적당한 크기로 제한
    quality = 0.85,
    timeout = 15000,
    skipIfSmall = true
  } = options;

  const startTime = Date.now();
  console.log('[ImageUtils] 이미지 처리 시작:', {
    name: file.name,
    size: formatFileSize(file.size),
    type: file.type || '(없음)',
    device: getDeviceInfo()
  });

  try {
    // 1. 작은 파일은 그대로 사용 (1MB 미만이고 JPEG면 스킵)
    if (skipIfSmall && file.size < 1 * 1024 * 1024) {
      const isJpeg = file.type === 'image/jpeg' || 
                     file.name.toLowerCase().endsWith('.jpg') ||
                     file.name.toLowerCase().endsWith('.jpeg');
      if (isJpeg) {
        console.log('[ImageUtils] 작은 JPEG (1MB 미만) - 스킵');
        return file;
      }
    }

    // 2. 이미지 로드 (Android/iOS 모두 압축 시도)
    const img = await loadImageSafe(file, timeout);
    if (!img) {
      console.log('[ImageUtils] 이미지 로드 실패 - 원본 사용');
      return file;
    }

    const { naturalWidth: width, naturalHeight: height } = img;
    console.log('[ImageUtils] 원본 크기:', width, 'x', height);

    // 3. 이미 작은 이미지면 스킵
    if (width <= maxSize && height <= maxSize && file.size < 1 * 1024 * 1024) {
      console.log('[ImageUtils] 이미 적절한 크기 & 1MB 미만 - 스킵');
      return file;
    }

    // 4. 리사이즈 계산
    const scale = Math.min(1, maxSize / Math.max(width, height));
    const newWidth = Math.round(width * scale);
    const newHeight = Math.round(height * scale);

    // 5. 캔버스에 그리기
    const canvas = document.createElement('canvas');
    canvas.width = newWidth;
    canvas.height = newHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.warn('[ImageUtils] Canvas context 실패 - 원본 사용');
      return file;
    }

    // 흰색 배경 (PNG 투명도 처리)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, newWidth, newHeight);
    ctx.drawImage(img, 0, 0, newWidth, newHeight);

    // 6. Blob으로 변환
    const blob = await new Promise<Blob | null>((resolve) => {
      try {
        canvas.toBlob(
          (b) => resolve(b),
          'image/jpeg',
          quality
        );
      } catch {
        resolve(null);
      }
    });

    if (!blob) {
      console.warn('[ImageUtils] Blob 변환 실패 - 원본 사용');
      return file;
    }

    // 7. 새 파일 생성
    const newFileName = file.name.replace(/\.\w+$/, '') + '_compressed.jpg';
    const compressedFile = new File([blob], newFileName, { 
      type: 'image/jpeg',
      lastModified: Date.now()
    });

    const elapsed = Date.now() - startTime;
    console.log('[ImageUtils] 처리 완료:', {
      original: formatFileSize(file.size),
      compressed: formatFileSize(compressedFile.size),
      reduction: Math.round((1 - compressedFile.size / file.size) * 100) + '%',
      newSize: `${newWidth}x${newHeight}`,
      elapsed: `${elapsed}ms`
    });

    return compressedFile;

  } catch (error) {
    console.error('[ImageUtils] 처리 중 예외 - 원본 사용:', error);
    return file;
  }
}

// ============================================================================
// 미리보기 URL 생성
// ============================================================================

/**
 * 안전한 미리보기 URL 생성
 */
export async function createSafePreviewUrl(file: File): Promise<string> {
  console.log('[ImageUtils] 미리보기 생성:', file.name);
  
  try {
    // 항상 ObjectURL 사용 (가장 안정적)
    return URL.createObjectURL(file);
  } catch (error) {
    console.error('[ImageUtils] ObjectURL 생성 실패:', error);
    
    // fallback: FileReader 사용
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = () => reject(new Error('미리보기 생성 실패'));
      reader.readAsDataURL(file);
    });
  }
}

/**
 * 미리보기 URL 해제
 */
export function revokePreviewUrl(url: string): void {
  try {
    if (url && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  } catch {
    // 무시
  }
}

// ============================================================================
// 유틸리티
// ============================================================================

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getStatusMessage(status: ProcessingStatus): string {
  switch (status) {
    case 'idle': return '';
    case 'reading': return '📖 사진 확인 중...';
    case 'resizing': return '📐 이미지 준비 중...';
    case 'compressing': return '🗜️ 압축 중...';
    case 'uploading': return '⬆️ 업로드 중...';
    case 'retrying': return '🔄 재시도 중...';
    case 'done': return '✅ 완료!';
    case 'error': return '❌ 오류 발생';
    default: return '';
  }
}

// ============================================================================
// 재시도 로직
// ============================================================================

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries?: number; delay?: number; onRetry?: (attempt: number) => void } = {}
): Promise<T> {
  const { maxRetries = 2, delay = 1000, onRetry } = options;
  
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        onRetry?.(attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.log(`[ImageUtils] 시도 ${attempt + 1}/${maxRetries + 1} 실패:`, lastError.message);
      
      if (attempt >= maxRetries) throw lastError;
    }
  }
  
  throw lastError || new Error('알 수 없는 오류');
}
