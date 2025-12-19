import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '@/styles/globals.css';

// 모바일 디버그 콘솔 (우측 하단 vConsole 버튼 클릭하면 로그 확인 가능)
import VConsole from 'vconsole';
const vConsole = new VConsole({ theme: 'dark' });
console.log('[Debug] vConsole 활성화됨 - 우측 하단 버튼 클릭');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
