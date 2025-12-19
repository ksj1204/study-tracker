/**
 * 모바일 디버그 패널
 * 화면에서 직접 로그를 확인할 수 있음
 */

import { useState, useEffect } from 'react';
import { getDeviceInfo, isAndroid, isIOS, isMobile } from '@/lib/imageUtils';

interface LogEntry {
  time: string;
  type: 'info' | 'warn' | 'error' | 'success';
  message: string;
}

// 전역 로그 저장소
const logs: LogEntry[] = [];
const listeners: Set<() => void> = new Set();

// 전역 로그 함수
export function debugLog(type: LogEntry['type'], message: string) {
  const time = new Date().toLocaleTimeString('ko-KR', { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit',
    hour12: false 
  });
  
  logs.unshift({ time, type, message });
  
  // 최대 100개만 유지
  if (logs.length > 100) {
    logs.pop();
  }
  
  // 리스너들에게 알림
  listeners.forEach(fn => fn());
  
  // 콘솔에도 출력
  const consoleFn = type === 'error' ? console.error : 
                    type === 'warn' ? console.warn : console.log;
  consoleFn(`[${time}] ${message}`);
}

// 초기 디바이스 정보 로깅
export function logDeviceInfo() {
  debugLog('info', `=== 디바이스 정보 ===`);
  debugLog('info', `디바이스: ${getDeviceInfo()}`);
  debugLog('info', `Android: ${isAndroid()}`);
  debugLog('info', `iOS: ${isIOS()}`);
  debugLog('info', `Mobile: ${isMobile()}`);
  debugLog('info', `User Agent: ${navigator.userAgent.substring(0, 100)}...`);
  debugLog('info', `Online: ${navigator.onLine}`);
}

export default function DebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [, setUpdate] = useState(0);
  
  useEffect(() => {
    // 로그 업데이트 구독
    const listener = () => setUpdate(n => n + 1);
    listeners.add(listener);
    
    // 초기 디바이스 정보
    if (logs.length === 0) {
      logDeviceInfo();
    }
    
    return () => {
      listeners.delete(listener);
    };
  }, []);
  
  const getTypeColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'error': return 'text-red-400';
      case 'warn': return 'text-yellow-400';
      case 'success': return 'text-green-400';
      default: return 'text-gray-300';
    }
  };
  
  const getTypeIcon = (type: LogEntry['type']) => {
    switch (type) {
      case 'error': return '❌';
      case 'warn': return '⚠️';
      case 'success': return '✅';
      default: return '📝';
    }
  };

  return (
    <>
      {/* 토글 버튼 - 항상 표시 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 left-4 z-[9999] w-12 h-12 rounded-full bg-gray-800 text-white shadow-lg flex items-center justify-center text-xl"
        style={{ touchAction: 'manipulation' }}
      >
        {isOpen ? '✕' : '🐛'}
      </button>
      
      {/* 로그 패널 */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-[9998] bg-black/95 flex flex-col"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {/* 헤더 */}
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <div>
              <h2 className="text-white font-bold text-lg">🐛 디버그 로그</h2>
              <p className="text-gray-400 text-sm">{getDeviceInfo()}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  logs.length = 0;
                  logDeviceInfo();
                  setUpdate(n => n + 1);
                }}
                className="px-3 py-1 bg-gray-700 text-white rounded text-sm"
              >
                초기화
              </button>
              <button
                onClick={() => {
                  const text = logs.map(l => `[${l.time}] ${l.type}: ${l.message}`).join('\n');
                  navigator.clipboard?.writeText(text).then(() => {
                    debugLog('success', '로그 복사됨');
                  }).catch(() => {
                    debugLog('error', '복사 실패');
                  });
                }}
                className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
              >
                복사
              </button>
            </div>
          </div>
          
          {/* 로그 목록 */}
          <div className="flex-1 overflow-auto p-2">
            {logs.length === 0 ? (
              <p className="text-gray-500 text-center p-4">로그가 없습니다</p>
            ) : (
              <div className="space-y-1 font-mono text-xs">
                {logs.map((log, i) => (
                  <div 
                    key={i} 
                    className={`p-2 rounded bg-gray-900 ${getTypeColor(log.type)}`}
                  >
                    <span className="text-gray-500">{log.time}</span>
                    {' '}
                    <span>{getTypeIcon(log.type)}</span>
                    {' '}
                    <span className="break-all">{log.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* 테스트 버튼들 */}
          <div className="p-4 border-t border-gray-700 space-y-2">
            <p className="text-gray-400 text-sm mb-2">테스트:</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  debugLog('info', '파일 input 테스트 시작');
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*';
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) {
                      debugLog('success', `파일 선택됨: ${file.name}`);
                      debugLog('info', `타입: ${file.type || '(없음)'}`);
                      debugLog('info', `크기: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
                    } else {
                      debugLog('warn', '파일 선택 취소됨');
                    }
                  };
                  input.click();
                }}
                className="px-3 py-2 bg-purple-600 text-white rounded text-sm"
              >
                📁 파일선택 테스트
              </button>
              
              <button
                onClick={async () => {
                  debugLog('info', 'Supabase 연결 테스트...');
                  try {
                    const { supabase } = await import('@/lib/supabase');
                    const { data, error } = await supabase.from('profiles').select('count').limit(1);
                    if (error) {
                      debugLog('error', `Supabase 오류: ${error.message}`);
                    } else {
                      debugLog('success', 'Supabase 연결 OK');
                    }
                  } catch (e) {
                    debugLog('error', `연결 실패: ${e}`);
                  }
                }}
                className="px-3 py-2 bg-green-600 text-white rounded text-sm"
              >
                🔌 DB 연결 테스트
              </button>
              
              <button
                onClick={async () => {
                  debugLog('info', 'Storage 연결 테스트...');
                  try {
                    const { supabase } = await import('@/lib/supabase');
                    const { data, error } = await supabase.storage.from('study-images').list('', { limit: 1 });
                    if (error) {
                      debugLog('error', `Storage 오류: ${error.message}`);
                    } else {
                      debugLog('success', 'Storage 연결 OK');
                    }
                  } catch (e) {
                    debugLog('error', `연결 실패: ${e}`);
                  }
                }}
                className="px-3 py-2 bg-orange-600 text-white rounded text-sm"
              >
                📦 Storage 테스트
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
