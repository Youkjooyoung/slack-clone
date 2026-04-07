# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM eclipse-temurin:17-jdk-jammy AS builder
WORKDIR /app

# Gradle 래퍼 + 의존성 정의 파일 먼저 복사 → 레이어 캐시 활용
COPY gradlew settings.gradle build.gradle ./
COPY gradle ./gradle/
RUN chmod +x gradlew

# 의존성 다운로드 (소스 변경 시 이 레이어는 재사용)
RUN ./gradlew dependencies --no-daemon --quiet

# 소스 복사 후 빌드 (테스트 제외)
COPY src ./src/
RUN ./gradlew bootJar --no-daemon -x test

# ── Stage 2: Run ──────────────────────────────────────────────────────────────
FROM eclipse-temurin:17-jre-jammy AS runner
WORKDIR /app

# 보안: root가 아닌 별도 사용자 실행
RUN groupadd --system appgroup && useradd --system --gid appgroup appuser
USER appuser

COPY --from=builder /app/build/libs/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", \
  "-XX:+UseContainerSupport", \
  "-XX:MaxRAMPercentage=75.0", \
  "-Djava.security.egd=file:/dev/./urandom", \
  "-jar", "app.jar"]
