import { useEffect, useRef, useState } from 'react'

interface Props {
  value: string
  onChange: (html: string) => void
  placeholder?: string
}

export function RichDescription({ value, onChange, placeholder }: Props) {
  const editorRef = useRef<HTMLDivElement>(null)
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const savedRangeRef = useRef<Range | null>(null)
  const linkInputRef = useRef<HTMLInputElement>(null)

  // Initialize content on mount (component remounts via key={activeIndex} on screenshot switch)
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = value || ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (showLinkInput) setTimeout(() => linkInputRef.current?.focus(), 50)
  }, [showLinkInput])

  function emitChange() {
    if (!editorRef.current) return
    let html = editorRef.current.innerHTML
    if (html === '<br>' || html === '<div><br></div>') html = ''
    onChange(html)
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    const isUrl = /^https?:\/\/\S+$/.test(text.trim())

    if (isUrl) {
      const url = text.trim()
      const sel = window.getSelection()
      const hasSelection = sel && sel.rangeCount > 0 && !sel.getRangeAt(0).collapsed

      if (hasSelection) {
        // Text is selected + pasting a URL → wrap selected text as a link
        const selectedText = sel!.getRangeAt(0).toString()
        const range = sel!.getRangeAt(0)
        range.deleteContents()
        const a = document.createElement('a')
        a.href = url
        a.target = '_blank'
        a.rel = 'noopener noreferrer'
        a.style.color = '#7B5CF0'
        a.style.textDecoration = 'underline'
        a.textContent = selectedText
        range.insertNode(a)
        const newRange = document.createRange()
        newRange.setStartAfter(a)
        newRange.collapse(true)
        sel!.removeAllRanges()
        sel!.addRange(newRange)
      } else {
        // No selection → insert URL as a clickable link
        document.execCommand('insertHTML', false,
          `<a href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer" style="color:#7B5CF0;text-decoration:underline">${escapeHtml(url)}</a>`)
      }
    } else {
      document.execCommand('insertText', false, text)
    }
    emitChange()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      openLinkInput()
    }
  }

  function openLinkInput() {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || !editorRef.current?.contains(sel.getRangeAt(0).commonAncestorContainer)) {
      editorRef.current?.focus()
      return
    }
    savedRangeRef.current = sel.getRangeAt(0).cloneRange()
    setLinkUrl('')
    setShowLinkInput(true)
  }

  function applyLink() {
    const url = linkUrl.trim()
    if (!url) { cancelLink(); return }
    const fullUrl = /^https?:\/\//.test(url) ? url : `https://${url}`

    const sel = window.getSelection()
    if (sel && savedRangeRef.current) {
      editorRef.current?.focus()
      sel.removeAllRanges()
      sel.addRange(savedRangeRef.current)

      if (savedRangeRef.current.collapsed) {
        document.execCommand('insertHTML', false,
          `<a href="${escapeAttr(fullUrl)}" target="_blank" rel="noopener noreferrer" style="color:#7B5CF0;text-decoration:underline">${escapeHtml(fullUrl)}</a>`)
      } else {
        const selectedText = savedRangeRef.current.toString()
        savedRangeRef.current.deleteContents()
        const a = document.createElement('a')
        a.href = fullUrl
        a.target = '_blank'
        a.rel = 'noopener noreferrer'
        a.style.color = '#7B5CF0'
        a.style.textDecoration = 'underline'
        a.textContent = selectedText
        savedRangeRef.current.insertNode(a)
        const newRange = document.createRange()
        newRange.setStartAfter(a)
        newRange.collapse(true)
        sel.removeAllRanges()
        sel.addRange(newRange)
      }
    }

    setShowLinkInput(false)
    savedRangeRef.current = null
    emitChange()
  }

  function cancelLink() {
    setShowLinkInput(false)
    savedRangeRef.current = null
    editorRef.current?.focus()
  }

  return (
    <div style={styles.wrapper}>
      <div style={{ position: 'relative' }}>
        <div
          ref={editorRef}
          contentEditable
          onInput={emitChange}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          style={styles.editor}
        />
        {!value && <div style={styles.placeholder}>{placeholder}</div>}
      </div>

      {showLinkInput && (
        <div style={styles.linkBar}>
          <input
            ref={linkInputRef}
            value={linkUrl}
            onChange={e => setLinkUrl(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); applyLink() }
              if (e.key === 'Escape') cancelLink()
              e.stopPropagation()
            }}
            placeholder="https://…"
            style={styles.linkUrlInput}
          />
          <button onClick={applyLink} style={styles.applyBtn}>Insert</button>
          <button onClick={cancelLink} style={styles.cancelBtn}>×</button>
        </div>
      )}
    </div>
  )
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: { position: 'relative' },
  editor: {
    minHeight: '38px', padding: '7px 10px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px',
    color: '#fff', fontSize: '12px', outline: 'none',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    lineHeight: '1.5', overflowWrap: 'break-word', wordBreak: 'break-word',
    whiteSpace: 'pre-wrap',
  },
  placeholder: {
    position: 'absolute', top: '7px', left: '10px',
    color: '#666', fontSize: '12px', pointerEvents: 'none',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  linkBar: {
    display: 'flex', alignItems: 'center', gap: '6px',
    marginTop: '4px', padding: '6px 8px',
    background: 'rgba(91,61,232,0.15)', border: '1px solid rgba(91,61,232,0.3)',
    borderRadius: '6px',
  },
  linkUrlInput: {
    flex: 1, padding: '4px 8px',
    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '4px', color: '#fff', fontSize: '12px', outline: 'none',
    fontFamily: 'inherit',
  },
  applyBtn: {
    padding: '4px 10px', background: '#5B3DE8', color: '#fff',
    border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: '600',
    cursor: 'pointer', whiteSpace: 'nowrap',
  },
  cancelBtn: {
    padding: '4px 6px', background: 'none', border: 'none',
    color: '#888', fontSize: '14px', cursor: 'pointer',
  },
}
