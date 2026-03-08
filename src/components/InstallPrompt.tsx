'use client'
import { useState, useEffect } from 'react'
import styles from './InstallPrompt.module.css'

const DISMISSED_KEY = 'ct_install_dismissed'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface InstallPromptProps {
  onDone: () => void
}

export default function InstallPrompt({ onDone }: InstallPromptProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isIOS, setIsIOS] = useState(false)
  const [visible, setVisible] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    // Don't show if already dismissed or already installed as PWA
    if (localStorage.getItem(DISMISSED_KEY)) { onDone(); return }
    if (window.matchMedia('(display-mode: standalone)').matches) { onDone(); return }

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window.navigator as any).standalone
    setIsIOS(ios)

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // Show after short delay
    const t = setTimeout(() => setVisible(true), 400)
    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      clearTimeout(t)
    }
  }, [])

  async function handleInstall() {
    if (deferredPrompt) {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') setInstalled(true)
    }
    dismiss()
  }

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1')
    setVisible(false)
    setTimeout(onDone, 300)
  }

  // iOS: no native prompt — just show instructions
  const showIOS = isIOS && !deferredPrompt

  return (
    <div
      className={`${styles.overlay} ${visible ? styles.overlayVisible : ''}`}
      onClick={e => e.target === e.currentTarget && dismiss()}
    >
      <div className={`${styles.modal} ${visible ? styles.modalVisible : ''}`}>
        <button className={styles.close} onClick={dismiss}>✕</button>

        <div className={styles.iconWrap}>
          <div className={styles.appIcon}>🏘️</div>
        </div>

        <h2 className={styles.title}>
          {installed ? "You're all set! 🎉" : 'Add CommuniTrade to your home screen'}
        </h2>

        {installed ? (
          <p className={styles.body}>CommuniTrade is now installed. Open it from your home screen anytime — no browser needed.</p>
        ) : showIOS ? (
          <>
            <p className={styles.body}>Install CommuniTrade for the fastest experience — no app store needed.</p>
            <div className={styles.iosSteps}>
              <div className={styles.iosStep}>
                <span className={styles.iosNum}>1</span>
                <span>Tap the <strong>Share</strong> button <span className={styles.iosIcon}>⎙</span> at the bottom of your browser</span>
              </div>
              <div className={styles.iosStep}>
                <span className={styles.iosNum}>2</span>
                <span>Scroll down and tap <strong>"Add to Home Screen"</strong></span>
              </div>
              <div className={styles.iosStep}>
                <span className={styles.iosNum}>3</span>
                <span>Tap <strong>Add</strong> — done!</span>
              </div>
            </div>
            <button className={styles.dismissBtn} onClick={dismiss}>Got it</button>
          </>
        ) : (
          <>
            <p className={styles.body}>
              Install the app for instant access, faster loading, and a native feel — right from your home screen.
            </p>
            <div className={styles.perks}>
              <span className={styles.perk}>⚡ Faster load times</span>
              <span className={styles.perk}>🔔 Push notifications (coming soon)</span>
              <span className={styles.perk}>📴 Works offline</span>
            </div>
            <div className={styles.actions}>
              <button className={styles.installBtn} onClick={handleInstall}>
                Install App
              </button>
              <button className={styles.laterBtn} onClick={dismiss}>
                Maybe later
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
