# 🐣 병아리 스터디 (Chick Study Tracker)

공부하며 병아리를 키우는 출석 & 수당 관리 시스템

## 🚀 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env.example`을 복사하여 `.env` 파일 생성:

```bash
cp .env.example .env
```

`.env` 파일에 Supabase 정보 입력:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Supabase 설정

1. [Supabase](https://supabase.com)에서 새 프로젝트 생성
2. SQL Editor에서 `supabase/schema.sql` 실행
3. Authentication > Users에서 테스트 계정 생성

### 4. 개발 서버 실행

```bash
npm run dev
```

http://localhost:5173 에서 앱 확인

## 📁 프로젝트 구조

```
src/
├── components/          # 재사용 컴포넌트
│   ├── Attendance/      # 출석 관련
│   └── Character/       # 캐릭터 관련
├── lib/                 # 유틸리티
│   ├── supabase.ts      # Supabase 클라이언트
│   ├── characterUtils.ts # 캐릭터 로직
│   ├── dateUtils.ts     # 날짜 처리
│   └── moneyUtils.ts    # 수당 계산
├── pages/               # 페이지 컴포넌트
│   ├── LoginPage.tsx
│   └── student/
│       └── Dashboard.tsx
├── stores/              # Zustand 상태 관리
│   ├── authStore.ts
│   └── characterStore.ts
├── types/               # TypeScript 타입
│   └── database.ts
└── styles/              # 스타일
    └── globals.css
```

## 🎮 캐릭터 시스템

### 성장 단계 (6단계)
- 🥚 달걀 → 🐣 부화중 → 🐥 아기병아리 → 🐔 성인닭 → ✨🐔 황금닭 → 👑🐔 전설의닭

### 무지개 색상 (7색)
- 🔴빨강 → 🟠주황 → 🟡노랑 → 🟢초록 → 🔵파랑 → 🟣남색 → 💜보라

### 규칙
- **출석**: 색상 1단계 상승, 보라에서 출석하면 캐릭터 승급 + 빨강 리셋
- **결석**: 색상 1단계 강등
- **등급 강등**: 빨간색 + 2일 연속 결석 시 캐릭터 1단계 강등

## 💰 수당 체계

- 평일 출석: 500원/일
- 시험 통과: 1,000원
- 시험 미통과: 500원 (참여 수당)
- 추가 수당: 관리자 지정 (200원 단위)

## 🚀 배포 (Netlify)

1. GitHub에 코드 푸시
2. [Netlify](https://netlify.com)에서 새 사이트 생성
3. GitHub 저장소 연결
4. 빌드 설정:
   - Build command: `npm run build`
   - Publish directory: `dist`
5. 환경 변수 설정 (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)

## 📝 TODO

- [ ] 관리자 대시보드
- [ ] 시험 제출 기능
- [ ] 주간/월간 통계
- [ ] 업적 시스템
- [ ] 알림 기능

## 🛠 기술 스택

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS
- **Animation**: Framer Motion
- **State**: Zustand
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **Deployment**: Netlify
