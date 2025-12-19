/**
 * 출석 버튼 컴포넌트
 * v6 - Android/iOS 완전 호환 버전
 */

import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { uploadStudyImage } from '@/lib/supabase';
import { useAuth } from '@/stores/authStore';
import { 
  resizeAndCompressImage, 
  validateImageFile, 
  createSafePreviewUrl,
  revokePreviewUrl,
  getStatusMessage,
  checkNetworkBeforeUpload,
  isAndroid,
  getDeviceInfo,
  formatFileSize,
  type ProcessingStatus 
} from '@/lib/imageUtils';

interface AttendanceButtonProps {
  onAttendance: (photoUrl: string, startTime: string, endTime: string) => Promise<void>;
  isLoading: boolean;
  disabled?: boolean;
}

// 사진 뷰어 컴포넌트
function PhotoViewer({ 
  url, 
  onClose,
  onReupload
}: { 
  url: string; 
  onClose: () => void;
  onReupload: () => void;
}) {
  return (
    <div 
      className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50"
      onClick={onClose}
    >
      <div className="w-full flex justify-between items-center p-4 text-white">
        <span className="font-medium">📷 공부 인증 사진</span>
        <button 
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-xl"
        >
          ✕
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        <img
          src={url}
          alt="확대 사진"
          className="max-w-full max-h-full object-contain"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
      <div className="p-4">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onReupload();
          }}
          className="px-6 py-3 bg-chick-500 text-white rounded-lg font-medium hover:bg-chick-600"
        >
          🔄 다시 선택하기
        </button>
      </div>
    </div>
  );
}

