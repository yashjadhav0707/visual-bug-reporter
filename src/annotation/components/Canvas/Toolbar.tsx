import type { CanvasEngine } from './useCanvasEngine'

const COLORS = ['#FF0000', '#FF6B00', '#FFD700', '#00C851', '#00A8FF', '#A855F7', '#FF1493', '#fff', '#000']

interface Props { engine: CanvasEngine; onNext: () => void }

export function Toolbar({ engine, onNext }: Props) {
  const { activeTool, currentColor, strokeWidth, isFilled, canUndo, canRedo,
    setActiveTool, setColor, setStrokeWidth, setIsFilled, undo, redo, clearAll } = engine

  const showFillToggle = activeTool === 'rectangle' || activeTool === 'ellipse'

  return (
    <div style={styles.bar}>
      <div style={styles.group}>
        <ToolBtn label="Arrow" icon={<ArrowIcon />} active={activeTool === 'arrow'} onClick={() => setActiveTool('arrow')} />
        <ToolBtn label="Rectangle" icon={<RectIcon />} active={activeTool === 'rectangle'} onClick={() => setActiveTool('rectangle')} />
        <ToolBtn label="Ellipse" icon={<EllipseIcon />} active={activeTool === 'ellipse'} onClick={() => setActiveTool('ellipse')} />
        <ToolBtn label="Text" icon={<TextIcon />} active={activeTool === 'text'} onClick={() => setActiveTool('text')} />
        <ToolBtn label="Draw" icon={<PenIcon />} active={activeTool === 'freehand'} onClick={() => setActiveTool('freehand')} />
      </div>

      {showFillToggle && (
        <>
          <Divider />
          <div style={styles.group}>
            <button
              title={isFilled ? 'Filled' : 'Stroke only'}
              onClick={() => setIsFilled(!isFilled)}
              style={{
                ...styles.fillToggle,
                background: isFilled ? 'rgba(91,61,232,0.8)' : 'rgba(255,255,255,0.08)',
              }}
            >
              {isFilled ? <FillIcon /> : <StrokeIcon />}
              <span style={{ fontSize: '11px', marginLeft: '4px' }}>{isFilled ? 'Fill' : 'Stroke'}</span>
            </button>
          </div>
        </>
      )}

      <Divider />

      <div style={styles.group}>
        {COLORS.map(c => (
          <button key={c} title={c} onClick={() => setColor(c)} style={{
            ...styles.colorBtn, background: c,
            boxShadow: currentColor === c ? `0 0 0 2px #fff, 0 0 0 4px ${c}` : undefined,
          }} />
        ))}
      </div>

      <Divider />

      <div style={styles.group}>
        {[2, 4, 6].map(w => (
          <button key={w} title={`Stroke ${w}px`} onClick={() => setStrokeWidth(w)} style={{
            ...styles.strokeBtn,
            opacity: strokeWidth === w ? 1 : 0.4,
            background: strokeWidth === w ? 'rgba(255,255,255,0.15)' : 'none',
          }}>
            <div style={{ width: w * 2 + 6, height: w, background: '#fff', borderRadius: 99 }} />
          </button>
        ))}
      </div>

      <Divider />

      <div style={styles.group}>
        <ToolBtn label="Undo" icon={<UndoIcon />} active={false} disabled={!canUndo} onClick={undo} />
        <ToolBtn label="Redo" icon={<RedoIcon />} active={false} disabled={!canRedo} onClick={redo} />
        <ToolBtn label="Clear" icon={<TrashIcon />} active={false} onClick={clearAll} />
      </div>

      <div style={{ flex: 1 }} />

      <button style={styles.nextBtn} onClick={onNext}>Next: Fill Report →</button>
    </div>
  )
}

function ToolBtn({ label, icon, active, disabled, onClick }: {
  label: string; icon: React.ReactNode; active: boolean; disabled?: boolean; onClick: () => void
}) {
  return (
    <button title={label} onClick={onClick} disabled={disabled} style={{
      ...styles.toolBtn,
      background: active ? 'rgba(91,61,232,0.8)' : 'rgba(255,255,255,0.08)',
      opacity: disabled ? 0.3 : 1,
    }}>{icon}</button>
  )
}

function Divider() {
  return <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.12)', margin: '0 4px' }} />
}

function ArrowIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M14 7l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" /></svg>
}
function RectIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2" /></svg>
}
function EllipseIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><ellipse cx="12" cy="12" rx="9" ry="6" stroke="currentColor" strokeWidth="2" /></svg>
}
function TextIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 7V5h16v2M9 20h6M12 5v15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
}
function PenIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
}
function UndoIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M3 10h10a5 5 0 0 1 0 10H7M3 10l4-4M3 10l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
}
function RedoIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M21 10H11a5 5 0 0 0 0 10h6M21 10l-4-4M21 10l-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
}
function TrashIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
}
function FillIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="5" width="18" height="14" rx="2" /></svg>
}
function StrokeIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2" /></svg>
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px',
    background: '#1e1e2e', borderBottom: '1px solid rgba(255,255,255,0.08)',
    flexShrink: 0, flexWrap: 'wrap',
  },
  group: { display: 'flex', alignItems: 'center', gap: '4px' },
  toolBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: '32px', height: '32px', border: 'none', borderRadius: '6px',
    color: '#fff', cursor: 'pointer', transition: 'background 0.1s',
  },
  fillToggle: {
    display: 'flex', alignItems: 'center', height: '32px', padding: '0 10px',
    border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer',
    transition: 'background 0.1s',
  },
  colorBtn: {
    width: '20px', height: '20px', borderRadius: '50%',
    border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer',
    transition: 'box-shadow 0.1s', flexShrink: 0,
  },
  strokeBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: '32px', height: '32px', border: 'none', borderRadius: '6px',
    cursor: 'pointer', transition: 'background 0.1s',
  },
  nextBtn: {
    padding: '8px 18px', background: 'linear-gradient(135deg, #5B3DE8, #7B5CF0)',
    color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px',
    fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap',
  },
}
