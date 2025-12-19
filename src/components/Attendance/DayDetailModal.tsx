// ============================================================================
// 날짜 상세 모달 (학생/관리자 공용)
// ============================================================================
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatKoreanDate, isStudyDay, isTestDay, isRestDay, toDateString, checkIsToday } from '@/lib/dateUtils';
import { supabase, uploadStudyImage, uploadTestImage } from '@/lib/supabase';
import { validateImageFile, createSafePreviewUrl, revokePreviewUrl, resizeAndCompressImage, isAndroid } from '@/lib/imageUtils';
import type { StudySession, TestResult } from '@/types/database';

interface DayDetailModalProps {
  date: Date;
  session: StudySession | null;
  testResult?: TestResult | null;
  isAdmin: boolean;
  userId: string;
  studentName?: string;
  onClose: () => void;
  onUpdate: () => void;
}

// 사진 뷰어 컴포넌트
function PhotoViewer({ 
  urls, 
  initialIndex = 0,
  title,
  onClose 
}: { 
  urls: string[]; 
  initialIndex?: number;
  title: string;
  onClose: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  
  const goNext = () => setCurrentIndex((prev) => (prev + 1) % urls.length);
  const goPrev = () => setCurrentIndex((prev) => (prev - 1 + urls.length) % urls.length);

  return (
    <div 
      className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60]"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative w-full h-full flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex justify-between items-center p-4 text-white">
          <span className="font-medium">{title} ({currentIndex + 1}/{urls.length})</span>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-xl"
          >
            ✕
          </button>
        </div>

        {/* 이미지 */}
        <div className="flex-1 flex items-center justify-center p-4 relative">
          {/* 이전 버튼 */}
          {urls.length > 1 && (
            <button
              onClick={goPrev}
              className="absolute left-2 w-12 h-12 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white text-2xl z-10"
            >
              ‹
            </button>
          )}
          
          <img
            src={urls[currentIndex]}
            alt={`사진 ${currentIndex + 1}`}
            className="max-w-full max-h-full object-contain"
          />
          
          {/* 다음 버튼 */}
          {urls.length > 1 && (
            <button
              onClick={goNext}
              className="absolute right-2 w-12 h-12 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white text-2xl z-10"
            >
              ›
            </button>
          )}
        </div>

        {/* 인디케이터 */}
        {urls.length > 1 && (
          <div className="flex justify-center gap-2 p-4">
            {urls.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                className={`w-3 h-3 rounded-full transition-colors ${
                  i === currentIndex ? 'bg-white' : 'bg-white/40'
                }`}
              />
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default function DayDetailModal({
  date,
  session,
  testResult,
  isAdmin,
  userId,
  studentName,
  onClose,
  onUpdate
}: DayDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedPresent, setEditedPresent] = useState(session?.is_present ?? false);
  const [editReason, setEditReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // 학생 사진 수정 상태
  const [isEditingStudyPhoto, setIsEditingStudyPhoto] = useState(false);
  const [isEditingTest, setIsEditingTest] = useState(false);
  const [newStudyPhotoPreview, setNewStudyPhotoPreview] = useState<string | null>(null);
  const [newStudyPhotoFile, setNewStudyPhotoFile] = useState<File | null>(null);
  const [newTestPhotoPreviews, setNewTestPhotoPreviews] = useState<string[]>([]);
  const [newTestPhotoFiles, setNewTestPhotoFiles] = useState<File[]>([]);
  const [newTestScore, setNewTestScore] = useState(testResult?.score?.toString() || '');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  
  const studyPhotoInputRef = useRef<HTMLInputElement>(null);
  const testPhotoInputRef = useRef<HTMLInputElement>(null);
  
  // 사진 뷰어 상태
  const [photoViewer, setPhotoViewer] = useState<{
    urls: string[];
    initialIndex: number;
    title: string;
  } | null>(null);

  const dateStr = toDateString(date);
  const isToday = checkIsToday(date);
  const isRest = isRestDay(date);
  const isTest = isTestDay(date);
  const isStudy = isStudyDay(date);
  
  // 본인 기록인지 확인
  const isOwnRecord = !isAdmin;

  // 출석 사진 선택 핸들러
  const handleStudyPhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = '';
    if (!file) return;
    
    const validation = validateImageFile(file);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }
    
    try {
      const previewUrl = await createSafePreviewUrl(file);
      if (newStudyPhotoPreview) revokePreviewUrl(newStudyPhotoPreview);
      setNewStudyPhotoPreview(previewUrl);
      setNewStudyPhotoFile(file);
    } catch (error) {
      console.error('미리보기 생성 실패:', error);
    }
  };

  // 시험 사진 선택 핸들러
  const handleTestPhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (e.target) e.target.value = '';
    if (!files || files.length === 0) return;
    
    const fileArray = Array.from(files);
    const MAX_TEST_PHOTOS = 5;
    const remainingSlots = MAX_TEST_PHOTOS - newTestPhotoFiles.length;
    
    if (remainingSlots <= 0) {
      alert(`최대 ${MAX_TEST_PHOTOS}장까지만 업로드 가능합니다.`);
      return;
    }
    
    const filesToAdd = fileArray.slice(0, remainingSlots);
    
    for (const file of filesToAdd) {
      const validation = validateImageFile(file);
      if (!validation.valid) continue;
      
      try {
        const previewUrl = await createSafePreviewUrl(file);
        setNewTestPhotoPreviews(prev => [...prev, previewUrl]);
        setNewTestPhotoFiles(prev => [...prev, file]);
      } catch (error) {
        console.error('미리보기 생성 실패:', error);
      }
    }
  };

  // 시험 사진 제거
  const removeTestPhoto = (index: number) => {
    setNewTestPhotoPreviews(prev => {
      const newPreviews = [...prev];
      revokePreviewUrl(newPreviews[index]);
      newPreviews.splice(index, 1);
      return newPreviews;
    });
    setNewTestPhotoFiles(prev => {
      const newFiles = [...prev];
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  // 출석 사진 수정 저장
  const handleSaveStudyPhoto = async () => {
    if (!newStudyPhotoFile || !session) return;
    
    setIsUploadingPhoto(true);
    try {
      // 이미지 처리 - Android도 2MB 이상이면 압축
      let fileToUpload = newStudyPhotoFile;
      try {
        const shouldCompress = !isAndroid() || newStudyPhotoFile.size > 1 * 1024 * 1024;
        if (shouldCompress) {
          console.log('[DayDetailModal] 출석 사진 압축 중...');
          fileToUpload = await resizeAndCompressImage(newStudyPhotoFile, {
            maxSize: 1200,
            quality: 0.6,
            timeout: 15000
          });
          console.log('[DayDetailModal] 압축 완료:', fileToUpload.size);
        }
      } catch {
        // 처리 실패해도 원본으로 진행
      }
      
      // 업로드
      const photoUrl = await uploadStudyImage(userId, fileToUpload);
      
      // DB 업데이트
      const { error } = await supabase
        .from('study_sessions')
        .update({ study_photo_url: photoUrl })
        .eq('id', session.id);
      
      if (error) throw error;
      
      // 정리
      revokePreviewUrl(newStudyPhotoPreview!);
      setNewStudyPhotoPreview(null);
      setNewStudyPhotoFile(null);
      setIsEditingStudyPhoto(false);
      onUpdate();
      alert('출석 사진이 수정되었습니다!');
    } catch (error) {
      console.error('출석 사진 수정 실패:', error);
      alert('사진 수정에 실패했습니다.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // 시험 수정 저장
  const handleSaveTest = async () => {
    if (!testResult) return;
    
    // 점수 유효성 검사
    const score = newTestScore ? parseFloat(newTestScore) : null;
    if (score !== null && (isNaN(score) || score < 0 || score > 100)) {
      alert('점수는 0~100 사이의 숫자여야 합니다.');
      return;
    }
    
    setIsUploadingPhoto(true);
    try {
      let uploadedUrls: string[] = [];
      
      // 새 사진이 있으면 업로드
      if (newTestPhotoFiles.length > 0) {
        for (const file of newTestPhotoFiles) {
          let fileToUpload = file;
          try {
            const shouldCompress = !isAndroid() || file.size > 1 * 1024 * 1024;
            if (shouldCompress) {
              console.log('[DayDetailModal] 시험 사진 압축 중...');
              fileToUpload = await resizeAndCompressImage(file, {
                maxSize: 1200,
                quality: 0.6,
                timeout: 15000
              });
              console.log('[DayDetailModal] 압축 완료:', fileToUpload.size);
            }
          } catch {
            // 처리 실패해도 원본으로 진행
          }
          
          const url = await uploadTestImage(userId, fileToUpload);
          uploadedUrls.push(url);
        }
      }
      
      // DB 업데이트
      const updateData: any = {};
      
      if (score !== null) {
        updateData.score = score;
        updateData.is_approved = false; // 점수 수정시 다시 승인 필요
        updateData.manual_score_input = true;
      }
      
      if (uploadedUrls.length > 0) {
        updateData.test_photo_url = uploadedUrls[0];
        updateData.test_photo_urls = uploadedUrls;
      }
      
      if (Object.keys(updateData).length > 0) {
        const { error } = await supabase
          .from('test_results')
          .update(updateData)
          .eq('id', testResult.id);
        
        if (error) throw error;
      }
      
      // 정리
      newTestPhotoPreviews.forEach(url => revokePreviewUrl(url));
      setNewTestPhotoPreviews([]);
      setNewTestPhotoFiles([]);
      setIsEditingTest(false);
      onUpdate();
      alert('시험 정보가 수정되었습니다!');
    } catch (error) {
      console.error('시험 수정 실패:', error);
      alert('시험 수정에 실패했습니다.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // 수정 모드 취소
  const cancelStudyPhotoEdit = () => {
    if (newStudyPhotoPreview) revokePreviewUrl(newStudyPhotoPreview);
    setNewStudyPhotoPreview(null);
    setNewStudyPhotoFile(null);
    setIsEditingStudyPhoto(false);
  };

  const cancelTestEdit = () => {
    newTestPhotoPreviews.forEach(url => revokePreviewUrl(url));
    setNewTestPhotoPreviews([]);
    setNewTestPhotoFiles([]);
    setNewTestScore(testResult?.score?.toString() || '');
    setIsEditingTest(false);
  };

  // 관리자 출결 수정
  const handleSaveEdit = async () => {
    if (!isAdmin) return;
    
    setIsSaving(true);
    try {
      if (session) {
        // 기존 세션 업데이트
        const updateData = {
          is_present: editedPresent,
          base_amount: editedPresent ? 500 : 0
        };
        // @ts-expect-error - Supabase 타입 이슈
        const { error } = await supabase.from('study_sessions').update(updateData).eq('id', session.id);

        if (error) throw error;

        // 수정 이력 기록
        const { data: userData } = await supabase.auth.getUser();
        const editData = {
          session_id: session.id,
          user_id: userId,
          study_date: dateStr,
          edited_by: userData.user?.id,
          old_is_present: session.is_present,
          new_is_present: editedPresent,
          edit_reason: editReason
        };
        // @ts-expect-error - 새 테이블
        await supabase.from('attendance_edits').insert(editData);
      } else {
        // 새 세션 생성 (관리자가 직접 생성)
        const { data: newSession, error } = await supabase
          .from('study_sessions')
          .insert({
            user_id: userId,
            study_date: dateStr,
            is_present: editedPresent,
            base_amount: editedPresent ? 500 : 0,
            extra_amount: 0
          } as any)
          .select()
          .single();

        if (error) throw error;

        // 수정 이력 기록
        if (newSession) {
          const { data: userData } = await supabase.auth.getUser();
          await supabase.from('attendance_edits').insert({
            session_id: (newSession as any).id,
            user_id: userId,
            study_date: dateStr,
            edited_by: userData.user?.id,
            old_is_present: null,
            new_is_present: editedPresent,
            edit_reason: editReason || '관리자 직접 등록'
          } as any);
        }
      }

      setIsEditing(false);
      onUpdate();
    } catch (error) {
      console.error('출결 수정 실패:', error);
      alert('출결 수정에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-2xl overflow-hidden max-w-md w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 헤더 */}
          <div className="p-4 bg-gradient-to-r from-chick-100 to-chick-200 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-gray-800">
                📅 {formatKoreanDate(date)}
              </h3>
              {studentName && (
                <p className="text-sm text-gray-600">{studentName} 학생</p>
              )}
            </div>
            <button 
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/50 hover:bg-white transition-colors flex items-center justify-center"
            >
              ✕
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* 요일 타입 배지 */}
            <div className="flex gap-2">
              {isRest && (
                <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">
                  💤 휴무일
                </span>
              )}
              {isTest && (
                <span className="px-3 py-1 bg-blue-100 text-blue-600 rounded-full text-sm">
                  📝 시험일
                </span>
              )}
              {isStudy && (
                <span className="px-3 py-1 bg-green-100 text-green-600 rounded-full text-sm">
                  📚 공부일
                </span>
              )}
              {isToday && (
                <span className="px-3 py-1 bg-chick-100 text-chick-600 rounded-full text-sm">
                  ⭐ 오늘
                </span>
              )}
            </div>

            {/* 휴무일 메시지 */}
            {isRest && (
              <div className="text-center py-8 text-gray-500">
                <p className="text-4xl mb-2">😴</p>
                <p>휴무일이에요!</p>
              </div>
            )}

            {/* 출석 정보 (공부일) */}
            {isStudy && (
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="font-medium text-gray-700 mb-3">📋 출석 정보</h4>
                
                {!isEditing ? (
                  <>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-500">출석 상태</span>
                        <span className={`font-medium ${session?.is_present ? 'text-green-600' : 'text-red-500'}`}>
                          {session?.is_present ? '✅ 출석' : session ? '❌ 결석' : '⬜ 기록 없음'}
                        </span>
                      </div>
                      
                      {session?.start_time && session?.end_time && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">공부 시간</span>
                          <span className="font-medium">
                            {session.start_time.slice(0, 5)} ~ {session.end_time.slice(0, 5)}
                          </span>
                        </div>
                      )}
                      
                      {session?.is_present && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">출석 수당</span>
                          <span className="font-medium text-green-600">
                            +{session.base_amount + session.extra_amount}원
                          </span>
                        </div>
                      )}
                    </div>

                    {/* 공부 인증 사진 */}
                    {session?.study_photo_url && !isEditingStudyPhoto && (
                      <div className="mt-4">
                        <p className="text-sm text-gray-500 mb-2">📸 공부 인증 사진 (클릭하여 확대)</p>
                        <img 
                          src={session.study_photo_url} 
                          alt="공부 인증" 
                          className="w-full rounded-lg max-h-60 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => setPhotoViewer({
                            urls: [session.study_photo_url!],
                            initialIndex: 0,
                            title: '📚 공부 인증 사진'
                          })}
                        />
                        {/* 학생 본인 수정 버튼 */}
                        {isOwnRecord && isToday && (
                          <button
                            onClick={() => setIsEditingStudyPhoto(true)}
                            className="mt-2 w-full py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm"
                          >
                            🔄 사진 수정하기
                          </button>
                        )}
                      </div>
                    )}

                    {/* 출석 사진 수정 모드 */}
                    {isEditingStudyPhoto && (
                      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm text-gray-600 mb-2">📷 새 사진 선택</p>
                        
                        {newStudyPhotoPreview ? (
                          <div className="relative">
                            <img 
                              src={newStudyPhotoPreview} 
                              alt="새 사진" 
                              className="w-full rounded-lg max-h-40 object-cover"
                            />
                            <button
                              onClick={() => {
                                revokePreviewUrl(newStudyPhotoPreview);
                                setNewStudyPhotoPreview(null);
                                setNewStudyPhotoFile(null);
                              }}
                              className="absolute top-1 right-1 w-6 h-6 bg-black/50 text-white rounded-full text-sm"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => studyPhotoInputRef.current?.click()}
                            className="w-full h-24 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center hover:border-blue-400 hover:bg-blue-50"
                          >
                            <span className="text-2xl">📷</span>
                            <span className="text-sm text-gray-500">사진 선택</span>
                          </button>
                        )}
                        
                        <input
                          ref={studyPhotoInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleStudyPhotoSelect}
                          className="hidden"
                        />
                        
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={cancelStudyPhotoEdit}
                            className="flex-1 py-2 bg-gray-200 text-gray-600 rounded-lg text-sm"
                            disabled={isUploadingPhoto}
                          >
                            취소
                          </button>
                          <button
                            onClick={handleSaveStudyPhoto}
                            disabled={!newStudyPhotoFile || isUploadingPhoto}
                            className="flex-1 py-2 bg-blue-500 text-white rounded-lg text-sm disabled:opacity-50"
                          >
                            {isUploadingPhoto ? '업로드 중...' : '저장'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 관리자 수정 버튼 */}
                    {isAdmin && (
                      <button
                        onClick={() => setIsEditing(true)}
                        className="mt-4 w-full py-2 bg-chick-100 text-chick-700 rounded-lg hover:bg-chick-200 transition-colors"
                      >
                        ✏️ 출결 수정
                      </button>
                    )}
                  </>
                ) : (
                  /* 수정 모드 */
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-2">출석 상태</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditedPresent(true)}
                          className={`flex-1 py-2 rounded-lg transition-colors ${
                            editedPresent 
                              ? 'bg-green-500 text-white' 
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          ✅ 출석
                        </button>
                        <button
                          onClick={() => setEditedPresent(false)}
                          className={`flex-1 py-2 rounded-lg transition-colors ${
                            !editedPresent 
                              ? 'bg-red-500 text-white' 
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          ❌ 결석
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-600 mb-2">수정 사유</label>
                      <input
                        type="text"
                        value={editReason}
                        onChange={(e) => setEditReason(e.target.value)}
                        placeholder="수정 사유를 입력하세요"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-chick-400"
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => setIsEditing(false)}
                        className="flex-1 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                        disabled={isSaving}
                      >
                        취소
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        className="flex-1 py-2 bg-chick-500 text-white rounded-lg hover:bg-chick-600 disabled:opacity-50"
                        disabled={isSaving}
                      >
                        {isSaving ? '저장 중...' : '저장'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 시험 정보 (시험일) */}
            {isTest && (
              <div className="bg-blue-50 rounded-xl p-4">
                <h4 className="font-medium text-gray-700 mb-3">📝 시험 정보</h4>
                
                {testResult ? (
                  !isEditingTest ? (
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-500">점수</span>
                        <span className="font-bold text-lg">{testResult.score}점</span>
                      </div>
                      {testResult.prev_score !== null && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">이전 점수</span>
                          <span>{testResult.prev_score}점</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-500">승인 상태</span>
                        <span className={(testResult as any).is_approved ? 'text-green-600' : 'text-yellow-600'}>
                          {(testResult as any).is_approved ? '✅ 승인됨' : '⏳ 승인 대기'}
                        </span>
                      </div>
                      {(testResult as any).is_approved && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-gray-500">결과</span>
                            <span className={testResult.is_pass ? 'text-green-600' : 'text-red-500'}>
                              {testResult.is_pass ? '✅ 합격' : '❌ 불합격'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">시험 수당</span>
                            <span className={`font-medium ${testResult.reward_amount > 0 ? 'text-green-600' : 'text-red-500'}`}>
                              {testResult.reward_amount > 0 ? '+' : ''}{testResult.reward_amount}원
                            </span>
                          </div>
                        </>
                      )}

                      {/* 시험 사진 - 다중 사진 지원 */}
                      {(() => {
                        const photoUrls = (testResult as any).test_photo_urls?.length > 0 
                          ? (testResult as any).test_photo_urls 
                          : testResult.test_photo_url 
                            ? [testResult.test_photo_url]
                            : [];
                        
                        if (photoUrls.length === 0) return null;
                        
                        return (
                          <div className="mt-4">
                            <p className="text-sm text-gray-500 mb-2">
                              📸 시험 사진 {photoUrls.length > 1 ? `(${photoUrls.length}장)` : ''} - 클릭하여 확대
                            </p>
                            <div className={`grid gap-2 ${photoUrls.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                              {photoUrls.map((url: string, index: number) => (
                                <img
                                  key={index}
                                  src={url}
                                  alt={`시험 사진 ${index + 1}`}
                                  className="w-full rounded-lg h-32 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                  onClick={() => setPhotoViewer({
                                    urls: photoUrls,
                                    initialIndex: index,
                                    title: `📝 시험 사진 - ${studentName || '학생'}`
                                  })}
                                />
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      {/* 학생 본인 수정 버튼 */}
                      {isOwnRecord && isToday && !(testResult as any).is_approved && (
                        <button
                          onClick={() => setIsEditingTest(true)}
                          className="mt-3 w-full py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm"
                        >
                          ✏️ 시험 정보 수정하기
                        </button>
                      )}
                    </div>
                  ) : (
                    /* 시험 수정 모드 */
                    <div className="space-y-4">
                      {/* 점수 수정 */}
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">점수</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={newTestScore}
                          onChange={(e) => setNewTestScore(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          placeholder="예: 85.5"
                        />
                      </div>

                      {/* 사진 수정 */}
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">사진 (최대 5장)</label>
                        
                        {newTestPhotoPreviews.length > 0 && (
                          <div className="grid grid-cols-3 gap-2 mb-2">
                            {newTestPhotoPreviews.map((url, index) => (
                              <div key={index} className="relative">
                                <img 
                                  src={url} 
                                  alt={`새 사진 ${index + 1}`}
                                  className="w-full h-20 object-cover rounded-lg"
                                />
                                <button
                                  onClick={() => removeTestPhoto(index)}
                                  className="absolute top-1 right-1 w-5 h-5 bg-black/50 text-white rounded-full text-xs"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {newTestPhotoPreviews.length < 5 && (
                          <button
                            onClick={() => testPhotoInputRef.current?.click()}
                            className="w-full h-16 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center hover:border-blue-400 hover:bg-blue-50"
                          >
                            <span className="text-gray-500 text-sm">
                              ➕ 사진 추가 ({newTestPhotoPreviews.length}/5)
                            </span>
                          </button>
                        )}
                        
                        <input
                          ref={testPhotoInputRef}
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleTestPhotoSelect}
                          className="hidden"
                        />
                      </div>

                      <p className="text-xs text-gray-400">
                        * 점수 수정 시 다시 관리자 승인이 필요합니다.
                      </p>

                      <div className="flex gap-2">
                        <button
                          onClick={cancelTestEdit}
                          className="flex-1 py-2 bg-gray-200 text-gray-600 rounded-lg text-sm"
                          disabled={isUploadingPhoto}
                        >
                          취소
                        </button>
                        <button
                          onClick={handleSaveTest}
                          disabled={isUploadingPhoto}
                          className="flex-1 py-2 bg-blue-500 text-white rounded-lg text-sm disabled:opacity-50"
                        >
                          {isUploadingPhoto ? '저장 중...' : '저장'}
                        </button>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="text-center py-4 text-gray-500">
                    <p>시험 기록이 없습니다.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
      
      {/* 사진 뷰어 모달 */}
      {photoViewer && (
        <PhotoViewer
          urls={photoViewer.urls}
          initialIndex={photoViewer.initialIndex}
          title={photoViewer.title}
          onClose={() => setPhotoViewer(null)}
        />
      )}
    </AnimatePresence>
  );
}
