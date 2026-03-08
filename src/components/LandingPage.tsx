'use client'
import { useEffect, useRef, useState } from 'react'
import styles from './LandingPage.module.css'
import type { AppCtx } from '@/types'

const FEATURES = [
  { icon: '📚', title: 'Lend & Borrow', body: 'Share books, DVDs, tools, games — anything on your shelf gathering dust.' },
  { icon: '⚖️', title: 'Barter Skills', body: 'Trade what you have for what you need. Guitar lessons for fresh eggs. AI matches you automatically.' },
  { icon: '⭐', title: 'Trust Scores', body: 'Every exchange builds your reputation. The community self-polices — good neighbors rise to the top.' },
  { icon: '📍', title: 'Hyper-Local', body: 'Set your radius. See only what\'s near you. Your neighborhood, not the whole internet.' },
]

const TESTIMONIALS = [
  { quote: "Borrowed a drill, lent out three cookbooks, traded sourdough starter for piano lessons. All within six blocks.", name: "Maria G.", zip: "80203" },
  { quote: "Finally a use for the 200 DVDs taking up space in my garage. My neighbors are obsessed.", name: "James T.", zip: "94110" },
  { quote: "The trust score system is genius. I knew exactly who I was dealing with before the first message.", name: "Priya K.", zip: "10025" },
]

const ITEMS = [
  { emoji: '📚', label: 'The Midnight Library', sub: 'Matt Haig · Novel' },
  { emoji: '🔧', label: 'DeWalt Drill Set', sub: 'Tool · Excellent condition' },
  { emoji: '🎬', label: 'Spirited Away', sub: 'DVD · Studio Ghibli' },
  { emoji: '🎲', label: 'Settlers of Catan', sub: 'Board Game · Complete set' },
  { emoji: '🎵', label: 'Kind of Blue', sub: 'CD · Miles Davis' },
  { emoji: '🏠', label: 'Stand Mixer', sub: 'Home Good · KitchenAid' },
]

interface LandingPageProps {
  ctx: AppCtx
  onSignUp: () => void
  onSignIn: () => void
}

