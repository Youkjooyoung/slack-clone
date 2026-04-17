# API 문서

> 실제 `Controller`와 `Flyway V1__init.sql` 기반으로 생성. 인증 스킴은 `Authorization: Bearer <accessToken>` (refresh는 body).

## 공통 규약

### 응답 포맷
```json
{
  "success": true,
  "message": "채널이 생성되었습니다.",
  "data": { /* 응답 DTO */ }
}
```
에러 응답:
```json
{
  "success": false,
  "message": "유효하지 않은 토큰입니다.",
  "errorCode": "INVALID_TOKEN",
  "data": null
}
```

### 인증
- `/api/auth/*` 및 `GET /api/og` 일부를 제외한 모든 엔드포인트는 JWT 인증 필요.
- 헤더: `Authorization: Bearer <accessToken>`
- 401 응답 시 프론트 Axios 인터셉터가 `/api/auth/refresh`를 자동 호출 후 재시도 (`frontend/lib/api.ts`).

---

## 1. 인증 (Auth) — `/api/auth`

### `POST /api/auth/signup`
회원가입 + 즉시 로그인 (토큰 발급).

**Request**
```json
{
  "email": "user@example.com",
  "password": "Password!234",
  "username": "holden"
}
```

**Response 201**
```json
{
  "success": true,
  "message": "회원가입이 완료되었습니다.",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiJ9...",
    "tokenType": "Bearer"
  }
}
```

**curl**
```bash
curl -X POST http://localhost:8080/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"Password!234","username":"holden"}'
```

### `POST /api/auth/login`
이메일/비밀번호 로그인.

**Request** `LoginRequest { email, password }`
**Response 200** `TokenResponse` 동일.

### `POST /api/auth/refresh`
Refresh Token으로 Access Token 재발급.

**Request**
```json
{ "refreshToken": "eyJhbGciOiJIUzI1NiJ9..." }
```

### `POST /api/auth/logout`
Access Token을 Redis 블랙리스트에 등록 + Refresh Token 폐기.

**헤더**: `Authorization: Bearer <accessToken>` 필수.

---

## 2. 유저 (User) — `/api/users`

### `GET /api/users/me`
현재 로그인 사용자 프로필.

### `PATCH /api/users/me`
프로필 수정 (display_name, avatar_url, status_message, status_emoji).

---

## 3. 워크스페이스 (Workspace) — `/api/workspaces`

| Method | 경로 | 설명 |
|---|---|---|
| POST | `/api/workspaces` | 워크스페이스 생성 (생성자가 OWNER 자동 등록) |
| GET | `/api/workspaces` | 내가 속한 워크스페이스 목록 |
| GET | `/api/workspaces/{workspaceId}` | 단건 조회 |
| PUT | `/api/workspaces/{workspaceId}` | 수정 (OWNER만) |
| DELETE | `/api/workspaces/{workspaceId}` | 소프트 삭제 (OWNER만) |
| POST | `/api/workspaces/{workspaceId}/members` | 이메일로 멤버 초대 |
| GET | `/api/workspaces/{workspaceId}/members` | 멤버 목록 |
| DELETE | `/api/workspaces/{workspaceId}/members/{userId}` | 멤버 제거 |
| GET | `/api/workspaces/{workspaceId}/presence` | **온라인 유저 ID Set** (Redis 기반) |

---

## 4. 채널 (Channel) — `/api/workspaces/{workspaceId}/channels`

| Method | 경로 | 설명 |
|---|---|---|
| POST | `/` | 채널 생성 |
| GET | `/` | 채널 목록 |
| GET | `/{channelId}` | 단건 조회 |
| PUT | `/{channelId}` | 수정 |
| DELETE | `/{channelId}` | 소프트 삭제 |
| POST | `/{channelId}/members` | 채널 참여 (본인) |
| GET | `/{channelId}/members` | 멤버 목록 |
| DELETE | `/{channelId}/members/me` | 채널 나가기 |

---

## 5. 메시지 (Message) — `/api`

REST:

| Method | 경로 | 설명 |
|---|---|---|
| GET | `/api/workspaces/{wsId}/channels/{chId}/messages?cursor=` | **커서 기반 페이지네이션** (과거로 스크롤) |
| PUT | `/api/messages/{messageId}` | 메시지 수정 (본인만) |
| DELETE | `/api/messages/{messageId}` | 소프트 삭제 |
| GET | `/api/workspaces/{wsId}/channels/{chId}/messages/search?q=` | 본문 키워드 검색 |
| GET | `/api/messages/{messageId}/replies` | 스레드 답글 목록 |
| POST | `/api/workspaces/{wsId}/channels/{chId}/read` | 읽음 처리 (last_read_at 업데이트) |
| GET | `/api/workspaces/{wsId}/channels/unread` | 채널별 unread count Map |

WebSocket (STOMP):

| 목적지 | 설명 |
|---|---|
| `/app/channel/{wsId}/{chId}/send` | 메시지 전송 (body: `SendMessageRequest`) |

수신 토픽:

| 토픽 | 페이로드 |
|---|---|
| `/topic/channel/{channelId}` | 신규 메시지 (`MessageResponse`) |
| `/topic/channel/{channelId}/update` | 수정된 메시지 |
| `/topic/channel/{channelId}/delete` | 삭제된 메시지 ID (string) |
| `/user/queue/unread` | 본인 앞 unread count 증가 이벤트 |
| `/user/queue/notifications` | 멘션 알림 (NotificationResponse) |

---

## 6. DM — `/api`

REST:

