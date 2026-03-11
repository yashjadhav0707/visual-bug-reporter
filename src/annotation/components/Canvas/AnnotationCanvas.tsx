import { useEffect, useRef } from 'react'
import type { CanvasEngine } from './useCanvasEngine'

interface Props { engine: CanvasEngine }

export function AnnotationCanvas({ engine }: Props) {
  const { canvasRef, activeTool, isHoveringShape, textInput, selectedShapeId, commitTextInput, cancelTextInput, deleteSelected, notifyCanvasMounted, onMouseDown, onMouseMove, onMouseUp, onDoubleClick } = engine

  useEffect(() => { notifyCanvasMounted() }, [notifyCanvasMounted])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (engine.textInput) return
      const active = document.activeElement
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedShapeId) {
        e.preventDefault()
        deleteSelected()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [engine.textInput, selectedShapeId, deleteSelected])

  const cursor = isHoveringShape ? 'move' : activeTool === 'text' ? 'text' : 'crosshair'

  return (
    <div style={styles.wrapper}>
      <canvas
        ref={canvasRef}
        style={{ ...styles.canvas, cursor }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onDoubleClick={onDoubleClick}
      />

      {/* Blocks canvas events while text input is active */}
      {textInput && <div style={styles.textBlocker} />}

      {textInput && (
        <TextInputOverlay
          engine={engine}
          onCommit={commitTextInput}
          onCancel={cancelTextInput}
        />
      )}
    </div>
  )
}

function TextInputOverlay({ engine, onCommit, onCancel }: {
  engine: CanvasEngine
  onCommit: (text: string) => void
  onCancel: () => void
}) {
  const { canvasRef, textInput, currentColor } = engine
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // More reliable than autoFocus in extension context
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  if (!textInput) return null
  const canvas = canvasRef.current
  if (!canvas) return null

  const rect = canvas.getBoundingClientRect()
  const scaleX = rect.width / canvas.width
  const scaleY = rect.height / canvas.height
  const left = rect.left + textInput.position.x * scaleX
  const top = rect.top + textInput.position.y * scaleY

  return (
    <input
      ref={inputRef}
      defaultValue={textInput.value}
      style={{
        position: 'fixed', left, top,
        minWidth: '140px', padding: '8px',
        background: currentColor, color: '#fff',
        border: '2px solid rgba(255,255,255,0.5)',
        borderRadius: '4px', fontSize: '15px', fontWeight: '600',
        outline: 'none', zIndex: 200,
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
      }}
      placeholder="Type here, press Enter"
      onKeyDown={e => {
        if (e.key === 'Enter') onCommit((e.target as HTMLInputElement).value)
        if (e.key === 'Escape') onCancel()
        e.stopPropagation()
      }}
      onBlur={e => onCommit(e.target.value)}
    />
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    position: 'relative', flex: 1, overflow: 'auto',
    background: '#1a1a1a', display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
  },
  canvas: { maxWidth: '100%', display: 'block', userSelect: 'none' },
  textBlocker: {
    position: 'fixed', inset: 0, zIndex: 199, cursor: 'default',
  },
}
