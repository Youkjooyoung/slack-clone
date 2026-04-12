'use client'

import { useLayoutStore, THEMES, type ThemeId } from '@/store/layoutStore'
import styles from './panel.module.css'

const SIZE_OPTIONS: Array<{ label: string; value: number; desc: string }> = [
  { label: '작게', value: 44, desc: '1줄' },
  { label: '보통', value: 88, desc: '3줄' },
  { label: '크게', value: 152, desc: '5줄' },
]

export function MorePanel() {
  const { theme, inputMinHeight, setTheme, setInputMinHeight } = useLayoutStore()

  return (
    <div className={styles.panel}>
      <div className={styles.panelScroll}>
        <div className={styles.morePanelInner}>

          {/* ── 색상 테마 ── */}
          <div className={styles.moreSection}>
            <p className={styles.moreSectionTitle}>색상 테마</p>
            <div className={styles.themeGrid}>
              {(Object.keys(THEMES) as ThemeId[]).map((id) => {
                const t = THEMES[id]
                return (
                  <div
                    key={id}
                    className={`${styles.themeCard} ${theme === id ? styles.themeCardActive : ''}`}
                    style={{ background: t.sidebarBgTop }}
                    onClick={() => setTheme(id)}
                    title={t.name}
                  >
                    <div className={styles.themePreview}>
                      <div
                        className={styles.themePreviewRail}
                        style={{ background: t.iconRailBg }}
                      />
                      <div
                        className={styles.themePreviewPanel}
                        style={{ background: t.sidebarBgBottom }}
                      />
                    </div>
                    <div className={styles.themeCardLabel}>{t.name}</div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className={styles.moreDivider} />

          {/* ── 입력창 크기 ── */}
          <div className={styles.moreSection}>
            <p className={styles.moreSectionTitle}>메시지 입력창 크기</p>
            <div className={styles.sizeGrid}>
              {SIZE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`${styles.sizeBtn} ${inputMinHeight === opt.value ? styles.sizeBtnActive : ''}`}
                  onClick={() => setInputMinHeight(opt.value)}
                  title={opt.desc}
                >
                  {opt.label}
                  <br />
                  <span style={{ fontSize: '0.625rem', opacity: 0.65 }}>{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.moreDivider} />

          {/* ── 입력창 드래그 안내 ── */}
          <div className={styles.moreSection}>
            <p className={styles.moreSectionTitle}>직접 조절</p>
            <p style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
              채팅 입력창 상단 핸들을 위아래로 드래그해서 크기를 조절할 수 있습니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
