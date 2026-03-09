import type { BugReport, TagLevel } from '../types/bugReport'
import type { AppConfig } from '../types/config'

const TAG_LABEL: Record<TagLevel, string> = { high: '🔴 High', medium: '🟡 Medium', low: '🔵 Low' }

export async function createGoogleDoc(
  screenshots: { title: string; description: string; tag: TagLevel | null; imageUrl: string }[],
  bugReport: BugReport,
  config: AppConfig,
): Promise<string> {
  const firstTag = screenshots[0]?.tag
  const tagText = firstTag ? `[${TAG_LABEL[firstTag]}] ` : ''
  const reportTitle = `${tagText}${screenshots[0]?.title ?? 'Bug Report'}`

  const payload = {
    title: reportTitle,
    screenshots,
    url: bugReport.url,
    browser: bugReport.browserInfo.browser,
    os: bugReport.browserInfo.os,
    viewport: bugReport.browserInfo.viewport,
    timestamp: bugReport.timestamp,
    docUrl: config.googleDocUrl || '',
  }

  let response: Response
  try {
    // Use text/plain to avoid CORS preflight — Apps Script doesn't whitelist
    // chrome-extension:// origins for OPTIONS requests. text/plain is a "simple request"
    // that skips the preflight. The body is still valid JSON parsed by e.postData.contents.
    response = await fetch(config.googleScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow',
    })
  } catch (err) {
    throw new Error(`Could not reach Apps Script: ${String(err)}. Verify the URL in Settings and that the script is deployed as "Anyone".`)
  }

  if (!response.ok) {
    throw new Error(`Apps Script error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json() as { success: boolean; docUrl?: string; error?: string }
  if (!data.success) throw new Error(data.error ?? 'Apps Script returned an error')

  return data.docUrl ?? ''
}