export default function AttendanceButton({ 
  onAttendance, 
  isLoading, 
  disabled 
}: AttendanceButtonProps) {
  const { profile } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // 사진 뷰어 상태
  const [isViewingPhoto, setIsViewingPhoto] = useState(false);
  
  // 단일 input ref (카메라/갤러리 통합)
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * 파일 선택 핸들러 - 최대한 단순하게
   */
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    
    // input 초기화 (같은 파일 재선택 가능하게)
    if (e.target) {
      e.target.value = '';
    }

    if (!file) {
      console.log('[AttendanceButton] 파일 선택 취소');
      return;
    }

    console.log('[AttendanceButton] 파일 선택됨:', {
      name: file.name,
      type: file.type || '(타입 없음)',
      size: formatFileSize(file.size),
      device: getDeviceInfo()
    });

    setErrorMessage(null);

    // 유효성 검사
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setErrorMessage(validation.error || '파일을 선택할 수 없습니다.');
      return;
    }

    try {
      setProcessingStatus('reading');
      
      // 미리보기 생성 (실패해도 진행)
      let preview: string;
      try {
        preview = await createSafePreviewUrl(file);
      } catch {
        console.warn('[AttendanceButton] 미리보기 생성 실패');
        preview = '';
      }
      
      setPreviewUrl(preview);
      setSelectedFile(file);
      setProcessingStatus('idle');
      
      console.log('[AttendanceButton] 파일 선택 완료');
      
    } catch (error) {
      console.error('[AttendanceButton] 파일 선택 오류:', error);
      setProcessingStatus('error');
      setErrorMessage('사진을 불러올 수 없습니다. 다시 시도해주세요.');
    }
  };

  /**
   * 제출 핸들러 - 견고한 에러 처리
   */
  const handleSubmit = async () => {
    if (!selectedFile || !profile?.id || !startTime || !endTime) {
      return;
    }

    // 네트워크 확인
    const network = checkNetworkBeforeUpload();
    if (!network.ok) {
      setErrorMessage(network.message || '네트워크 오류');
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);
    
    try {
      // 1) 이미지 처리 - Android도 2MB 이상이면 압축
      setProcessingStatus('resizing');
      let fileToUpload = selectedFile;
      
      try {
        const shouldCompress = !isAndroid() || selectedFile.size > 1 * 1024 * 1024;
        if (shouldCompress) {
          console.log('[AttendanceButton] 이미지 압축 시작 (' + (isAndroid() ? 'Android 1MB+' : 'PC') + ')');
          fileToUpload = await resizeAndCompressImage(selectedFile, {
            maxSize: 1200,
            quality: 0.6,
            timeout: 15000,
            skipIfSmall: true
          });
          console.log('[AttendanceButton] 압축 완료:', formatFileSize(fileToUpload.size));
        } else {
          console.log('[AttendanceButton] Android - 이미지 압축 스킵 (1MB 미만)');
        }
      } catch (e) {
        console.log('[AttendanceButton] 이미지 처리 스킵:', e);
        // 처리 실패해도 원본으로 계속 진행
      }
      
      // 2) 이미지 업로드
      setProcessingStatus('uploading');
      console.log('[AttendanceButton] 업로드 시작:', formatFileSize(fileToUpload.size));
      
      const photoUrl = await uploadStudyImage(profile.id, fileToUpload);
      console.log('[AttendanceButton] 업로드 완료');
      
      // 3) 출석 처리
      await onAttendance(photoUrl, startTime, endTime);
      
      setProcessingStatus('done');
      
      // 성공 - 초기화
      clearSelection();
      
    } catch (error) {
      setProcessingStatus('error');
      
      // 상세 에러 로깅
      console.error('[AttendanceButton] 업로드 실패 - 에러 타입:', typeof error);
      console.error('[AttendanceButton] 업로드 실패 - 에러 객체:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
      if (error instanceof Error) {
        console.error('[AttendanceButton] 에러 메시지:', error.message);
        console.error('[AttendanceButton] 에러 스택:', error.stack);
      }
      
      // 사용자 친화적 에러 메시지
      let errorMsg = '업로드에 실패했습니다. 다시 시도해주세요.';
      if (error instanceof Error) {
        if (error.message.includes('timeout') || error.message.includes('시간')) {
          errorMsg = '업로드 시간이 초과되었습니다. 네트워크를 확인하고 다시 시도해주세요.';
        } else if (error.message) {
          errorMsg = error.message;
        }
      } else if (typeof error === 'object' && error !== null) {
        errorMsg = JSON.stringify(error);
      }
      console.error('[AttendanceButton] 최종 에러 메시지:', errorMsg);
      setErrorMessage(errorMsg);
    } finally {
      setIsUploading(false);
      setTimeout(() => setProcessingStatus('idle'), 2000);
    }
  };

  /**
   * 선택 초기화
   */
  const clearSelection = () => {
    if (previewUrl) {
      revokePreviewUrl(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setStartTime('');
    setEndTime('');
    setProcessingStatus('idle');
    setErrorMessage(null);
  };

  const isBusy = isLoading || isUploading || (processingStatus !== 'idle' && processingStatus !== 'done' && processingStatus !== 'error');
  const isFormValid = selectedFile && startTime && endTime;

  return (
    <div className="card">
      <h2 className="text-lg font-bold text-gray-800 mb-4">
        📸 오늘의 출석
      </h2>
      
      {/* 에러 메시지 */}
      {errorMessage && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          ⚠️ {errorMessage}
        </div>
      )}
      
      {/* 사진 업로드 영역 */}
      <div className="mb-4">
        {previewUrl ? (
          <div className="relative">
            <img 
              src={previewUrl} 
              alt="공부 사진 미리보기" 
              className="w-full h-48 object-cover rounded-xl cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => setIsViewingPhoto(true)}
              onError={() => {
                console.warn('[AttendanceButton] 미리보기 로드 실패');
              }}
            />
            <button
              onClick={clearSelection}
              className="absolute top-2 right-2 w-8 h-8 bg-black/50 text-white rounded-full hover:bg-black/70"
            >
              ✕
            </button>
            <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
              클릭하여 크게 보기
            </div>
            {processingStatus !== 'idle' && processingStatus !== 'done' && processingStatus !== 'error' && (
              <div className="absolute bottom-2 left-2 right-2 bg-black/70 text-white text-sm px-3 py-1 rounded-lg">
                {getStatusMessage(processingStatus)}
              </div>
            )}
          </div>
        ) : selectedFile ? (
          // 미리보기 실패해도 파일 선택됨 표시
          <div className="relative bg-gray-100 rounded-xl p-4 text-center">
            <p className="text-gray-600">📷 사진이 선택되었습니다</p>
            <p className="text-sm text-gray-500">{selectedFile.name}</p>
            <button
              onClick={clearSelection}
              className="absolute top-2 right-2 w-8 h-8 bg-black/50 text-white rounded-full hover:bg-black/70"
            >
              ✕
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {/* 통합 버튼 - 사진 선택 */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-32 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-chick-400 hover:bg-chick-50 transition-all active:bg-chick-100"
            >
              <span className="text-3xl mb-1">📷</span>
              <p className="text-gray-600 font-medium">사진 선택하기</p>
              <p className="text-xs text-gray-400">카메라 촬영 또는 갤러리에서 선택</p>
            </button>
          </div>
        )}
        
        {/* 
          단일 input으로 통합 (가장 안정적)
          - Android: capture 속성 없이 사용 (선택 화면에서 카메라/갤러리 모두 접근 가능)
          - iOS: capture 있어도 갤러리 접근 가능
        */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* 시작/종료 시간 입력 */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-gray-600 mb-1">⏰ 시작 시간</label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-chick-400"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">⏰ 종료 시간</label>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-chick-400"
          />
        </div>
      </div>

      {/* 안내 문구 */}
      <p className="text-sm text-gray-500 mb-4">
        ⚠️ 사진과 공부 시간을 모두 입력해야 출석이 인정됩니다!
      </p>

      {/* 출석 버튼 */}
      <motion.button
        whileHover={{ scale: isFormValid && !isBusy ? 1.02 : 1 }}
        whileTap={{ scale: isFormValid && !isBusy ? 0.98 : 1 }}
        onClick={handleSubmit}
        disabled={!isFormValid || isBusy || disabled}
        className={`btn w-full flex items-center justify-center gap-2 ${
          isFormValid && !isBusy 
            ? 'btn-success' 
            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
        }`}
      >
        {isBusy ? (
          <>
            <div className="spinner w-5 h-5" />
            <span>{getStatusMessage(processingStatus) || '처리 중...'}</span>
          </>
        ) : (
          <>
            <span>✅ 출석 완료!</span>
            {isFormValid && <span>(+500원)</span>}
          </>
        )}
      </motion.button>
      
      {/* 사진 뷰어 모달 */}
      {isViewingPhoto && previewUrl && (
        <PhotoViewer
          url={previewUrl}
          onClose={() => setIsViewingPhoto(false)}
          onReupload={() => {
            setIsViewingPhoto(false);
            clearSelection();
            setTimeout(() => fileInputRef.current?.click(), 100);
          }}
        />
      )}
    </div>
  );
}
