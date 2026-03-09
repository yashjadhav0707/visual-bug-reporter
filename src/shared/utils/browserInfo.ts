import type { BrowserInfo } from '../types/bugReport'

export function collectBrowserInfo(): BrowserInfo {
  const ua = navigator.userAgent
  const viewport = `${window.screen.width}x${window.screen.height}`

  const browser = parseBrowser(ua)
  const os = parseOS(ua)

  return { browser, os, viewport, userAgent: ua }
}

function parseBrowser(ua: string): string {
  if (ua.includes('Edg/')) {
    const match = ua.match(/Edg\/([\d.]+)/)
    return `Edge ${match?.[1] ?? ''}`
  }
  if (ua.includes('Chrome/')) {
    const match = ua.match(/Chrome\/([\d.]+)/)
    return `Chrome ${match?.[1] ?? ''}`
  }
  if (ua.includes('Firefox/')) {
    const match = ua.match(/Firefox\/([\d.]+)/)
    return `Firefox ${match?.[1] ?? ''}`
  }
  if (ua.includes('Safari/') && !ua.includes('Chrome')) {
    const match = ua.match(/Version\/([\d.]+)/)
    return `Safari ${match?.[1] ?? ''}`
  }
  return 'Unknown Browser'
}

function parseOS(ua: string): string {
  if (ua.includes('Win')) return 'Windows'
  if (ua.includes('Mac OS X')) {
    const match = ua.match(/Mac OS X ([\d_]+)/)
    return `macOS ${match?.[1]?.replace(/_/g, '.') ?? ''}`
  }
  if (ua.includes('Linux')) return 'Linux'
  if (ua.includes('Android')) {
    const match = ua.match(/Android ([\d.]+)/)
    return `Android ${match?.[1] ?? ''}`
  }
  if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS'
  return 'Unknown OS'
}
