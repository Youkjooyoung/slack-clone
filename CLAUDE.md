# Slack Clone — 실시간 팀 메신저 서비스

Spring Boot + Next.js 풀스택 실시간 팀 메신저 (Slack 클론)
포트폴리오 프로젝트 | MIT License

---

## 프로젝트 버전 정보

| 항목 | 실제 버전 |
|------|-----------|
| Java | 21 (build.gradle toolchain) |
| Spring Boot | 3.4.5 (Gradle) |
| Next.js | 16.2 (App Router) |
| TypeScript | strict mode |
| PostgreSQL | 16 |
| Redis | 7 (alpine) |
| Flyway | Spring Boot BOM 관리 |
| jjwt | 0.12.6 |
| QueryDSL | 5.1.0 (Jakarta) |
| AWS S3 SDK | 2.25.60 |
| Tailwind CSS | 3.4 |
| Zustand | 4 |
| @tanstack/react-query | 5 |

---

## Tech Stack

**Backend**
- Java 21, Spring Boot 3.4.5 (Gradle)
- Spring Data JPA + Hibernate + QueryDSL 5.1 (PostgreSQL 16, `ddl-auto: validate`)
- Spring Data Redis 7 (Refresh Token 저장, 읽지 않은 메시지 추적)
- Spring Security + JWT (jjwt 0.12.6, Stateless)
- WebSocket/STOMP + SockJS (실시간 메시징)
- Spring Validation (Bean Validation)
- Flyway (DB 마이그레이션 V1~V3)
- AWS S3 (Presigned URL 파일 업로드) + 로컬 폴백
- Jsoup 1.17.2 (OG 메타 스크래핑)
- Lombok

**Frontend**
- Next.js 16.2 (App Router, TypeScript strict)
- Tailwind CSS 3.4 + CSS Modules + shadcn/ui (Radix primitives)
- Zustand 4 (7개 Store: auth, chat, workspace, layout, notification, presence, unread)
- @tanstack/react-query 5 (서버 상태)
- Axios (JWT 자동 갱신 인터셉터)
- @stomp/stompjs + sockjs-client (STOMP 실시간 메시징)
- react-hook-form + zod (폼 검증)
- sonner (토스트)
- lucide-react (아이콘)
- next-pwa (PWA)
- class-variance-authority + clsx + tailwind-merge (shadcn 패턴)

**Infra**
- Docker Compose (PostgreSQL 16 + Redis 7 + Backend + Frontend)
- Multi-stage Docker (JDK 21 → JRE 21 / Node 20 → Next.js standalone)
- Network: `slack-clone-network` (bridge)

---

## Project Structure

**Backend**
```
backend/src/main/java/com/slackclone/
├── auth/             # 인증 (controller + service + DTOs: login, signup, token refresh)
├── channel/          # 채널 관리 (controller + service + DTOs)
├── message/          # 메시지 (REST + @MessageMapping STOMP)
├── dm/               # 다이렉트 메시지 (controller + service + DTOs)
├── workspace/        # 워크스페이스 (controller + service + DTOs)
├── file/             # 파일 업로드 (S3 presigned URL + 로컬 폴백)
├── notification/     # 알림 (controller + service)
├── reaction/         # 리액션 (controller + service)
├── og/               # OpenGraph 메타 스크래핑
├── presence/         # 접속 상태 (service + DTO)
├── user/             # 사용자 프로필 (controller + service)
├── config/           # SecurityConfig, WebSocketConfig, S3Config, RedisConfig, JpaConfig
├── common/           # ApiResponse<T>, BusinessException, ErrorCode, JwtUtil, SecurityUtil
└── domain/           # JPA 엔티티 + Repository (user, workspace, channel, message, attachment, notification, reaction)

backend/src/main/resources/
├── application.yml
└── db/migration/     # Flyway V1~V3
```

**Frontend**
```
frontend/
├── app/              # Next.js App Router
│   ├── page.tsx                          # 랜딩 페이지
│   ├── layout.tsx                        # 루트 레이아웃
│   ├── auth/login/page.tsx               # 로그인
│   ├── auth/register/page.tsx            # 회원가입
│   ├── workspace/page.tsx                # 워크스페이스 목록
│   ├── workspace/[id]/layout.tsx         # 워크스페이스 레이아웃 (Sidebar)
│   ├── workspace/[id]/channel/[channelId]/page.tsx   # 채널 채팅
│   └── workspace/[id]/dm/[userId]/page.tsx           # DM
├── components/
│   ├── auth/         # LoginForm, RegisterForm
│   ├── chat/         # ChatArea, FileUploadDropzone, LinkPreview, ThreadPanel
│   ├── dm/           # DmArea
│   ├── landing/      # AnimatedChat
│   ├── notifications/# NotificationBell
│   ├── workspace/    # Sidebar, panels/ (Activity, Files, Home, More)
│   ├── ui/           # shadcn/ui 프리미티브
│   └── providers.tsx # React Query + 전역 프로바이더
├── hooks/            # useWebSocket, useDmWebSocket, useFileUpload, useMention, useNotifications
├── lib/
│   └── api.ts        # Axios 인스턴스 + 도메인별 API 함수 (authApi, userApi, channelApi, messageApi, dmApi, fileApi, ...)
├── store/            # Zustand: authStore, chatStore, workspaceStore, layoutStore, notificationStore, presenceStore, unreadStore
├── types/
│   └── index.ts      # 공유 TypeScript 인터페이스
└── middleware.ts      # Next.js 인증 미들웨어 (auth-storage 쿠키 체크)
```

