import { useEffect, useState } from 'react'
import type { AppConfig } from '../shared/types/config'
import { getAppConfig, setAppConfig } from '../shared/utils/storage'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export function Settings() {
  const [config, setConfig] = useState<AppConfig>({
    imgbbApiKey: '',
    googleScriptUrl: '',
    googleDocUrl: '',
  })
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')

  useEffect(() => {
    getAppConfig().then(setConfig)
  }, [])

  async function handleSave() {
    setSaveStatus('saving')
    try {
      await setAppConfig(config)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch {
      setSaveStatus('error')
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>

        {/* Header */}
        <div style={styles.headerRow}>
          <div style={styles.logoWrap}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <rect width="24" height="24" rx="6" fill="#5B3DE8" />
              <path d="M7 8h10M7 12h7M7 16h5" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
              <circle cx="18" cy="15" r="3" fill="#FF4D6A" />
            </svg>
          </div>
          <div>
            <h1 style={styles.title}>Visual Bug Reporter</h1>
            <p style={styles.subtitle}>Configure your integrations</p>
          </div>
        </div>

        {/* Google Apps Script */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Google Docs via Apps Script</h2>
          <p style={styles.sectionHint}>
            Reports are posted to a Google Doc using a Google Apps Script you deploy once.
            No Google Cloud Console or OAuth needed.
          </p>

          <Field
            label="Apps Script URL"
            hint={
              <>
                1. Go to{' '}
                <a href="https://script.google.com" target="_blank" rel="noopener noreferrer" style={styles.link}>
                  script.google.com
                </a>{' '}
                → New project → paste the script code → Save<br />
                2. Deploy → New deployment → Web app → Execute as: <strong>Me</strong> → Who has access: <strong>Anyone</strong><br />
                3. Copy the web app URL and paste it here
              </>
            }
          >
            <input
              type="text"
              style={styles.input}
              placeholder="https://script.google.com/macros/s/.../exec"
              value={config.googleScriptUrl}
              onChange={e => setConfig(c => ({ ...c, googleScriptUrl: e.target.value.trim() }))}
            />
          </Field>

          <Field
            label="Target Google Doc URL (optional)"
            hint="Paste a Google Doc URL from the same Google account that runs the script. Leave blank to auto-create a shared Bug Reports doc."
          >
            <input
              type="text"
              style={styles.input}
              placeholder="https://docs.google.com/document/d/..."
              value={config.googleDocUrl}
              onChange={e => setConfig(c => ({ ...c, googleDocUrl: e.target.value.trim() }))}
            />
          </Field>
        </div>

        {/* ImgBB */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Image Hosting (ImgBB)</h2>
          <p style={styles.sectionHint}>
            Screenshots are uploaded to ImgBB so they can be embedded in the Google Doc.{' '}
            <a href="https://api.imgbb.com/" target="_blank" rel="noopener noreferrer" style={styles.link}>
              Get a free API key →
            </a>
          </p>

          <Field label="ImgBB API Key">
            <input
              type="text"
              style={styles.input}
              placeholder="Your ImgBB API key"
              value={config.imgbbApiKey}
              onChange={e => setConfig(c => ({ ...c, imgbbApiKey: e.target.value.trim() }))}
            />
          </Field>
        </div>

        {/* Save */}
        <div style={styles.footer}>
          <button
            style={{
              ...styles.saveBtn,
              background: saveStatus === 'saved'
                ? 'linear-gradient(135deg, #00C851, #00A041)'
                : 'linear-gradient(135deg, #5B3DE8, #7B5CF0)',
              opacity: saveStatus === 'saving' ? 0.7 : 1,
            }}
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
          >
            {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? '✓ Saved' : 'Save Settings'}
          </button>
          {saveStatus === 'error' && (
            <span style={{ color: '#FF4D6A', fontSize: '13px' }}>Failed to save. Try again.</span>
          )}
        </div>

        <div style={styles.notice}>
          <strong>🔒 Privacy:</strong> All keys are stored locally in your browser using{' '}
          <code style={{ fontSize: '11px', background: 'rgba(255,255,255,0.06)', padding: '1px 4px', borderRadius: '3px' }}>
            chrome.storage.sync
          </code>{' '}
          and are never sent anywhere except the respective APIs.
        </div>
      </div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label style={{ fontSize: '13px', fontWeight: '600', color: '#ccc' }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: '12px', color: '#666', lineHeight: 1.4 }}>{hint}</div>}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    padding: '40px 20px',
  },
  card: {
    width: '100%',
    maxWidth: '560px',
    display: 'flex',
    flexDirection: 'column',
    gap: '28px',
  },
  headerRow: { display: 'flex', alignItems: 'center', gap: '14px' },
  logoWrap: { flexShrink: 0 },
  title: { fontSize: '20px', fontWeight: '700', color: '#fff' },
  subtitle: { fontSize: '13px', color: '#777', marginTop: '2px' },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    padding: '20px',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  sectionTitle: { fontSize: '14px', fontWeight: '700', color: '#fff', marginBottom: '4px' },
  sectionHint: { fontSize: '12px', color: '#666', lineHeight: 1.5, marginTop: '-8px' },
  input: {
    width: '100%',
    padding: '10px 12px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  footer: { display: 'flex', alignItems: 'center', gap: '12px' },
  saveBtn: {
    padding: '12px 28px',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background 0.2s, opacity 0.2s',
  },
  link: { color: '#7B5CF0', textDecoration: 'none' },
  notice: {
    fontSize: '12px',
    color: '#555',
    lineHeight: 1.5,
    padding: '12px 16px',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.06)',
  },
}
