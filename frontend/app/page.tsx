'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import AnimatedChat from '@/components/landing/AnimatedChat'
import styles from './home.module.css'

const features = [
  {
    icon: '⚡',
    color: '#fff7e6',
    iconColor: '#f59e0b',
    title: '실시간 메시지',
    desc: 'WebSocket 기반 실시간 채팅으로 팀원들과 즉시 소통하세요. 지연 없는 빠른 메시지 전송.',
  },
  {
    icon: '#',
    color: '#eff6ff',
    iconColor: '#3b82f6',
    title: '채널 기반 협업',
    desc: '프로젝트, 팀, 주제별로 채널을 나눠 정보를 체계적으로 관리하세요.',
  },
  {
    icon: '💬',
    color: '#f0fdf4',
    iconColor: '#22c55e',
    title: '다이렉트 메시지',
    desc: '1:1 또는 소그룹 DM으로 빠르게 소통. 온라인 상태 실시간 표시.',
  },
  {
    icon: '📁',
    color: '#fdf4ff',
    iconColor: '#a855f7',
    title: '파일 공유',
    desc: '이미지, 문서를 채팅에서 바로 공유. 인라인 미리보기로 편리하게 확인.',
  },
  {
    icon: '🔔',
    color: '#fff1f2',
    iconColor: '#f43f5e',
    title: '@멘션 알림',
    desc: '중요한 메시지를 놓치지 마세요. @멘션 시 실시간 푸시 알림 수신.',
  },
  {
    icon: '🎨',
    color: '#f0fdf4',
    iconColor: '#10b981',
    title: '맞춤 테마',
    desc: '4가지 색상 테마와 입력창 크기 조절로 나만의 작업 환경을 만드세요.',
  },
]

const steps = [
  { title: '계정 만들기', desc: '이메일로 30초 만에\n무료 회원가입' },
  { title: '워크스페이스 생성', desc: '팀 이름으로\n워크스페이스 개설' },
  { title: '팀원 초대', desc: '이메일 초대로\n간편하게 합류' },
  { title: '소통 시작', desc: '채널과 DM으로\n바로 협업 시작' },
]

