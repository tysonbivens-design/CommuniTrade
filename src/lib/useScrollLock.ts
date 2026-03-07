import { useEffect } from 'react'

/**
 * Locks body scroll while a modal/sheet is open.
 * Automatically restores on unmount.
 */
export function useScrollLock() {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])
}
