# Backend - Slack Clone

Spring Boot 3 기반 백엔드 API 서버

## 기술 스택

| 기술 | 버전 | 용도 |
|------|------|------|
| Java | 17 | 언어 |
| Spring Boot | 3.3 | 프레임워크 |
| Spring Security | - | 인증/인가 |
| Spring Data JPA | - | ORM |
| Spring WebSocket | - | 실시간 통신 (STOMP) |
| PostgreSQL | 16 | 메인 데이터베이스 |
| Redis | 7 | 캐시 / 세션 |
| QueryDSL | 5.1 | 동적 쿼리 |
| JWT (jjwt) | 0.12 | 토큰 인증 |
| Lombok | - | 보일러플레이트 제거 |

## 프로젝트 구조

```
backend/
├── src/
│   ├── main/
│   │   ├── java/com/slackclone/
│   │   │   ├── SlackCloneApplication.java
│   │   │   ├── config/
│   │   │   │   ├── SecurityConfig.java    Spring Security 설정
│   │   │   │   ├── WebSocketConfig.java   STOMP WebSocket 설정
│   │   │   │   └── RedisConfig.java       Redis 설정
│   │   │   ├── controller/               REST API 컨트롤러
│   │   │   ├── service/                  비즈니스 로직
│   │   │   ├── repository/               JPA + QueryDSL 리포지토리
│   │   │   ├── entity/                   JPA 엔티티
│   │   │   ├── dto/                      Request/Response DTO
│   │   │   └── security/                 JWT 필터/유틸
│   │   └── resources/
│   │       └── application.yml           설정 파일
│   └── test/
├── build.gradle
└── gradlew
```

## 시작하기

### 사전 요구사항

- Java 17+
- Docker (PostgreSQL, Redis 실행용)

### DB/Redis 실행

```bash
# 프로젝트 루트에서
docker-compose up -d
```

### 백엔드 실행

```bash
./gradlew bootRun
```

### 빌드

```bash
./gradlew build
```

### 테스트

```bash
./gradlew test
```

## API 기본 정보

- Base URL: `http://localhost:8080`
- 인증: Bearer JWT Token
- 공개 엔드포인트: `/api/auth/**`
- WebSocket 엔드포인트: `/ws` (SockJS)
- STOMP 구독 prefix: `/topic`, `/queue`, `/user`
- STOMP 발행 prefix: `/app`

## WebSocket 사용 예시 (Frontend)

```javascript
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'

const client = new Client({
  webSocketFactory: () => new SockJS('http://localhost:8080/ws'),
  connectHeaders: { Authorization: `Bearer ${token}` },
  onConnect: () => {
    client.subscribe('/topic/channel.{channelId}', (message) => {
      console.log(JSON.parse(message.body))
    })
  },
})
client.activate()
```
