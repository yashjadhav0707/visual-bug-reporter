export type TagLevel = 'high' | 'medium' | 'low'

export interface BrowserInfo {
  browser: string
  os: string
  viewport: string
  userAgent: string
}

export interface ScreenshotDetail {
  title: string
  description: string
  tag: TagLevel | null
}

export interface BugReport {
  url: string
  browserInfo: BrowserInfo
  timestamp: string
  screenshots: ScreenshotDetail[]
}