export default function Home() {
  const router = useRouter()
  const { accessToken } = useAuthStore()
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    setIsLoggedIn(!!accessToken)
  }, [accessToken])

  return (
    <div className={styles.page}>
      {/* ── Navbar ── */}
      <nav className={styles.nav}>
        <Link href="/" className={styles.navLogo}>
          <div className={styles.navLogoIcon}>T</div>
          <span className={styles.navLogoText}>투톡</span>
        </Link>
        <div className={styles.navActions}>
          {isLoggedIn ? (
            <Link href="/workspace" className={styles.navBtn}>워크스페이스로 이동</Link>
          ) : (
            <>
              <Link href="/auth/login" className={styles.navLink}>로그인</Link>
              <Link href="/auth/register" className={styles.navBtn}>무료로 시작하기</Link>
            </>
          )}
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className={styles.hero}>
        <div className={styles.heroEyebrow}>
          ✨ 새로운 협업의 시작
        </div>

        <h1 className={styles.heroTitle}>
          팀의 소통을{' '}
          <span className={styles.heroTitleAccent}>더 빠르고</span>
          <br />
          더 스마트하게
        </h1>

        <p className={styles.heroSub}>
          채널, 다이렉트 메시지, 파일 공유까지 — 팀 협업에 필요한 모든 것이 한 곳에.
          투톡으로 팀의 생산성을 끌어올리세요.
        </p>

        <div className={styles.heroCta}>
          <Link href="/auth/register" className={styles.ctaPrimary}>
            무료로 시작하기 →
          </Link>
          <Link href="/auth/login" className={styles.ctaSecondary}>
            로그인
          </Link>
        </div>

        {/* Mock UI */}
        <div className={styles.heroPreview}>
          <div className={styles.heroPreviewInner}>
            {/* Title bar */}
            <div className={styles.previewBar}>
              <div className={styles.previewDot} style={{ background: '#ff5f57' }} />
              <div className={styles.previewDot} style={{ background: '#febc2e' }} />
              <div className={styles.previewDot} style={{ background: '#28c840' }} />
              <span className={styles.previewBarTitle}>투톡 — 테스트 워크스페이스</span>
            </div>

            <div className={styles.previewBody}>
              {/* Icon Rail */}
              <div className={styles.previewIconRail}>
                <div className={`${styles.previewRailIcon}`} style={{ background: 'linear-gradient(135deg, #03C75A 0%, #02b876 100%)', boxShadow: '0 2px 8px rgba(3, 199, 90, 0.3)', color: '#fff', fontWeight: 800, fontSize: '0.75rem' }}>T</div>
                {['🏠', '💬', '🔔', '📁'].map((icon, i) => (
                  <div key={i} className={`${styles.previewRailIcon} ${i === 1 ? styles.previewRailIconActive : ''}`}>{icon}</div>
                ))}
              </div>

              {/* Sidebar */}
              <div className={styles.previewSidebar}>
                <div className={styles.previewSidebarHeader}>테스트 워크스페이스</div>

                <div className={styles.previewSidebarSection}>
                  <div className={styles.previewSidebarLabel}>채널</div>
                  {[
                    { name: 'general', active: true },
                    { name: '공지사항', active: false },
                    { name: '개발팀', active: false },
                    { name: '디자인팀', active: false },
                  ].map((ch) => (
                    <div key={ch.name} className={`${styles.previewSidebarItem} ${ch.active ? styles.previewSidebarItemActive : ''}`}>
                      <span className={styles.previewSidebarHash}>#</span>
                      {ch.name}
                    </div>
                  ))}
                </div>

                <div className={styles.previewSidebarSection}>
                  <div className={styles.previewSidebarLabel}>다이렉트 메시지</div>
                  {[
                    { name: '김기수', online: true },
                    { name: '이서연', online: true },
                    { name: '박민준', online: false },
                    { name: '최지우', online: true },
                  ].map((dm) => (
                    <div key={dm.name} className={styles.previewSidebarItem}>
                      <span className={styles.previewOnlineDot} style={{ background: dm.online ? '#2bac76' : '#97979b' }} />
                      {dm.name}
                    </div>
                  ))}
                </div>
              </div>

              {/* Main Chat */}
              <div className={styles.previewMain}>
                <div className={styles.previewMainHeader}>
                  <span className={styles.previewMainHeaderHash}>#</span>
                  <span className={styles.previewMainHeaderName}>general</span>
                  <span className={styles.previewMainHeaderDesc}>· 팀 전체 채널</span>
                </div>

                <AnimatedChat />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className={styles.stats}>
        {[
          { number: '실시간', label: 'WebSocket 메시지 전송' },
          { number: '무제한', label: '채널 & 다이렉트 메시지' },
          { number: '4가지', label: '커스텀 테마' },
          { number: '100%', label: '무료 오픈소스' },
        ].map((s) => (
          <div key={s.number} className={styles.statItem}>
            <div className={styles.statNumber}>{s.number}</div>
            <div className={styles.statLabel}>{s.label}</div>
          </div>
        ))}
      </section>

      {/* ── Features ── */}
      <section className={styles.features}>
        <p className={styles.sectionEyebrow}>핵심 기능</p>
        <h2 className={styles.sectionTitle}>
          협업에 필요한 모든 것
        </h2>
        <p className={styles.sectionSub}>
          실시간 메시지부터 파일 공유, 알림까지 — 팀 소통의 모든 과정을 하나의 플랫폼에서.
        </p>

        <div className={styles.featureGrid}>
          {features.map((f) => (
            <div key={f.title} className={styles.featureCard}>
              <div className={styles.featureIcon} style={{ background: f.color, color: f.iconColor }}>
                {f.icon}
              </div>
              <h3 className={styles.featureTitle}>{f.title}</h3>
              <p className={styles.featureDesc}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className={styles.howItWorks}>
        <p className={styles.sectionEyebrow}>시작 방법</p>
        <h2 className={styles.sectionTitle}>4단계로 바로 시작</h2>
        <p className={styles.sectionSub}>복잡한 설정 없이 바로 팀 협업을 시작하세요.</p>

        <div className={styles.steps}>
          {steps.map((s, i) => (
            <div key={i} className={styles.step}>
              <div className={styles.stepNumber}>{i + 1}</div>
              <div className={styles.stepTitle}>{s.title}</div>
              <div className={styles.stepDesc} style={{ whiteSpace: 'pre-line' }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className={styles.ctaSection}>
        <h2 className={styles.ctaTitle}>
          지금 바로 팀과 함께<br />시작해보세요
        </h2>
        <p className={styles.ctaSub}>
          무료 계정을 만들고 투톡의 모든 기능을 제한 없이 사용하세요.
        </p>
        <div className={styles.ctaBtns}>
          <Link href="/auth/register" className={styles.ctaPrimary}>
            무료 회원가입 →
          </Link>
          <Link href="/auth/login" className={styles.ctaSecondary}>
            기존 계정으로 로그인
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className={styles.footer}>
        <Link href="/" className={styles.footerLogo}>
          <span className={styles.footerLogoMark}>T</span>
          <span className={styles.footerLogoText}>투톡</span>
        </Link>
        <p className={styles.footerCopy}>© 2026 투톡. 포트폴리오 프로젝트.</p>
        <div className={styles.footerLinks}>
          <Link href="/auth/login" className={styles.footerLink}>로그인</Link>
          <Link href="/auth/register" className={styles.footerLink}>회원가입</Link>
        </div>
      </footer>
    </div>
  )
}