---

## Server Info

| 서비스 | 개발 포트 |
|--------|-----------|
| Frontend (Next.js) | 3000 |
| Backend | 8080 |
| PostgreSQL | 5432 |
| Redis | 6379 |

---

## Commands

```bash
# 전체 스택 (Docker)
docker compose up -d --build

# 백엔드 개발
cd backend && ./gradlew bootRun

# 프론트엔드 개발
cd frontend && npm install && npm run dev

# 백엔드 테스트
cd backend && ./gradlew test

# 프론트엔드 빌드
cd frontend && npm run build
```

---

## 코딩 컨벤션

### 공통 규칙

- **주석 금지**: 코드에 주석을 작성하지 않는다
- **에러 메시지 언어**: 한국어
- **커밋 컨벤션**: Conventional Commits + 스코프
  ```
  feat(file): S3 presigned URL 파일 업로드
  fix(auth): 토큰 갱신 시 쿠키 동기화 버그 수정
  refactor(message): QueryDSL 쿼리 최적화
  ```

### 백엔드 규칙

#### 패키지 구조 — 도메인별 모듈 분리
```
auth/        → controller/ + service/ + dto/
channel/     → controller/ + service/ + dto/
message/     → controller/ + service/ + dto/
dm/          → controller/ + service/ + dto/
workspace/   → controller/ + service/ + dto/
file/        → controller/ + service/
...
common/      → ApiResponse, BusinessException, ErrorCode, JwtUtil
domain/      → JPA 엔티티 + Repository (도메인별 하위 패키지)
config/      → Spring 설정
```

#### DI 패턴
- `@RequiredArgsConstructor` + `private final` 필드 (전체 일관)

#### Controller 패턴
- `@RestController` + `@RequestMapping("/api/...")` + `@RequiredArgsConstructor`
- 모든 응답: `ResponseEntity<ApiResponse<T>>` 래핑
  ```java
  return ResponseEntity.ok(ApiResponse.success(data));
  return ResponseEntity.ok(ApiResponse.error("에러 메시지"));
  ```
- WebSocket: `@MessageMapping`으로 STOMP 메시지 수신

#### DTO 패턴
- **Java record** 사용
  ```java
  public record SendMessageRequest(String content, String type) {}
  public record EditMessageRequest(String content) {}
  ```

#### Entity 패턴
- 모든 엔티티 `BaseEntity` 상속 (UUID PK, `createdAt`, `updatedAt`, `deletedAt`)
- **Soft Delete**: `@SQLRestriction("deleted_at IS NULL")` 전역 적용
- Lombok: `@Builder`, `@Getter`, `@RequiredArgsConstructor`
  ```java
  @Entity @Table(name = "messages")
  @Getter @Builder @RequiredArgsConstructor @AllArgsConstructor
  @SQLRestriction("deleted_at IS NULL")
  public class Message extends BaseEntity { ... }
  ```

#### 에러 처리
- **커스텀 예외 체계**: `BusinessException` + `ErrorCode` enum
  ```java
  throw new BusinessException(ErrorCode.CHANNEL_NOT_FOUND);
  throw new BusinessException(ErrorCode.UNAUTHORIZED);
  ```
- `GlobalExceptionHandler` (`@RestControllerAdvice`)에서 `ApiResponse.error()` 반환

#### 응답 형식 통일
```json
{ "success": true, "message": null, "data": { ... } }
{ "success": false, "message": "채널을 찾을 수 없습니다.", "data": null }
```

#### DB
- Flyway 마이그레이션 (V1: init, V2: S3 attachment, V3: relax constraint)
- `ddl-auto: validate` (Flyway가 스키마 관리)
- QueryDSL 5.1 (복잡 쿼리)
- Redis 7 (Refresh Token + 읽지 않은 메시지 추적)

### 프론트엔드 규칙

#### 컴포넌트 구조
- Next.js App Router: `'use client'` 지시어 (인터랙티브 컴포넌트)
- `.tsx` 확장자 (TypeScript strict)
- 페이지는 얇게: TanStack Query로 데이터 패칭, 기능 컴포넌트에 위임

#### 스타일링
- **Tailwind CSS** 인라인 + **CSS Modules** (`.module.css`, 스코프 스타일)
- **shadcn/ui** (Radix 프리미티브): `ui/` 디렉토리
- `class-variance-authority` + `clsx` + `tailwind-merge` (shadcn 패턴)
  ```tsx
  import { cn } from '@/lib/utils';
  <div className={cn('base-class', isActive && 'active-class')} />
  ```

#### 상태 관리
- **Zustand** (클라이언트 상태): 7개 Store
  - `authStore`: 쿠키 persist (`cookieStorage` 어댑터)
  - `chatStore`, `workspaceStore`, `layoutStore`, `notificationStore`, `presenceStore`, `unreadStore`
