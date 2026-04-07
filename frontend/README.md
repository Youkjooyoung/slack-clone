# Frontend - Slack Clone

Next.js 14 App Router 기반 프론트엔드

## 기술 스택

| 기술 | 버전 | 용도 |
|------|------|------|
| Next.js | 14 | 프레임워크 (App Router) |
| TypeScript | 5 | 타입 안전성 (strict mode) |
| Tailwind CSS | 3 | 스타일링 |
| shadcn/ui | - | UI 컴포넌트 |
| Zustand | 4 | 클라이언트 상태관리 |
| TanStack Query | 5 | 서버 상태관리 |
| Socket.io Client | 4 | 실시간 통신 |
| next-pwa | 5 | PWA 지원 |

## 프로젝트 구조

```
frontend/
├── app/                  App Router 페이지
│   ├── layout.tsx        루트 레이아웃
│   ├── page.tsx          홈 페이지
│   └── globals.css       전역 스타일
├── components/
│   ├── ui/               shadcn/ui 컴포넌트
│   └── providers.tsx     QueryClient Provider
├── hooks/
│   └── useSocket.ts      Socket.io 훅
├── lib/
│   └── utils.ts          유틸리티 함수 (cn)
├── store/
│   └── useAuthStore.ts   Zustand 인증 스토어
├── public/
│   └── manifest.json     PWA 매니페스트
├── components.json       shadcn/ui 설정
├── tailwind.config.ts    Tailwind 설정
└── next.config.js        Next.js + PWA 설정
```

## 시작하기

```bash
# 의존성 설치
npm install

# 개발 서버 실행 (http://localhost:3000)
npm run dev

# 프로덕션 빌드
npm run build
npm start

# 린트
npm run lint

# 포맷
npm run format
```

## 환경 변수

`.env.example`을 복사하여 `.env.local` 생성:

```bash
cp .env.example .env.local
```

| 변수 | 기본값 | 설명 |
|------|--------|------|
| NEXT_PUBLIC_API_URL | http://localhost:8080 | 백엔드 API URL |
| NEXT_PUBLIC_SOCKET_URL | http://localhost:8080 | WebSocket 서버 URL |

## shadcn/ui 컴포넌트 추가

```bash
npx shadcn@latest add <component-name>
```
