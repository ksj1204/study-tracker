import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/stores/authStore';
import { motion, AnimatePresence } from 'framer-motion';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const { signIn, isLoading, error, clearError } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    
    try {
      // 이메일 형식 변환
      // 이미 @가 포함되어 있으면 그대로 사용, 없으면 @study.local 추가
      const email = username.includes('@') 
        ? username.trim() 
        : `${username.trim().toLowerCase()}@study.local`;
      
      await signIn(email, password);
      navigate('/');
    } catch {
      // 에러는 store에서 처리
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-chick-100 via-white to-chick-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* 로고 & 타이틀 */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="inline-block text-8xl mb-4"
          >
            🐣
          </motion.div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            병아리 스터디
          </h1>
          <p className="text-gray-500">
            공부하며 병아리를 키워요! 🌱
          </p>
        </div>

        {/* 로그인 카드 */}
        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 아이디 */}
            <div>
              <label 
                htmlFor="username" 
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                아이디
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="아이디를 입력하세요"
                className="input"
                required
                autoComplete="username"
              />
            </div>

            {/* 비밀번호 */}
            <div>
              <label 
                htmlFor="password" 
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                비밀번호
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input pr-12"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* 에러 메시지 */}
            {error && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-3 rounded-lg bg-red-50 text-red-600 text-sm"
              >
                ⚠️ {error}
              </motion.div>
            )}

            {/* 로그인 버튼 */}
            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary w-full flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="spinner w-5 h-5" />
                  <span>로그인 중...</span>
                </>
              ) : (
                <>
                  <span>로그인</span>
                  <span>🚀</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* 하단 정보 */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>
            계정이 없으신가요?{' '}
            <button
              type="button"
              onClick={() => setShowContact(!showContact)}
              className="text-chick-600 font-medium hover:underline"
            >
              관리자에게 문의하세요
            </button>
          </p>
          
          {/* 연락처 정보 */}
          <AnimatePresence>
            {showContact && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 p-4 bg-chick-50 rounded-xl text-gray-700 overflow-hidden"
              >
                <p className="font-medium mb-2">📞 연락처</p>
                <p>전화번호: 010-8911-8350</p>
                <p>이메일: tjrwns0318@naver.com</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
