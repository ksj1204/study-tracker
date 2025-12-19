import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore, useAuth } from '@/stores/authStore';

// 페이지
import LoginPage from '@/pages/LoginPage';
import StudentDashboard from '@/pages/student/Dashboard';
import AdminDashboard from '@/pages/admin/Dashboard';

// 로딩 컴포넌트
function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-chick-50">
      <div className="text-center">
        <div className="text-6xl animate-bounce-gentle mb-4">🐣</div>
        <p className="text-gray-500">로딩 중...</p>
      </div>
    </div>
  );
}

// 인증 필요한 라우트 보호
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isInitialized } = useAuth();
  
  if (!isInitialized) {
    return <LoadingScreen />;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

// 이미 로그인했으면 리다이렉트
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isInitialized } = useAuth();
  
  if (!isInitialized) {
    return <LoadingScreen />;
  }
  
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}

// 역할 기반 라우팅
function RoleBasedRedirect() {
  const { profile, isInitialized } = useAuth();
  
  if (!isInitialized) {
    return <LoadingScreen />;
  }
  
  // 역할에 따라 다른 대시보드로 이동
  if (profile?.role === 'admin') {
    return <AdminDashboard />;
  }
  
  return <StudentDashboard />;
}

function App() {
  const initialize = useAuthStore(state => state.initialize);
  
  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <BrowserRouter>
      <Routes>
        {/* 공개 라우트 */}
        <Route 
          path="/login" 
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          } 
        />
        
        {/* 보호된 라우트 */}
        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <RoleBasedRedirect />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/student/*" 
          element={
            <ProtectedRoute>
              <StudentDashboard />
            </ProtectedRoute>
          } 
        />
        
        {/* 관리자 라우트 */}
        <Route 
          path="/admin/*" 
          element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          } 
        />
        
        {/* 404 - 홈으로 리다이렉트 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
