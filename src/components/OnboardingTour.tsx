'use client'
import { useState, useEffect } from 'react'
import styles from './OnboardingTour.module.css'
import type { Page } from '@/types'

const TOUR_KEY = 'ct_tour_done'

interface TourStep {
  target: string        // CSS selector for the element to highlight
  title: string
  body: string
  position: 'bottom' | 'bottom-right' | 'top'
  page: Page            // which page this step lives on
  action?: string       // optional CTA label
  onAction?: (navigate: (p: Page) => void) => void
}

const STEPS: TourStep[] = [
  {
    target: '[data-tour="library"]',
    title: '📚 Add your first item',
    body: 'Head to the Library and click "+ Add Item". Got a shelf full of stuff? Try AI Catalog Upload — snap a photo and Claude does the rest.',
    position: 'bottom',
    page: 'library',
    action: 'Go to Library',
    onAction: (nav) => nav('library'),
  },
  {
    target: '[data-tour="barter"]',
    title: '⚖️ Trade what you have',
    body: 'Post a barter offer — what you have, what you want. We match you automatically with neighbors who are a fit.',
    position: 'bottom',
    page: 'barter',
    action: 'See the Barter Board',
    onAction: (nav) => nav('barter'),
  },
  {
    target: '[data-tour="loans"]',
    title: '📦 Track your loans',
    body: 'When someone borrows from you (or you borrow from them), everything is tracked here — due dates, return confirmations, reviews.',
    position: 'bottom',
    page: 'loans',
  },
]

interface OnboardingTourProps {
  navigate: (page: Page) => void
  onDone: () => void
}

export default function OnboardingTour({ navigate, onDone }: OnboardingTourProps) {
  const [step, setStep] = useState(0)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Small delay so the UI has settled after signup
    const t = setTimeout(() => setVisible(true), 600)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!visible) return
    positionTooltip()
    window.addEventListener('resize', positionTooltip)
    return () => window.removeEventListener('resize', positionTooltip)
  }, [step, visible])

  function positionTooltip() {
    const target = document.querySelector(STEPS[step].target)
    if (!target) {
      // Target not visible (e.g. mobile nav hidden) — center the tooltip instead
      setPos({
        top: window.innerHeight / 2 - 100 + window.scrollY,
        left: Math.max(16, window.innerWidth / 2 - 150),
        width: 300,
      })
      return
    }
    const rect = target.getBoundingClientRect()
    setPos({
      top: rect.bottom + window.scrollY + 10,
      left: Math.max(8, Math.min(rect.left + window.scrollX, window.innerWidth - 316)),
      width: rect.width,
    })
  }

  function next() {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1)
    } else {
      finish()
    }
  }

  function finish() {
    localStorage.setItem(TOUR_KEY, '1')
    setVisible(false)
    setTimeout(onDone, 300)
  }

  if (!visible || !pos) return null

  const current = STEPS[step]

  return (
    <>
      {/* Backdrop highlight ring around target */}
      <TargetHighlight selector={current.target} />

      {/* Tooltip */}
      <div
        className={`${styles.tooltip} ${visible ? styles.tooltipVisible : ''}`}
        style={{
          top: pos.top,
          left: Math.min(pos.left, window.innerWidth - 320),
        }}
      >
        <div className={styles.arrow} />
        <div className={styles.header}>
          <span className={styles.stepCount}>{step + 1} of {STEPS.length}</span>
          <button className={styles.skip} onClick={finish}>Skip tour</button>
        </div>
        <h3 className={styles.title}>{current.title}</h3>
        <p className={styles.body}>{current.body}</p>
        <div className={styles.footer}>
          {current.action && current.onAction ? (
            <button
              className={styles.actionBtn}
              onClick={() => { current.onAction!(navigate); next() }}
            >
              {current.action} →
            </button>
          ) : null}
          <button className={styles.nextBtn} onClick={next}>
            {step < STEPS.length - 1 ? 'Next' : 'Done 🎉'}
          </button>
        </div>
        {/* Progress dots */}
        <div className={styles.dots}>
          {STEPS.map((_, i) => (
            <div key={i} className={`${styles.dot} ${i === step ? styles.dotActive : i < step ? styles.dotDone : ''}`} />
          ))}
        </div>
      </div>
    </>
  )
}

// Highlights the target element with a pulsing ring
function TargetHighlight({ selector }: { selector: string }) {
  const [rect, setRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    const el = document.querySelector(selector)
    if (el) setRect(el.getBoundingClientRect())
  }, [selector])

  if (!rect) return null

  return (
    <div
      className={styles.highlight}
      style={{
        position: 'fixed',
        top: rect.top - 4,
        left: rect.left - 4,
        width: rect.width + 8,
        height: rect.height + 8,
        borderRadius: 8,
        pointerEvents: 'none',
        zIndex: 299,
      }}
    />
  )
}

// Utility — check if tour has been seen
export function shouldShowTour(): boolean {
  if (typeof window === 'undefined') return false
  return !localStorage.getItem(TOUR_KEY)
}