| Method | 경로 | 설명 |
|---|---|---|
| GET | `/api/workspaces/{wsId}/dm/{targetUserId}/messages?cursor=` | DM 페이지네이션 |
| PUT | `/api/dm/{dmId}` | DM 수정 |
| DELETE | `/api/dm/{dmId}` | DM 삭제 |

WebSocket (STOMP):

| 목적지 | 설명 |
|---|---|
| `/app/dm/{wsId}/{receiverId}/send` | DM 전송 (body: `SendDmRequest`) |

수신 토픽 (pair = 두 유저 ID를 정렬해 결합):

| 토픽 | 페이로드 |
|---|---|
| `/topic/dm/{wsId}/{pair}` | 신규 DM |
| `/topic/dm/{wsId}/{pair}/update` | 수정 |
| `/topic/dm/{wsId}/{pair}/delete` | 삭제된 DM ID |

---

## 7. 리액션 (Reaction) — `/api`

| Method | 경로 | 설명 |
|---|---|---|
| GET | `/api/messages/{messageId}/reactions` | 메시지의 리액션 목록 |
| POST | `/api/messages/{messageId}/reactions` | 리액션 추가 (body: `{ "emoji": "👍" }`) |
| DELETE | `/api/messages/{messageId}/reactions/{emoji}` | 본인 리액션 제거 |
| POST | `/api/dm/{dmId}/reactions` | DM에 리액션 추가 |
| DELETE | `/api/dm/{dmId}/reactions/{emoji}` | DM 리액션 제거 |

WebSocket 브로드캐스트:

| 토픽 | 용도 |
|---|---|
| `/topic/channel/{channelId}/reactions` | add 이벤트 |
| `/topic/channel/{channelId}/reactions/remove` | remove 이벤트 |
| `/topic/dm/{wsId}/{pair}/reactions` | DM add |
| `/topic/dm/{wsId}/{pair}/reactions/remove` | DM remove |

**중복 방지**: DB 레벨 파셜 유니크 인덱스 `uq_reactions_message_active` (`WHERE deleted_at IS NULL`). 동시 전송 시 `DataIntegrityViolationException` → `REACTION_ALREADY_EXISTS` 변환.

---

## 8. 파일 (File) — `/api/files`

| Method | 경로 | 설명 |
|---|---|---|
| POST | `/upload` | S3 Presigned URL 발급 (`FileUploadRequest`) |
| POST | `/upload/local` | **로컬 업로드** (multipart/form-data) |
| GET | `/serve/{userId}/{fileName}` | 로컬 파일 서빙 (Path Traversal 검증 포함) |
| GET | `/my` | 내가 업로드한 파일 목록 |

**보안**: `/serve` 엔드포인트는 `userId`를 UUID로 강제 파싱 + `fileName`의 `..`/슬래시 차단 + `Path.normalize().startsWith(baseDir)` 경계 검사.

---

## 9. 알림 (Notification) — `/api/notifications`

| Method | 경로 | 설명 |
|---|---|---|
| GET | `/` | 내 알림 목록 |
| GET | `/unread-count` | 안읽은 알림 수 `{ "count": N }` |
| PATCH | `/{notificationId}/read` | 단건 읽음 |
| PATCH | `/read-all` | 전체 읽음 |

Type: `MENTION` / `CHANNEL_MESSAGE` / `DIRECT_MESSAGE` / `REACTION` / `SYSTEM`.

---

## 10. OG 메타 (Open Graph) — `/api/og`

### `GET /api/og?url=https://example.com`
외부 URL의 OG 메타태그(title, description, image)를 추출해 반환. 링크 프리뷰 카드에 사용.

**Response 204**: 메타 없음.
**Response 200**: `OgMetaResponse`.

---

## 주요 에러 코드 (ErrorCode enum)

| 코드 | HTTP | 설명 |
|---|---|---|
| `INVALID_TOKEN` | 401 | JWT 형식 오류 또는 서명 불일치 |
| `TOKEN_EXPIRED` | 401 | 만료 |
| `USER_NOT_FOUND` | 404 | |
| `EMAIL_ALREADY_EXISTS` | 409 | 회원가입 중복 |
| `INVALID_CREDENTIALS` | 401 | 로그인 실패 |
| `WORKSPACE_NOT_FOUND` / `CHANNEL_NOT_FOUND` / `MESSAGE_NOT_FOUND` | 404 | |
| `FORBIDDEN` | 403 | 권한 부족 (본인/OWNER 체크) |
| `REACTION_ALREADY_EXISTS` | 409 | 동일 유저가 같은 이모지 중복 등록 시도 |
| `FILE_TOO_LARGE` / `UNSUPPORTED_FILE_TYPE` | 400 | 업로드 검증 실패 |
| `INTERNAL_SERVER_ERROR` | 500 | 분류 안 된 예외 |

---

## STOMP 연결 절차 (프론트)

```typescript
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'

const client = new Client({
  webSocketFactory: () => new SockJS('http://localhost:8080/ws'),
  connectHeaders: { Authorization: `Bearer ${accessToken}` },
  reconnectDelay: 5000,
})
client.onConnect = () => {
  client.subscribe(`/topic/channel/${channelId}`, (msg) => {
    const body = JSON.parse(msg.body)
    // store에 addMessage(body)
  })
}
client.activate()
```

**서버측 검증**: `WebSocketAuthChannelInterceptor`가 CONNECT/SEND/SUBSCRIBE 단계마다 JWT 재검증. 파싱 실패 시 `MessageDeliveryException` 즉시 throw (fall-through 금지).
