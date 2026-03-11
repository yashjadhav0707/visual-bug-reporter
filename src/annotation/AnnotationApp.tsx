import { useCallback, useEffect, useRef, useState } from 'react'
import type { AnnotationShape } from '../shared/types/annotation'
import type { BugReport } from '../shared/types/bugReport'
import type { ScreenshotPayload, SubmitBugReportResponse } from '../shared/types/messages'
import { collectBrowserInfo } from '../shared/utils/browserInfo'
import { getAppConfig } from '../shared/utils/storage'
import { useScreenshot } from './hooks/useScreenshot'
import { useCanvasEngine, drawShape } from './components/Canvas/useCanvasEngine'
import { AnnotationCanvas } from './components/Canvas/AnnotationCanvas'
import { Toolbar } from './components/Canvas/Toolbar'
import { BugForm } from './components/BugForm/BugForm'
import { RichDescription } from './components/RichDescription'

const MAX_SCREENSHOTS = 10

type Phase = 'loading' | 'annotating' | 'filling-form' | 'submitting' | 'success' | 'error'

interface ScreenshotEntry {
  dataUrl: string
  tabUrl: string
  shapes: AnnotationShape[]
  title: string
  description: string
  // tag is set in the review form (BugForm), not here
}

function renderAnnotated(dataUrl: string, shapes: AnnotationShape[]): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      for (const shape of shapes) drawShape(ctx, shape)
      resolve(canvas.toDataURL('image/png'))
    }
    img.src = dataUrl
  })
}

