/**
 * 시험 결과 제출 컴포넌트 (학생용)
 * - 시험 사진 최대 5장 업로드
 * - 수동 점수 입력 (관리자 승인 필요)
 */

import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { supabase, uploadTestImage } from '@/lib/supabase';
import { 
  validateImageFile, 
  createSafePreviewUrl,
  revokePreviewUrl,
  getStatusMessage,
  checkNetworkBeforeUpload,
  formatFileSize,
  getDeviceInfo,
  resizeAndCompressImage,
  isAndroid,
  type ProcessingStatus 
} from '@/lib/imageUtils';
import { getTodayString } from '@/lib/dateUtils';

interface TestSubmissionProps {
  userId: string;
  onSubmitted: () => void;
}

interface SelectedImage {
  file: File;
  previewUrl: string;
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
        <span className="font-medium">📷 사진 미리보기</span>
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
          className="px-6 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600"
        >
          🔄 다시 선택하기
        </button>
      </div>
    </div>
  );
}

export default function TestSubmission({ userId, onSubmitted }: TestSubmissionProps) {
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [manualScore, setManualScore] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');  // 업로드 진행 상황
  
  // 사진 뷰어 상태
  const [viewingPhotoIndex, setViewingPhotoIndex] = useState<number | null>(null);
  const [reuploadIndex, setReuploadIndex] = useState<number | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reuploadInputRef = useRef<HTMLInputElement>(null);
  
  const MAX_IMAGES = 5;

  /**
   * 파일 선택 핸들러 - PC/모바일 모두 지원
   */
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('[TestSubmission] 파일 선택 이벤트 발생');
    
    const files = e.target.files;

    if (!files || files.length === 0) {
      console.log('[TestSubmission] 파일 없음');
      // input 초기화
      if (e.target) e.target.value = '';
      return;
    }

    console.log(`[TestSubmission] ${files.length}개 파일 선택됨`);

    // 파일을 먼저 배열로 복사 (input 초기화 전에!)
    const fileArray = Array.from(files);
    
    // input 초기화 (같은 파일 재선택 가능하게) - 파일 복사 후에 해야 함!
    if (e.target) {
      e.target.value = '';
    }

    // 최대 개수 체크
    const remainingSlots = MAX_IMAGES - selectedImages.length;
    if (remainingSlots <= 0) {
      setErrorMessage(`최대 ${MAX_IMAGES}장까지만 업로드 가능합니다.`);
      return;
    }

    setErrorMessage(null);
    const filesToAdd = fileArray.slice(0, remainingSlots);
    const newImages: SelectedImage[] = [];

    for (const file of filesToAdd) {
      console.log('[TestSubmission] 파일 처리:', file.name, file.type, file.size);
      
      // 유효성 검사 (느슨하게)
      const validation = validateImageFile(file);
      if (!validation.valid) {
        console.warn('[TestSubmission] 유효성 실패:', validation.error);
        setErrorMessage(validation.error || '파일을 선택할 수 없습니다.');
        continue;
      }

      try {
        const previewUrl = await createSafePreviewUrl(file);
        console.log('[TestSubmission] 미리보기 생성 성공');
        newImages.push({ file, previewUrl });
      } catch (error) {
        console.error('[TestSubmission] 미리보기 생성 실패:', error);
        // 미리보기 실패해도 파일은 추가
        newImages.push({ file, previewUrl: '' });
      }
    }

    if (newImages.length > 0) {
      setSelectedImages(prev => [...prev, ...newImages]);
      console.log(`[TestSubmission] ${newImages.length}개 이미지 추가 완료`);
    }
  };

  /**
   * 이미지 제거
   */
  const removeImage = (index: number) => {
    setSelectedImages(prev => {
      const newImages = [...prev];
      const removed = newImages.splice(index, 1)[0];
      if (removed?.previewUrl) {
        revokePreviewUrl(removed.previewUrl);
      }
      return newImages;
    });
  };

  /**
   * 재업로드 핸들러
   */
  const handleReupload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = '';
    
    if (!file || reuploadIndex === null) return;
    
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setErrorMessage(validation.error || '파일을 선택할 수 없습니다.');
      return;
    }
    
    try {
      const previewUrl = await createSafePreviewUrl(file);
      setSelectedImages(prev => {
        const newImages = [...prev];
        // 기존 미리보기 URL 해제
        if (newImages[reuploadIndex]?.previewUrl) {
          revokePreviewUrl(newImages[reuploadIndex].previewUrl);
        }
        newImages[reuploadIndex] = { file, previewUrl };
        return newImages;
      });
      setViewingPhotoIndex(null);
      setReuploadIndex(null);
    } catch (error) {
      console.error('[TestSubmission] 재업로드 미리보기 생성 실패:', error);
    }
  };

  /**
   * 제출 핸들러
   */
  const handleSubmit = async () => {
    // 사진은 필수
    if (selectedImages.length === 0) {
      setErrorMessage('시험 사진을 업로드해주세요.');
      return;
    }

    // 점수 유효성 검사 (입력한 경우만)
    const score = manualScore ? parseFloat(manualScore) : null;
    if (score !== null && (isNaN(score) || score < 0 || score > 100)) {
      setErrorMessage('점수는 0~100 사이의 숫자여야 합니다.');
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
    setUploadProgress('');

    try {
      const todayStr = getTodayString();
      const uploadedUrls: string[] = [];
      const isAndroidDevice = isAndroid();

      // 1) 이미지 업로드 - Android 최적화
      if (selectedImages.length > 0) {
        console.log(`[TestSubmission] 총 ${selectedImages.length}장 업로드 시작 (Android: ${isAndroidDevice})`);
        
        for (let i = 0; i < selectedImages.length; i++) {
          const img = selectedImages[i];
          const progressText = `${i + 1}/${selectedImages.length}장`;
          setUploadProgress(progressText);
          setProcessingStatus(i === 0 ? 'resizing' : 'uploading');
          console.log(`[TestSubmission] 이미지 ${i + 1}/${selectedImages.length} 처리 시작 (${formatFileSize(img.file.size)})`);
          
          // 이미지 처리 - Android에서는 더 공격적으로 압축
          let fileToUpload = img.file;
          try {
            // Android: 500KB 이상이면 압축, PC: 1MB 이상이면 압축
            const compressThreshold = isAndroidDevice ? 500 * 1024 : 1 * 1024 * 1024;
            const shouldCompress = img.file.size > compressThreshold;
            
            if (shouldCompress) {
              setUploadProgress(`${progressText} 압축 중...`);
              console.log(`[TestSubmission] 이미지 ${i + 1} 압축 중... (${formatFileSize(img.file.size)})`);
              fileToUpload = await resizeAndCompressImage(img.file, {
                maxSize: isAndroidDevice ? 1000 : 1200,  // Android: 더 작게
                quality: isAndroidDevice ? 0.5 : 0.6,    // Android: 더 낮은 품질
                timeout: 10000,  // 타임아웃 줄임
                skipIfSmall: true  // 이미 작으면 스킵
              });
              console.log(`[TestSubmission] 압축 완료: ${formatFileSize(fileToUpload.size)}`);
            } else {
              console.log(`[TestSubmission] 이미지 ${i + 1} 압축 스킵 (이미 작음)`);
            }
          } catch (compressError) {
            console.log('[TestSubmission] 이미지 처리 스킵, 원본 사용:', compressError);
            // 압축 실패해도 원본으로 진행
          }
          
          // 업로드
          setUploadProgress(`${progressText} 업로드 중...`);
          setProcessingStatus('uploading');
          console.log(`[TestSubmission] 이미지 ${i + 1} 업로드 시작...`);
          const url = await uploadTestImage(userId, fileToUpload);
          uploadedUrls.push(url);
          console.log(`[TestSubmission] 이미지 ${i + 1} 업로드 완료!`);
          
          // 메모리 정리를 위한 짧은 대기 (Android)
          if (isAndroidDevice && i < selectedImages.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
        
        setUploadProgress('저장 중...');
        console.log(`[TestSubmission] 모든 이미지 업로드 완료: ${uploadedUrls.length}장`);
      }

      // 2) 시험 결과 저장 (승인 대기 상태)
      const { error } = await supabase
        .from('test_results')
        .upsert({
          user_id: userId,
          test_date: todayStr,
          score: score ?? 0,
          is_approved: false,           // 관리자 승인 대기
          is_pass: false,               // 승인 후 결정
          reward_amount: 0,             // 승인 후 결정
          test_photo_url: uploadedUrls[0] || null,
          test_photo_urls: uploadedUrls, // 여러 장 저장
          manual_score_input: score !== null,  // 수동 입력 여부
        } as any, { onConflict: 'user_id,test_date' });

      if (error) throw error;

      setProcessingStatus('done');
      setSubmitted(true);
      
      // 초기화
      selectedImages.forEach(img => revokePreviewUrl(img.previewUrl));
      setSelectedImages([]);
      setManualScore('');
      setUploadProgress('');
      
      onSubmitted();

    } catch (error) {
      setProcessingStatus('error');
      console.error('[TestSubmission] 제출 실패:', error);
      
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('제출에 실패했습니다. 다시 시도해주세요.');
      }
    } finally {
      setIsUploading(false);
      setUploadProgress('');
      setTimeout(() => setProcessingStatus('idle'), 2000);
    }
  };

  const isBusy = isUploading || (processingStatus !== 'idle' && processingStatus !== 'done' && processingStatus !== 'error');

  if (submitted) {
    return (
      <div className="card text-center py-8 bg-blue-50">
        <p className="text-4xl mb-2">📝</p>
        <p className="text-blue-700 font-medium">시험 결과 제출 완료!</p>
        <p className="text-sm text-blue-600 mt-1">
          관리자 승인 후 점수가 반영됩니다.
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="text-lg font-bold text-gray-800 mb-4">
        📝 시험 결과 제출
      </h2>

      {/* 에러 메시지 */}
      {errorMessage && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          ⚠️ {errorMessage}
        </div>
      )}

      {/* 사진 업로드 영역 */}
      <div className="mb-4">
        <label className="block text-sm text-gray-600 mb-2">
          📷 시험 결과 사진 (최대 {MAX_IMAGES}장)
        </label>
        
        {/* 선택된 이미지 미리보기 */}
        {selectedImages.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-3">
            {selectedImages.map((img, index) => (
              <div key={index} className="relative">
                <img
                  src={img.previewUrl}
                  alt={`시험 사진 ${index + 1}`}
                  className="w-full h-24 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => setViewingPhotoIndex(index)}
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeImage(index);
                  }}
                  className="absolute top-1 right-1 w-6 h-6 bg-black/50 text-white rounded-full text-sm hover:bg-black/70"
                >
                  ✕
                </button>
                <div className="absolute bottom-1 left-1 text-xs bg-black/50 text-white px-1 rounded">
                  클릭하여 확대
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 추가 버튼 */}
        {selectedImages.length < MAX_IMAGES && (
          <button
            type="button"
            onClick={() => {
              console.log('[TestSubmission] 버튼 클릭됨');
              console.log('[TestSubmission] fileInputRef:', fileInputRef.current);
              fileInputRef.current?.click();
            }}
            className="w-full h-20 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all active:bg-blue-100"
          >
            <span className="text-2xl">➕</span>
            <p className="text-gray-600 text-sm">
              사진 추가 ({selectedImages.length}/{MAX_IMAGES})
            </p>
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        
        {/* 재업로드용 input */}
        <input
          ref={reuploadInputRef}
          type="file"
          accept="image/*"
          onChange={handleReupload}
          className="hidden"
        />
      </div>
      
      {/* 사진 뷰어 모달 */}
      {viewingPhotoIndex !== null && selectedImages[viewingPhotoIndex] && (
        <PhotoViewer
          url={selectedImages[viewingPhotoIndex].previewUrl}
          onClose={() => setViewingPhotoIndex(null)}
          onReupload={() => {
            setReuploadIndex(viewingPhotoIndex);
            reuploadInputRef.current?.click();
          }}
        />
      )}

      {/* 수동 점수 입력 */}
      <div className="mb-4">
        <label className="block text-sm text-gray-600 mb-2">
          ✏️ 점수 직접 입력 (선택사항)
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={manualScore}
            onChange={(e) => setManualScore(e.target.value)}
            placeholder="예: 85.5"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <span className="text-gray-500">점</span>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          * 수동 입력한 점수는 관리자 승인 후 반영됩니다.
        </p>
      </div>

      {/* 안내 */}
      <div className="mb-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
        <p className="font-medium mb-1">📌 시험 보너스 안내</p>
        <p>지난주보다 0.1점 이상 오르면 <strong>+500원</strong> 추가!</p>
      </div>

      {/* 제출 버튼 */}
      <motion.button
        whileHover={{ scale: !isBusy && selectedImages.length > 0 ? 1.02 : 1 }}
        whileTap={{ scale: !isBusy && selectedImages.length > 0 ? 0.98 : 1 }}
        onClick={handleSubmit}
        disabled={isBusy || selectedImages.length === 0}
        className={`btn w-full flex items-center justify-center gap-2 ${
          !isBusy && selectedImages.length > 0
            ? 'bg-blue-500 hover:bg-blue-600 text-white'
            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
        }`}
      >
        {isBusy ? (
          <>
            <div className="spinner w-5 h-5" />
            <span>{uploadProgress || getStatusMessage(processingStatus) || '처리 중...'}</span>
          </>
        ) : (
          <span>📤 시험 결과 제출 {selectedImages.length > 0 && `(${selectedImages.length}장)`}</span>
        )}
      </motion.button>
    </div>
  );
}
