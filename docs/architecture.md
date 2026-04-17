# 시스템 아키텍처

## 전체 구성도

```mermaid
graph TB
    subgraph Client
        Next[Next.js 16.2<br/>App Router]
        Zustand[Zustand store<br/>실시간 상태]
        TQ[TanStack Query<br/>서버 상태 캐시]
    end

    subgraph Server
        SB[Spring Boot 3.4.5<br/>Java 21]
        JWT[JwtUtil<br/>jjwt 0.12.6]
        STOMP[STOMP Broker<br/>WebSocketConfig]
        Sec[Spring Security<br/>+ ChannelInterceptor]
    end

    subgraph Storage
        PG[(PostgreSQL 16<br/>Flyway V1~V3)]
        RD[(Redis 7<br/>RefreshToken · Presence · BlackList)]
        FS[로컬 파일시스템<br/>uploads/&lt;userId&gt;/&lt;uuid&gt;.ext]
    end

    Next -->|REST + Bearer JWT| SB
    Next -.->|STOMP over SockJS| STOMP
    Next <--> Zustand
    Next <--> TQ
    SB --> Sec
    Sec --> JWT
    SB --> PG
    SB --> RD
    SB --> FS
    STOMP -->|brokerRelay| Next
    SB -->|외부 HTTP fetch<br/>OG 메타| Ext[외부 URL]
```

## 백엔드 패키지 구조 (도메인별)

```mermaid
graph LR
    Controller --> Service
    Service --> Repository
    Repository --> DB[(PostgreSQL)]
    Service --> Messaging[SimpMessagingTemplate]
    Service --> Redis[RedisTemplate]
```

도메인 폴더:
- `auth` · `user` · `workspace` · `channel` · `message` · `dm` · `reaction`
- `file` · `notification` · `presence` · `og`
- `common` (예외, 응답 래퍼, 유틸) · `config` (WebSocket, Security, Redis)

각 도메인 내부:
```
<domain>/
├── controller/     REST 엔드포인트 / STOMP @MessageMapping
├── service/        트랜잭션 + 비즈니스 로직
├── repository/     JpaRepository + QueryDSL
├── dto/            Request / Response (Java record 우선)
└── entity/         JPA @Entity (soft delete 필드 공통)
```

---

## 시퀀스: 로그인 + Refresh 흐름

```mermaid
sequenceDiagram
    participant C as 브라우저
    participant Ax as Axios 인터셉터
    participant AC as AuthController
    participant AS as AuthService
    participant UR as UserRepository
    participant JU as JwtUtil
    participant RD as Redis

    C->>AC: POST /api/auth/login { email, password }
    AC->>AS: login(request)
    AS->>UR: findByEmail(email)
    UR-->>AS: User
    AS->>AS: BCrypt.matches(raw, hash)
    AS->>JU: generateAccessToken + RefreshToken
    AS->>RD: set refresh:<userId> = refreshToken (TTL 7d)
    AS-->>AC: TokenResponse
    AC-->>C: 200 + 토큰 (쿠키 저장)

    Note over C,Ax: (이후) 만료된 AccessToken으로 API 호출
    C->>Ax: GET /api/users/me
    Ax-->>C: 401 Unauthorized
    Ax->>AC: POST /api/auth/refresh { refreshToken }
    AC->>AS: refresh(request)
    AS->>RD: get refresh:<userId>
    AS->>JU: validate refreshToken
    AS->>JU: generate new AccessToken
    AS-->>Ax: 새 TokenResponse
    Ax->>C: 원본 요청 재시도 (새 토큰)
```

**실패 경로**: Refresh도 만료/조작 시 `forceLogout()` — Zustand clearAuth + 쿠키 삭제 + `/`로 리다이렉트 (stale UI 방지).

---

## 시퀀스: 채널 메시지 전송 (WebSocket)

```mermaid
sequenceDiagram
    participant Sender as Sender (브라우저)
    participant WSI as WebSocketAuthChannelInterceptor
    participant MC as MessageController
    participant MS as MessageService
    participant MR as MessageRepository
    participant SMT as SimpMessagingTemplate
    participant Sub as Subscribers

    Sender->>WSI: STOMP CONNECT + Authorization 헤더
    WSI->>WSI: jwtUtil.parseToken() → 실패 시 MessageDeliveryException
    WSI-->>Sender: CONNECTED

    Sender->>WSI: SEND /app/channel/{wsId}/{chId}/send
    WSI->>WSI: requireAuthenticated() (재검증)
    WSI->>MC: @MessageMapping
    MC->>MS: sendMessage(wsId, chId, request, principal)
    MS->>MR: save(Message)
    MS->>SMT: convertAndSend("/topic/channel/{chId}", response)
    SMT-->>Sub: 구독자 일괄 전달
    MS->>MS: 멘션 추출 → NotificationService.notify()
    MS->>SMT: convertAndSendToUser(멘션당사자, "/queue/notifications", ...)
```