export function AnnotationApp() {
  const { screenshot, loading, error: screenshotError } = useScreenshot()

  const [screenshots, setScreenshots] = useState<ScreenshotEntry[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('loading')
  const [renderedScreenshots, setRenderedScreenshots] = useState<ScreenshotPayload[]>([])
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [commentUrl, setCommentUrl] = useState<string | null>(null)
  const [showAddHint, setShowAddHint] = useState(false)

  const engine = useCanvasEngine(screenshots[activeIndex]?.dataUrl ?? null)
  const activeIndexRef = useRef(activeIndex)
  useEffect(() => { activeIndexRef.current = activeIndex }, [activeIndex])

  useEffect(() => {
    if (!loading && screenshotError === null && screenshot && phase === 'loading') {
      setScreenshots([{ dataUrl: screenshot.dataUrl, tabUrl: screenshot.tabUrl, shapes: [], title: '', description: '' }])
      setPhase('annotating')
    }
  }, [loading, screenshotError, screenshot, phase])

  useEffect(() => {
    const listener = (message: { type: string; dataUrl?: string; tabUrl?: string }) => {
      if (message.type !== 'SCREENSHOT_ADDED' || !message.dataUrl) return
      setScreenshots(prev => {
        if (prev.length >= MAX_SCREENSHOTS) return prev
        const updated = [...prev, { dataUrl: message.dataUrl!, tabUrl: message.tabUrl ?? '', shapes: [], title: '', description: '' }]
        // Auto-switch to the newly added screenshot
        const newIndex = updated.length - 1
        // Save current shapes before switching
        const currentShapes = engine.getShapes()
        setScreenshots(p => p.map((s, i) => i === activeIndexRef.current ? { ...s, shapes: currentShapes } : s))
        engine.loadShapes([])
        setActiveIndex(newIndex)
        return updated
      })
    }
    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine])

  const switchToScreenshot = useCallback((newIndex: number) => {
    if (newIndex === activeIndexRef.current) return
    const currentShapes = engine.getShapes()
    setScreenshots(prev => prev.map((s, i) =>
      i === activeIndexRef.current ? { ...s, shapes: currentShapes } : s
    ))
    engine.loadShapes(screenshots[newIndex]?.shapes ?? [])
    setActiveIndex(newIndex)
  }, [engine, screenshots])

  function removeScreenshot(index: number) {
    if (screenshots.length <= 1) return
    const newList = screenshots.filter((_, i) => i !== index)
    let newActive = activeIndex
    if (index === activeIndex) {
      newActive = index >= newList.length ? newList.length - 1 : index
      engine.loadShapes(newList[newActive]?.shapes ?? [])
    } else if (index < activeIndex) {
      newActive = activeIndex - 1
    }
    setScreenshots(newList)
    setActiveIndex(newActive)
  }

  function updateActiveField(field: 'title' | 'description', value: string) {
    setScreenshots(prev => prev.map((s, i) => i === activeIndex ? { ...s, [field]: value } : s))
    setValidationError(null)
  }

  async function handleNext() {
    // Save current shapes
    const currentShapes = engine.getShapes()
    const updatedScreenshots = screenshots.map((s, i) =>
      i === activeIndex ? { ...s, shapes: currentShapes } : s
    )

    // Validate: every screenshot must have a title
    const missing = updatedScreenshots.findIndex(s => !s.title.trim())
    if (missing !== -1) {
      setValidationError(`Screenshot ${missing + 1} needs a title before continuing.`)
      if (missing !== activeIndex) switchToScreenshot(missing)
      return
    }

    setScreenshots(updatedScreenshots)
    setValidationError(null)

    const rendered = await Promise.all(
      updatedScreenshots.map((s, i) =>
        i === activeIndex
          ? Promise.resolve(engine.getAnnotatedDataUrl())
          : renderAnnotated(s.dataUrl, s.shapes)
      )
    )

    const payloads: ScreenshotPayload[] = updatedScreenshots.map((s, i) => ({
      title: s.title.trim(),
      description: s.description.trim(),
      tag: null,  // set by user in the review form
      annotatedImageBase64: rendered[i].replace(/^data:image\/\w+;base64,/, ''),
    }))

    setRenderedScreenshots(payloads)
    setPhase('filling-form')
  }

  async function handleSubmit(bugReport: BugReport) {
    setPhase('submitting')
    setSubmitError(null)

    try {
      const config = await getAppConfig()

      // BugForm passes back updated screenshots (with per-screenshot tags) via bugReport.screenshots
      const screenshotsWithTags = renderedScreenshots.map((s, i) => ({
        ...s,
        tag: bugReport.screenshots[i]?.tag ?? null,
      }))

      const response = await chrome.runtime.sendMessage({
        type: 'SUBMIT_BUG_REPORT',
        payload: { screenshots: screenshotsWithTags, bugReport, config },
      }) as SubmitBugReportResponse

      if (response.success) {
        setCommentUrl(response.commentUrl ?? null)
        setPhase('success')
      } else {
        setSubmitError(response.error ?? 'Submission failed')
        setPhase('filling-form')
      }
    } catch (err) {
      setSubmitError(String(err))
      setPhase('filling-form')
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading || phase === 'loading') return <LoadingScreen message="Loading screenshot…" />
  if (screenshotError) return <ErrorScreen message={screenshotError} />
  if (phase === 'success') return <SuccessScreen commentUrl={commentUrl} />

  if (phase === 'filling-form' || phase === 'submitting') {
    const browserInfo = collectBrowserInfo()
    return (
      <BugForm
        initialUrl={screenshots[0]?.tabUrl ?? ''}
        browserInfo={browserInfo}
        screenshots={renderedScreenshots.map((s, i) => ({
          title: s.title,
          description: s.description,
          dataUrl: `data:image/png;base64,${s.annotatedImageBase64}`,
          index: i,
        }))}
        isSubmitting={phase === 'submitting'}
        submitError={submitError}
        onBack={() => setPhase('annotating')}
        onSubmit={handleSubmit}
      />
    )
  }

  // Annotating phase
  const active = screenshots[activeIndex]

  return (
    <div style={styles.app}>
      <Toolbar engine={engine} onNext={handleNext} />

      {/* Screenshot strip */}
      <div style={styles.strip}>
        {screenshots.map((s, i) => (
          <div key={i} style={styles.stripItem}>
            <button
              style={{
                ...styles.stripThumb,
                outline: i === activeIndex ? '2px solid #7B5CF0' : '2px solid transparent',
              }}
              onClick={() => switchToScreenshot(i)}
              title={s.title || `Screenshot ${i + 1}`}
            >
              <img src={s.dataUrl} style={styles.stripImg} alt="" />
              <span style={styles.stripNum}>{i + 1}</span>
              {s.title ? null : <span style={styles.stripMissingDot} title="Title required" />}
            </button>
            {screenshots.length > 1 && (
              <button style={styles.stripRemove} onClick={() => removeScreenshot(i)} title="Remove">×</button>
            )}
          </div>
        ))}
        {screenshots.length < MAX_SCREENSHOTS && (
          <button style={styles.stripAdd} onClick={() => setShowAddHint(h => !h)} title="Add screenshot">+</button>
        )}
        <span style={styles.stripCount}>{screenshots.length}/{MAX_SCREENSHOTS}</span>
      </div>

      {/* Add hint */}
      {showAddHint && (
        <div style={styles.addHint}>
          <span>📸 Navigate to any tab, then click the extension icon → <strong>Add to report</strong></span>
          <button style={styles.addHintClose} onClick={() => setShowAddHint(false)}>×</button>
        </div>
      )}

      {/* Per-screenshot title + description */}
      <div style={styles.metaPanel}>
        <input
          style={styles.titleInput}
          placeholder={`Screenshot ${activeIndex + 1} title (required) — e.g. "Login button overlapping nav"`}
          value={active?.title ?? ''}
          onChange={e => updateActiveField('title', e.target.value)}
          maxLength={120}
        />
        <RichDescription
          key={activeIndex}
          value={active?.description ?? ''}
          onChange={html => updateActiveField('description', html)}
          placeholder="Describe what's wrong… (⌘K to add link)"
        />
        {validationError && <div style={styles.validationError}>{validationError}</div>}
      </div>

      <AnnotationCanvas engine={engine} />
    </div>
  )
}

// ─── Sub-screens ──────────────────────────────────────────────────────────────

function LoadingScreen({ message }: { message: string }) {
  return <div style={centeredStyle}><div style={{ fontSize: '14px', color: '#888' }}>{message}</div></div>
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div style={centeredStyle}>
      <div style={{ fontSize: '32px', marginBottom: '16px' }}>⚠️</div>
      <div style={{ fontSize: '15px', color: '#FF4D6A', maxWidth: '360px', textAlign: 'center' }}>{message}</div>
    </div>
  )
}

function SuccessScreen({ commentUrl }: { commentUrl: string | null }) {
  const linkLabel = commentUrl?.includes('docs.google.com')
    ? 'View in Google Docs →'
    : 'View Report →'

  return (
    <div style={centeredStyle}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
      <div style={{ fontSize: '18px', fontWeight: '700', color: '#fff', marginBottom: '8px' }}>Bug reported!</div>
      <div style={{ fontSize: '14px', color: '#888', marginBottom: '24px' }}>Your report has been submitted successfully.</div>
      {commentUrl && (
        <a href={commentUrl} target="_blank" rel="noopener noreferrer" style={{
          padding: '10px 24px', background: 'linear-gradient(135deg, #5B3DE8, #7B5CF0)',
          color: '#fff', borderRadius: '8px', fontSize: '14px', fontWeight: '600', textDecoration: 'none',
        }}>{linkLabel}</a>
      )}
      <button onClick={() => window.close()} style={{ marginTop: '12px', background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '13px' }}>
        Close tab
      </button>
    </div>
  )
}

const centeredStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  height: '100vh', background: '#0f0f13', color: '#fff',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
}