export default function LandingPage({ ctx, onSignUp, onSignIn }: LandingPageProps) {
  const { navigate } = ctx
  const [activeTestimonial, setActiveTestimonial] = useState(0)
  const heroRef = useRef<HTMLDivElement>(null)
  const [scrollY, setScrollY] = useState(0)

  useEffect(() => {
    const handler = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTestimonial(i => (i + 1) % TESTIMONIALS.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className={styles.root}>

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section className={styles.hero} ref={heroRef}>
        <div
          className={styles.heroParallax}
          style={{ transform: `translateY(${scrollY * 0.3}px)` }}
        />
        <div className={styles.heroGrain} />

        <div className={styles.heroInner}>
          <div className={styles.heroPill}>🌱 Free to join · No corporations · Just neighbors</div>
          <h1 className={styles.heroTitle}>
            Your neighborhood's<br />
            <em>shared shelf.</em>
          </h1>
          <p className={styles.heroSub}>
            Borrow books. Swap DVDs. Trade skills. With real people who live near you —
            not strangers on the internet.
          </p>
          <div className={styles.heroCtas}>
            <button className={styles.ctaPrimary} onClick={onSignUp}>
              Join Free — It Takes 30 Seconds
            </button>
            <button className={styles.ctaGhost} onClick={() => navigate('library')}>
              Browse the Library →
            </button>
          </div>

          {/* Floating item cards */}
          <div className={styles.floatingCards}>
            {ITEMS.map((item, i) => (
              <div
                key={i}
                className={styles.floatingCard}
                style={{
                  animationDelay: `${i * 0.15}s`,
                  '--float-offset': `${(i % 3) * 8 - 8}px`,
                } as React.CSSProperties}
              >
                <span className={styles.floatingEmoji}>{item.emoji}</span>
                <div>
                  <div className={styles.floatingLabel}>{item.label}</div>
                  <div className={styles.floatingSub}>{item.sub}</div>
                </div>
                <span className={styles.floatingBadge}>Available</span>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.heroWave}>
          <svg viewBox="0 0 1440 80" preserveAspectRatio="none">
            <path d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" fill="var(--cream)" />
          </svg>
        </div>
      </section>

      {/* ── SOCIAL PROOF STRIP ───────────────────────────────────── */}
      <section className={styles.strip}>
        <div className={styles.stripInner}>
          <div className={styles.stripStat}><span className={styles.stripNum}>2,400+</span><span className={styles.stripLabel}>Items Available</span></div>
          <div className={styles.stripDivider} />
          <div className={styles.stripStat}><span className={styles.stripNum}>840+</span><span className={styles.stripLabel}>Neighbors Joined</span></div>
          <div className={styles.stripDivider} />
          <div className={styles.stripStat}><span className={styles.stripNum}>1,200+</span><span className={styles.stripLabel}>Trades Completed</span></div>
          <div className={styles.stripDivider} />
          <div className={styles.stripStat}><span className={styles.stripNum}>4.9★</span><span className={styles.stripLabel}>Average Trust Score</span></div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────── */}
      <section className={styles.section}>
        <div className="container">
          <div className={styles.sectionLabel}>How it works</div>
          <h2 className={styles.sectionTitle}>Three steps to a more connected neighborhood</h2>
          <div className={styles.steps}>
            <div className={styles.step}>
              <div className={styles.stepNum}>01</div>
              <div className={styles.stepIcon}>📷</div>
              <h3 className={styles.stepTitle}>Snap your shelf</h3>
              <p className={styles.stepBody}>Upload a photo and our AI catalogs everything automatically. Or add items manually — it takes under a minute.</p>
            </div>
            <div className={styles.stepArrow}>→</div>
            <div className={styles.step}>
              <div className={styles.stepNum}>02</div>
              <div className={styles.stepIcon}>🔍</div>
              <h3 className={styles.stepTitle}>Browse nearby</h3>
              <p className={styles.stepBody}>Set your radius. See what your neighbors are sharing. Filter by category, offer type, or search by title.</p>
            </div>
            <div className={styles.stepArrow}>→</div>
            <div className={styles.step}>
              <div className={styles.stepNum}>03</div>
              <div className={styles.stepIcon}>🤝</div>
              <h3 className={styles.stepTitle}>Trade & connect</h3>
              <p className={styles.stepBody}>Request a borrow, post a barter, or message directly. Every exchange builds your community trust score.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────────── */}
      <section className={`${styles.section} ${styles.sectionAlt}`}>
        <div className="container">
          <div className={styles.sectionLabel}>Features</div>
          <h2 className={styles.sectionTitle}>Everything your neighborhood needs</h2>
          <div className={styles.features}>
            {FEATURES.map((f, i) => (
              <div key={i} className={styles.featureCard}>
                <div className={styles.featureIcon}>{f.icon}</div>
                <h3 className={styles.featureTitle}>{f.title}</h3>
                <p className={styles.featureBody}>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── AI CALLOUT ───────────────────────────────────────────── */}
      <section className={styles.aiCallout}>
        <div className="container">
          <div className={styles.aiInner}>
            <div className={styles.aiText}>
              <div className={styles.sectionLabel} style={{ color: 'var(--gold)' }}>Powered by Claude AI</div>
              <h2 className={styles.aiTitle}>Catalog your entire shelf in seconds</h2>
              <p className={styles.aiBody}>
                Snap a photo of your bookshelf or DVD rack. Claude reads every title, identifies the category, and adds them all to your inventory — ready to share with your neighbors.
              </p>
              <button className={styles.ctaPrimary} onClick={onSignUp}>Try It Free →</button>
            </div>
            <div className={styles.aiDemo}>
              <div className={styles.aiDemoCard}>
                <div className={styles.aiDemoHeader}>
                  <span>📷</span>
                  <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>Claude is scanning your shelf…</span>
                </div>
                {['The Godfather · DVD', 'Beloved · Toni Morrison', 'Kind of Blue · Miles Davis', 'Settlers of Catan · Game'].map((item, i) => (
                  <div key={i} className={styles.aiDemoItem} style={{ animationDelay: `${i * 0.4 + 0.5}s` }}>
                    <span className={styles.aiDemoCheck}>✓</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ─────────────────────────────────────────── */}
      <section className={styles.section}>
        <div className="container">
          <div className={styles.sectionLabel}>Community voices</div>
          <h2 className={styles.sectionTitle}>Neighbors love it</h2>
          <div className={styles.testimonials}>
            {TESTIMONIALS.map((t, i) => (
              <div
                key={i}
                className={`${styles.testimonial} ${i === activeTestimonial ? styles.testimonialActive : ''}`}
                onClick={() => setActiveTestimonial(i)}
              >
                <p className={styles.testimonialQuote}>"{t.quote}"</p>
                <div className={styles.testimonialMeta}>
                  <span className={styles.testimonialName}>{t.name}</span>
                  <span className={styles.testimonialZip}>Zip {t.zip}</span>
                </div>
              </div>
            ))}
          </div>
          <div className={styles.testimonialDots}>
            {TESTIMONIALS.map((_, i) => (
              <button
                key={i}
                className={`${styles.dot} ${i === activeTestimonial ? styles.dotActive : ''}`}
                onClick={() => setActiveTestimonial(i)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────────────── */}
      <section className={styles.finalCta}>
        <div className={styles.finalCtaInner}>
          <h2 className={styles.finalCtaTitle}>Your neighbors are already sharing.</h2>
          <p className={styles.finalCtaSub}>Join free. No credit card. No catch.</p>
          <button className={styles.ctaPrimary} style={{ fontSize: '1.1rem', padding: '1rem 2.5rem' }} onClick={onSignUp}>
            Join Your Neighborhood →
          </button>
          <button className={styles.ctaGhost} onClick={onSignIn} style={{ marginTop: '0.75rem' }}>
            Already a member? Sign in
          </button>
        </div>
      </section>

    </div>
  )
}
