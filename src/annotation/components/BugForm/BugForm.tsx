import { useRef, useState } from 'react'
import type { BrowserInfo, BugReport, TagLevel } from '../../../shared/types/bugReport'
import { MetadataDisplay } from './MetadataDisplay'

interface ScreenshotPreview {
  title: string
  description: string
  dataUrl: string
  index: number
}

interface Props {
  initialUrl: string
  browserInfo: BrowserInfo
  screenshots: ScreenshotPreview[]
  isSubmitting: boolean
  submitError: string | null
  onBack: () => void
  onSubmit: (report: BugReport) => void
}

const TAG_CONFIG: { level: TagLevel; label: string; color: string; bg: string }[] = [
  { level: 'high',   label: 'High',   color: '#FF4D4D', bg: 'rgba(255,77,77,0.15)'  },
  { level: 'medium', label: 'Medium', color: '#FFB800', bg: 'rgba(255,184,0,0.15)'  },
  { level: 'low',    label: 'Low',    color: '#4D9FFF', bg: 'rgba(77,159,255,0.15)' },
]

function renderDescription(text: string): React.ReactNode {
  // If description contains HTML (links from RichDescription editor), render as HTML
  if (/<a\s/i.test(text)) {
    return <span dangerouslySetInnerHTML={{ __html: text }} />
  }
  // Plain text fallback: auto-link URLs
  const parts = text.split(/(https?:\/\/[^\s]+)/g)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    /^https?:\/\//.test(part)
      ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ color: '#7B5CF0', textDecoration: 'underline' }}>{part}</a>
      : part
  )
}

export function BugForm({ initialUrl, browserInfo, screenshots, isSubmitting, submitError, onBack, onSubmit }: Props) {
  const [tags, setTags] = useState<(TagLevel | null)[]>(screenshots.map(() => null))
  const scrollRef = useRef<HTMLDivElement>(null)

  function toggleTag(index: number, level: TagLevel) {
    setTags(prev => prev.map((t, i) => i === index ? (t === level ? null : level) : t))
  }

  function handleSubmit() {
    onSubmit({ url: initialUrl, browserInfo, timestamp: new Date().toISOString(),
      screenshots: screenshots.map((s, i) => ({ title: s.title, description: s.description, tag: tags[i] })) })
  }

  return (
    <>
      <style>{`.vbr-scroll::-webkit-scrollbar{display:none}`}</style>
      <div style={styles.container}>
        {/* Top bar */}
        <div style={styles.topBar}>
          <button style={styles.backBtn} onClick={onBack}>← Edit Annotations</button>
          <span style={styles.topBarTitle}>Review &amp; Submit</span>
        </div>

        {/* Scrollable content */}
        <div ref={scrollRef} className="vbr-scroll" style={styles.scroll}>

          {/* Screenshots: title + tag → description → image */}
          {screenshots.map((s, i) => (
            <div key={i} style={styles.screenshotBlock}>
              {screenshots.length > 1 && <div style={styles.screenshotIndex}>Screenshot {i + 1}</div>}

              {/* Title row with tag pills on the right */}
              <div style={styles.titleRow}>
                <div style={styles.titleText}>{s.title}</div>
                <div style={styles.tagPills}>
                  {TAG_CONFIG.map(t => (
                    <button
                      key={t.level}
                      title={t.label}
                      onClick={() => toggleTag(i, t.level)}
                      style={{
                        ...styles.tagPill,
                        color: t.color,
                        background: tags[i] === t.level ? t.bg : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${tags[i] === t.level ? t.color : 'rgba(255,255,255,0.1)'}`,
                      }}
                    >
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: t.color, display: 'inline-block', marginRight: 5 }} />
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {s.description && <div style={styles.descText}>{renderDescription(s.description)}</div>}
              <img src={s.dataUrl} alt={s.title} style={styles.image} />
            </div>
          ))}

          {/* Auto-collected metadata */}
          <div style={styles.metaSection}>
            <div style={styles.metaLabel}>Auto-collected</div>
            <MetadataDisplay url={initialUrl} browserInfo={browserInfo} />
          </div>

          {submitError && <div style={styles.errorBox}>{submitError}</div>}

          <button
            style={{ ...styles.submitBtn, opacity: isSubmitting ? 0.6 : 1 }}
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Submitting…' : 'Submit Report →'}
          </button>
        </div>
      </div>
    </>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex', flexDirection: 'column', height: '100vh',
    background: '#0f0f13', color: '#fff',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  topBar: {
    display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 20px',
    background: '#16161f', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0,
  },
  topBarTitle: { fontSize: '14px', fontWeight: '600', color: '#aaa' },
  backBtn: {
    background: 'none', border: '1px solid rgba(255,255,255,0.15)', color: '#aaa',
    borderRadius: '8px', padding: '6px 14px', fontSize: '13px', cursor: 'pointer',
  },
  scroll: {
    flex: 1, overflowY: 'auto', padding: '24px 32px',
    display: 'flex', flexDirection: 'column', gap: '28px',
    maxWidth: '720px', width: '100%', margin: '0 auto', boxSizing: 'border-box',
    scrollbarWidth: 'none',
  },
  screenshotBlock: { display: 'flex', flexDirection: 'column', gap: '8px' },
  titleRow: { display: 'flex', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' },
  tagPills: { display: 'flex', gap: '6px', flexShrink: 0, alignItems: 'center', paddingTop: '2px' },
  tagPill: {
    display: 'flex', alignItems: 'center', padding: '4px 10px',
    borderRadius: '20px', fontSize: '11px', fontWeight: '600', cursor: 'pointer',
    transition: 'all 0.15s', whiteSpace: 'nowrap',
  },
  screenshotIndex: {
    fontSize: '11px', fontWeight: '700', color: '#7B5CF0',
    textTransform: 'uppercase', letterSpacing: '0.08em',
  },
  titleText: { fontSize: '18px', fontWeight: '700', color: '#fff', lineHeight: 1.3 },
  descText: { fontSize: '14px', fontWeight: '400', color: '#aaa', lineHeight: 1.5 },
  image: { width: '100%', borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.5)', marginTop: '4px' },
  metaSection: { display: 'flex', flexDirection: 'column', gap: '8px' },
  metaLabel: {
    fontSize: '11px', fontWeight: '700', color: '#555',
    textTransform: 'uppercase', letterSpacing: '0.08em',
  },
  errorBox: {
    padding: '10px 14px', background: 'rgba(255,77,106,0.15)',
    border: '1px solid rgba(255,77,106,0.4)', borderRadius: '8px',
    fontSize: '13px', color: '#FF4D6A', lineHeight: 1.4,
  },
  submitBtn: {
    padding: '14px', background: 'linear-gradient(135deg, #5B3DE8, #7B5CF0)',
    color: '#fff', border: 'none', borderRadius: '10px', fontSize: '15px',
    fontWeight: '600', cursor: 'pointer',
  },
}