- **TanStack React Query** (서버 상태): `useQuery`, `useInfiniteQuery`, `useMutation`
- 분리 기준: 서버 데이터 → React Query, UI/클라이언트 상태 → Zustand

#### API 호출
- `lib/api.ts`에 중앙 Axios 인스턴스 + 도메인별 API 함수 그룹
  ```typescript
  export const messageApi = {
    getMessages: (channelId: string, cursor?: string) => api.get(...),
    sendMessage: (channelId: string, data: SendMessageRequest) => api.post(...),
  };
  ```
- JWT 자동 갱신 인터셉터 (401 → refresh → 재시도)
- 인증 토큰: 쿠키 기반 (`auth-storage`)

#### 폼 검증
- `react-hook-form` + `zod` 스키마 검증
  ```typescript
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
  });
  ```

#### WebSocket
- `useWebSocket` / `useDmWebSocket` 커스텀 훅
- STOMP: `@stomp/stompjs` + `sockjs-client`
- `SimpMessagingTemplate`으로 서버 → 클라이언트 푸시

#### 라우팅 (App Router)
- 인증 불필요: `/`, `/auth/login`, `/auth/register`
- 인증 필요: `/workspace/**` (Next.js middleware에서 쿠키 체크 → 리다이렉트)
- 동적 라우트: `[id]`, `[channelId]`, `[userId]`
- 레이아웃: `workspace/[id]/layout.tsx` (Sidebar 셸)

#### 타입 관리
- `types/index.ts`에 모든 도메인 타입 중앙 관리
  ```typescript
  export interface Message { id: string; content: string; ... }
  export interface Channel { id: string; name: string; ... }
  ```

### 파일/변수 네이밍

| 대상 | 규칙 | 예시 |
|------|------|------|
| 페이지 (App Router) | `page.tsx` / `layout.tsx` | `workspace/[id]/channel/[channelId]/page.tsx` |
| 컴포넌트 | PascalCase.tsx | `ChatArea.tsx`, `LoginForm.tsx` |
| 훅 | camelCase + `use` 접두어 | `useWebSocket.ts`, `useFileUpload.ts` |
| Store | camelCase + `Store` | `authStore.ts`, `chatStore.ts` |
| API 모듈 | camelCase | `api.ts` (통합) |
| 타입 | PascalCase (interface) | `Message`, `Channel`, `Workspace` |
| Java 클래스 | PascalCase + 역할 접미사 | `MessageController`, `AuthService` |
| Java record | PascalCase + Request/Response | `SendMessageRequest` |
| DB 테이블 | lower_snake_case (복수형) | `messages`, `channel_members` |
| CSS Module | PascalCase.module.css | `ChatArea.module.css` |
| shadcn/ui | kebab-case | `ui/button.tsx`, `ui/dialog.tsx` |

### 환경변수

- **Backend** (`application.yml`): 환경변수 외부화 (`${DB_HOST:localhost}`, `${JWT_SECRET}`)
- **Frontend**: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SOCKET_URL`
- **Docker**: `.env` 파일로 주입 (DB, Redis, JWT, AWS S3, 포트)

---

## DB Schema (Flyway V1 기준)

```sql
USERS           -- id(UUID), email, password, display_name, avatar_url, status_message, is_online, last_seen_at
WORKSPACES      -- id(UUID), name, description, owner_id(FK)
WORKSPACE_MEMBERS -- id(UUID), workspace_id(FK), user_id(FK), role(OWNER/ADMIN/MEMBER)
CHANNELS        -- id(UUID), workspace_id(FK), name, description, is_private, created_by(FK)
CHANNEL_MEMBERS -- id(UUID), channel_id(FK), user_id(FK), last_read_at
MESSAGES        -- id(UUID), channel_id(FK), user_id(FK), content, parent_id(FK, 스레드)
DIRECT_MESSAGES -- id(UUID), workspace_id(FK), sender_id(FK), receiver_id(FK), content
ATTACHMENTS     -- id(UUID), message_id(FK)/dm_id(FK), filename, s3_key, content_type, size
REACTIONS       -- id(UUID), message_id(FK)/dm_id(FK), user_id(FK), emoji
NOTIFICATIONS   -- id(UUID), user_id(FK), type, content, is_read, reference_id

모든 테이블: created_at, updated_at, deleted_at (Soft Delete)
```

---

## Git Workflow

```
main        # 운영 배포 (PR merge only)
develop     # 개발 통합
feat/*      # 기능 개발
fix/*       # 버그 수정
refactor/*  # 리팩토링
chore/*     # 설정/잡무
docs/*      # 문서
```

**커밋 컨벤션 (Conventional Commits + 스코프)**
```
feat(message): 스레드 답글 기능 구현
feat(file): S3 presigned URL 파일 업로드
fix(auth): 토큰 갱신 시 쿠키 동기화 버그 수정
refactor(channel): QueryDSL 쿼리 최적화
chore(docker): Redis 볼륨 설정 추가
docs: API 엔드포인트 문서 업데이트
```
