import styles from './Toast.module.css'

export default function Toast({ message, type = 'success' }: { message: string; type?: string }) {
  return (
    <div className={`${styles.toast} ${type === 'error' ? styles.error : ''}`}>
      {type === 'success' ? '✅' : '⚠️'} {message}
    </div>
  )
}
