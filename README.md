# Slack Clone

실시간 팀 메신저 서비스 — Spring Boot + Next.js 풀스택 포트폴리오 프로젝트

## 주요 기능

- JWT 기반 인증 (Access Token + Refresh Token 자동 갱신)
- 워크스페이스 / 채널 생성 및 멤버 관리
- WebSocket(STOMP + SockJS) 실시간 채팅
- AWS S3 Presigned URL 파일 첨부 (이미지·문서, 드래그&드롭)
- PWA 지원 (오프라인 캐싱)

---

## 기술 스택

| 영역 | 기술 |
|---|---|
| Frontend | Next.js 14 App Router, TypeScript strict, Tailwind CSS, shadcn/ui |
| 상태 관리 | Zustand, TanStack Query v5 |
| 실시간 | Socket.io Client, STOMP over SockJS |
| Backend | Spring Boot 3.3, Java 17, Gradle |
| 보안 | Spring Security, JWT (jjwt 0.12.6) |
| 데이터베이스 | PostgreSQL 16 (JPA + QueryDSL 5.1), Flyway 마이그레이션 |
| 캐시 | Redis 7 (RefreshToken 저장) |
| 파일 스토리지 | AWS S3 SDK v2, Presigned PUT URL |
| 인프라 | Docker, Docker Compose |

---

## 프로젝트 구조

```
slack-clone/
├── backend/                   # Spring Boot 3
│   ├── src/main/java/com/slackclone/
│   │   ├── auth/              # 인증 (로그인·회원가입·토큰 갱신)
│   │   ├── channel/           # 채널 CRUD
│   │   ├── config/            # Security, WebSocket, S3, Redis 설정
│   │   ├── domain/            # JPA 엔티티 + 리포지토리
│   │   ├── file/              # S3 파일 업로드 (Presigned URL)
│   │   ├── message/           # 메시지 REST + WebSocket
│   │   ├── user/              # 유저 프로필
│   │   └── workspace/         # 워크스페이스 CRUD
│   └── src/main/resources/
│       ├── application.yml
│       └── db/migration/      # Flyway SQL
│
├── frontend/                  # Next.js 14 App Router
│   ├── app/                   # 페이지 (auth, workspace)
│   ├── components/            # UI 컴포넌트
│   │   └── chat/              # ChatArea, FileUploadDropzone
│   ├── hooks/                 # useSocket, useWebSocket, useFileUpload
│   ├── lib/api.ts             # Axios 인스턴스 + API 함수
│   ├── store/                 # Zustand 스토어
│   └── types/                 # 공유 타입 정의
│
├── .env.example               # 환경변수 예시 (→ .env 로 복사해서 사용)
├── docker-compose.yml
└── README.md
```

---

## 빠른 시작

### 사전 요구사항

| 도구 | 버전 |
|---|---|
| Docker | 24+ |
| Docker Compose | v2+ |
| (로컬 개발) Node.js | 18+ |
| (로컬 개발) Java | 17+ |

### Docker Compose로 전체 실행 (권장)

```bash
# 1. 저장소 클론
git clone https://github.com/your-username/slack-clone.git
cd slack-clone

# 2. 환경변수 파일 생성 후 값 수정
cp .env.example .env
# .env 파일을 열어 DB 패스워드, JWT 시크릿, AWS 키 등을 설정하세요.

# 3. 전체 서비스 빌드 & 실행
docker-compose up --build -d

# 4. 로그 확인
docker-compose logs -f

# 5. 서비스 종료
docker-compose down
```

| 서비스 | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8080 |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |

---

### 로컬 개발 환경 (핫 리로드)

#### 1. 인프라만 Docker로 실행

```bash
docker-compose up postgres redis -d
```

#### 2. 백엔드 실행

```bash
cd backend
# application.yml 의 환경변수는 IDE Run Configuration 또는 터미널에서 주입
export AWS_ACCESS_KEY=... AWS_SECRET_KEY=... S3_BUCKET_NAME=...
./gradlew bootRun
```

#### 3. 프론트엔드 실행

```bash
cd frontend
cp .env.example .env.local
# .env.local 에서 NEXT_PUBLIC_API_URL=http://localhost:8080 확인
npm install
npm run dev
```

---

## 환경변수 설명

| 변수 | 설명 | 예시 |
|---|---|---|
| `POSTGRES_DB` | DB 이름 | `slackclone` |
| `POSTGRES_USER` | DB 사용자 | `slackclone` |
| `POSTGRES_PASSWORD` | DB 패스워드 | 강력한 패스워드 |
| `REDIS_PASSWORD` | Redis 인증 (선택) | 빈 값이면 비인증 |
| `JWT_SECRET` | JWT 서명 키 (256비트+) | 랜덤 문자열 |
| `JWT_EXPIRATION` | Access Token 만료 (ms) | `900000` (15분) |
| `JWT_REFRESH_EXPIRATION` | Refresh Token 만료 (ms) | `604800000` (7일) |
| `AWS_ACCESS_KEY` | AWS IAM Access Key ID | — |
| `AWS_SECRET_KEY` | AWS IAM Secret Access Key | — |
| `S3_BUCKET_NAME` | S3 버킷 이름 | — |
| `NEXT_PUBLIC_API_URL` | 프론트 → 백엔드 API 주소 | `http://backend:8080` |
| `NEXT_PUBLIC_SOCKET_URL` | WebSocket 서버 주소 | `http://backend:8080` |

> S3 버킷은 **ap-northeast-2(서울)** 리전에 생성하고, CORS 정책에서 `PUT` 메서드를 허용해야 합니다.

---

## API 엔드포인트

| Method | 경로 | 설명 |
|---|---|---|
| POST | `/api/auth/signup` | 회원가입 |
| POST | `/api/auth/login` | 로그인 |
| POST | `/api/auth/refresh` | 토큰 갱신 |
| POST | `/api/auth/logout` | 로그아웃 |
| GET | `/api/users/me` | 내 프로필 |
| GET/POST | `/api/workspaces` | 워크스페이스 목록 / 생성 |
| GET/POST | `/api/workspaces/:id/channels` | 채널 목록 / 생성 |
| GET | `/api/workspaces/:id/channels/:cid/messages` | 메시지 커서 페이지네이션 |
| POST | `/api/files/upload` | S3 Presigned URL 발급 + 첨부 메타 저장 |
| WS | `/ws` (STOMP) | 실시간 메시지 |

---

## 브랜치 전략

```
main        ← 프로덕션 배포 브랜치 (PR 머지만 허용, 직접 push 금지)
 └─ develop ← 통합 개발 브랜치 (기능 완성 후 main 으로 PR)
     ├─ feat/auth-login
     ├─ feat/s3-upload
     ├─ fix/websocket-reconnect
     └─ chore/docker-setup
```

| 브랜치 패턴 | 용도 |
|---|---|
| `feat/*` | 신규 기능 개발 |
| `fix/*` | 버그 수정 |
| `refactor/*` | 코드 리팩터링 (기능 변경 없음) |
| `chore/*` | 빌드·설정·의존성 변경 |
| `docs/*` | 문서 수정 |

커밋 메시지는 [Conventional Commits](https://www.conventionalcommits.org/) 형식을 따릅니다.

```
feat(file): S3 presigned URL 파일 업로드 기능 추가
fix(auth): 토큰 만료 시 무한 리프레시 루프 수정
chore(docker): 멀티스테이지 Dockerfile 최적화
```

---

## 라이선스

MIT
