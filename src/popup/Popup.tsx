import { useEffect, useState } from 'react'
import type {
  CaptureScreenshotResponse,
  AddScreenshotResponse,
  GetSessionResponse,
} from '../shared/types/messages'

type Status = 'idle' | 'loading' | 'capturing' | 'adding' | 'cancelling' | 'error'

export function Popup() {
  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<GetSessionResponse | null>(null)

  // Check for an active annotation session on mount
  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_SESSION' })
      .then((res: GetSessionResponse) => {
        setSession(res)
        setStatus('idle')
      })
      .catch(() => {
        setSession(null)
        setStatus('idle')
      })
  }, [])

  async function handleCapture() {
    setStatus('capturing')
    setError(null)
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'CAPTURE_SCREENSHOT',
      }) as CaptureScreenshotResponse

      if (response.success) {
        window.close()
      } else {
        setStatus('error')
        setError(response.error ?? 'Capture failed')
      }
    } catch (err) {
      setStatus('error')
      setError(String(err))
    }
  }

  async function handleAddScreenshot() {
    setStatus('adding')
    setError(null)
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'ADD_SCREENSHOT',
      }) as AddScreenshotResponse

      if (response.success) {
        // Background already focused the annotation tab
        window.close()
      } else {
        setStatus('error')
        setError(response.error ?? 'Failed to add screenshot')
      }
    } catch (err) {
      setStatus('error')
      setError(String(err))
    }
  }

  async function handleViewReport() {
    if (session?.annotationTabId) {
      await chrome.tabs.update(session.annotationTabId, { active: true })
      window.close()
    }
  }

  async function handleCancelSession() {
    setStatus('cancelling')
    try {
      await chrome.runtime.sendMessage({ type: 'CLEAR_SESSION' })
    } catch {
      // ignore
    }
    window.close()
  }

  function handleSettings() {
    chrome.runtime.openOptionsPage()
  }

  const isBusy = status === 'loading' || status === 'capturing' || status === 'adding' || status === 'cancelling'

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.logo}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="6" fill="#5B3DE8" />
            <path d="M7 8h10M7 12h7M7 16h5" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
            <circle cx="18" cy="15" r="3" fill="#FF4D6A" />
          </svg>
        </div>
        <div>
          <div style={styles.title}>Bug Reporter</div>
          <div style={styles.subtitle}>
            {session?.hasSession
              ? `Report in progress · ${session.screenshotCount} screenshot${session.screenshotCount === 1 ? '' : 's'}`
              : 'Capture & report bugs'}
          </div>
        </div>
      </div>

      <div style={styles.body}>
        {status === 'loading' ? (
          <div style={{ color: '#555', fontSize: '12px', textAlign: 'center', padding: '8px' }}>
            Checking session…
          </div>
        ) : session?.hasSession ? (
          /* ── Active session UI ── */
          <>
            <button
              style={{ ...styles.primaryBtn, ...(isBusy ? styles.btnDisabled : {}) }}
              onClick={handleAddScreenshot}
              disabled={isBusy}
            >
              {status === 'adding' ? (
                <><Spinner /> Adding…</>
              ) : (
                <><CameraIcon /> Add this screenshot</>
              )}
            </button>

            <button
              style={styles.secondaryBtn}
              onClick={handleViewReport}
              disabled={isBusy}
            >
              View report →
            </button>

            <button
              style={styles.dangerBtn}
              onClick={handleCancelSession}
              disabled={isBusy}
            >
              {status === 'cancelling' ? 'Cancelling…' : 'Cancel report'}
            </button>
          </>
        ) : (
          /* ── Normal capture UI ── */
          <button
            style={{ ...styles.primaryBtn, ...(isBusy ? styles.btnDisabled : {}) }}
            onClick={handleCapture}
            disabled={isBusy}
          >
            {status === 'capturing' ? (
              <><Spinner /> Capturing…</>
            ) : (
              <><CameraIcon /> Capture Bug</>
            )}
          </button>
        )}

        {status === 'error' && error && (
          <div style={styles.errorBox}>{error}</div>
        )}
      </div>

      <div style={styles.footer}>
        <button style={styles.settingsLink} onClick={handleSettings}>
          ⚙ Settings
        </button>
      </div>
    </div>
  )
}

function CameraIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ marginRight: 8 }}>
      <path
        d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      />
      <circle cx="12" cy="13" r="4" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

function Spinner() {
  return (
    <svg
      width="18" height="18" viewBox="0 0 24 24" fill="none"
      style={{ marginRight: 8, animation: 'spin 0.8s linear infinite' }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    padding: '16px',
    gap: '16px',
    minWidth: '220px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logo: {
    flexShrink: 0,
  },
  title: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#fff',
  },
  subtitle: {
    fontSize: '12px',
    color: '#888',
    marginTop: '2px',
  },
  body: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  primaryBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    padding: '12px',
    background: 'linear-gradient(135deg, #5B3DE8 0%, #7B5CF0 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
  secondaryBtn: {
    width: '100%',
    padding: '10px',
    background: 'rgba(255,255,255,0.06)',
    color: '#ccc',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '8px',
    fontSize: '13px',
    cursor: 'pointer',
  },
  dangerBtn: {
    width: '100%',
    padding: '8px',
    background: 'none',
    color: '#FF4D6A',
    border: '1px solid rgba(255,77,106,0.3)',
    borderRadius: '8px',
    fontSize: '12px',
    cursor: 'pointer',
  },
  btnDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  errorBox: {
    padding: '10px 12px',
    background: 'rgba(255, 77, 106, 0.15)',
    border: '1px solid rgba(255, 77, 106, 0.4)',
    borderRadius: '8px',
    fontSize: '12px',
    color: '#FF4D6A',
    lineHeight: 1.4,
  },
  footer: {
    display: 'flex',
    justifyContent: 'center',
  },
  settingsLink: {
    background: 'none',
    border: 'none',
    color: '#666',
    fontSize: '12px',
    cursor: 'pointer',
    padding: '4px 8px',
  },
}