**클라이언트 머지 정책** (`ChatArea.tsx`):
- 첫 페이지 로드 → `setMessages(chId, pages[0])` + 스크롤 하단
- 추가 페이지(과거) → `prependMessages(chId, diff)` + 스크롤 위치 유지
- WS 수신 → `addMessage(chId, msg)` (페이지네이션과 독립)
- `processedPagesRef`로 이미 머지한 페이지 수 추적 → 중복 머지/덮어쓰기 방지

---

## 시퀀스: 리액션 추가 (동시성 방어)

```mermaid
sequenceDiagram
    participant A as 유저 A
    participant B as 유저 B
    participant RC as ReactionController
    participant RS as ReactionService
    participant PG as PostgreSQL
    participant SMT as SimpMessagingTemplate

    par 동시 요청
        A->>RC: POST /api/messages/{id}/reactions { "👍" }
        RC->>RS: addToMessage(id, "👍")
    and
        B->>RC: POST /api/messages/{id}/reactions { "👍" }
        RC->>RS: addToMessage(id, "👍")
    end

    RS->>PG: saveAndFlush(Reaction)
    Note over PG: 파셜 유니크 인덱스<br/>uq_reactions_message_active<br/>(message_id, user_id, emoji)<br/>WHERE deleted_at IS NULL
    alt 첫 번째 커밋
        PG-->>RS: OK
        RS->>SMT: convertAndSend("/topic/channel/{chId}/reactions", ...)
    else 두 번째 (동일 유저/이모지 race)
        PG-->>RS: DataIntegrityViolationException
        RS->>RS: throw BusinessException(REACTION_ALREADY_EXISTS)
    end
```

DB 제약이 진실의 원천 — 서비스 레이어는 변환만 담당.

---

## 프론트엔드 상태 관리 레이어

```mermaid
graph TB
    subgraph "서버 상태 (TanStack Query)"
        TQ1[채널 메시지 페이지<br/>useInfiniteQuery]
        TQ2[워크스페이스/채널 목록]
        TQ3[프로필, 파일 목록]
    end

    subgraph "실시간 상태 (Zustand)"
        ZS1[useChatStore<br/>messages, addMessage, prependMessages]
        ZS2[useDmStore]
        ZS3[useNotificationStore]
        ZS4[useAuthStore<br/>accessToken, user]
    end

    subgraph "훅"
        H1[useChannelWebSocket]
        H2[useDmWebSocket<br/>ref-based callbacks]
        H3[useReactionWebSocket]
    end

    TQ1 -->|초기 로드/페이지| ZS1
    H1 -->|WS 수신| ZS1
    H2 -->|WS 수신| ZS2
    H3 -->|add/remove| ZS1
```

**설계 원칙**: 서버에서 받아오는 불변 스냅샷은 TQ 캐시, 실시간으로 변하는 현재 뷰 상태는 Zustand. `useEffect`에서 store를 통째로 치환하면 WS 수신이 사라지므로, 병합 정책을 명시적으로 작성.

---

## WebSocket 보안 계층

```mermaid
sequenceDiagram
    participant C as 클라이언트
    participant I as ChannelInterceptor
    participant SC as SecurityContext
    participant H as @MessageMapping Handler

    C->>I: CONNECT (Authorization 헤더)
    I->>I: jwtUtil.parseToken()
    alt 파싱 실패
        I--xC: throw MessageDeliveryException
    else 성공
        I->>SC: UsernamePasswordAuthenticationToken 세팅
        I->>I: accessor.setUser(principal)
    end

    C->>I: SUBSCRIBE /topic/...
    I->>I: requireAuthenticated() — SecurityContext 체크
    I-->>C: SUBSCRIBE OK

    C->>I: SEND /app/...
    I->>I: requireAuthenticated()
    I->>H: 메서드 호출
```

HTTP 필터 체인을 거치지 않으므로 STOMP 단에서 **전 커맨드별 가드**가 필수.