const styles: Record<string, React.CSSProperties> = {
  app: { display: 'flex', flexDirection: 'column', height: '100vh', background: '#0f0f13', overflow: 'hidden' },
  strip: {
    display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px',
    background: '#16161f', borderBottom: '1px solid rgba(255,255,255,0.06)',
    flexShrink: 0, overflowX: 'auto',
  },
  stripItem: { position: 'relative', flexShrink: 0 },
  stripThumb: {
    position: 'relative', width: '72px', height: '48px', borderRadius: '6px',
    overflow: 'hidden', border: 'none', padding: 0, cursor: 'pointer',
    background: '#2a2a3e', display: 'block',
  },
  stripImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  stripNum: {
    position: 'absolute', bottom: '3px', right: '4px', fontSize: '10px', fontWeight: '700',
    color: '#fff', background: 'rgba(0,0,0,0.6)', borderRadius: '3px', padding: '1px 4px',
  },
  stripMissingDot: {
    position: 'absolute', top: '4px', left: '4px', width: '8px', height: '8px',
    borderRadius: '50%', background: '#FF4D6A', display: 'block',
  },
  stripRemove: {
    position: 'absolute', top: '-4px', right: '-4px', width: '16px', height: '16px',
    borderRadius: '50%', background: '#FF4D6A', color: '#fff', border: 'none',
    fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center',
    justifyContent: 'center', lineHeight: 1, padding: 0,
  },
  stripAdd: {
    width: '72px', height: '48px', borderRadius: '6px', border: '1px dashed rgba(255,255,255,0.2)',
    background: 'none', color: '#888', fontSize: '20px', cursor: 'pointer', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  stripCount: { fontSize: '11px', color: '#555', marginLeft: '4px', flexShrink: 0, whiteSpace: 'nowrap' },
  addHint: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
    padding: '8px 16px', background: 'rgba(91,61,232,0.15)',
    borderBottom: '1px solid rgba(91,61,232,0.3)', fontSize: '12px', color: '#c4b5fd', flexShrink: 0,
  },
  addHintClose: { background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '16px', padding: '0 4px', flexShrink: 0 },
  metaPanel: {
    display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px 12px',
    background: '#12121a', borderBottom: '1px solid rgba(255,255,255,0.06)',
    flexShrink: 0,
  },
  titleInput: {
    padding: '7px 10px', background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff',
    fontSize: '13px', outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
  },
  descInput: {
    padding: '7px 10px', background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff',
    fontSize: '12px', outline: 'none', fontFamily: 'inherit', resize: 'none',
    width: '100%', boxSizing: 'border-box',
  },
  validationError: {
    fontSize: '11px', color: '#FF4D6A', padding: '4px 8px',
    background: 'rgba(255,77,106,0.1)', borderRadius: '4px',
  },
}
