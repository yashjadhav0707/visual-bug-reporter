import type { BrowserInfo } from '../../../shared/types/bugReport'

interface Props {
  url: string
  browserInfo: BrowserInfo
}

export function MetadataDisplay({ url, browserInfo }: Props) {
  return (
    <div style={styles.container}>
      <Row label="URL" value={url} />
      <Row label="Browser" value={browserInfo.browser} />
      <Row label="OS" value={browserInfo.os} />
      <Row label="Viewport" value={browserInfo.viewport} />
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.row}>
      <span style={styles.label}>{label}</span>
      <span style={styles.value} title={value}>{value}</span>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '8px',
    padding: '10px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  row: {
    display: 'flex',
    gap: '10px',
  },
  label: {
    color: '#666',
    fontSize: '12px',
    minWidth: '60px',
    flexShrink: 0,
  },
  value: {
    color: '#bbb',
    fontSize: '12px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
}
