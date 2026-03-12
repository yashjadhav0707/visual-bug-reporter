import type { BugReport, TagLevel } from '../types/bugReport'
import type { AppConfig } from '../types/config'

const TAG_LABEL: Record<TagLevel, string> = { high: '🔴 High', medium: '🟡 Medium', low: '🔵 Low' }

interface DescriptionLink {
  text: string
  url: string
  start: number
  end: number
}

/** Parse an HTML description into plain text + link positions for Google Docs setLinkUrl().
 *  Uses regex instead of DOM because this runs in a service worker (no document). */
function parseDescriptionHtml(html: string): { text: string; links: DescriptionLink[] } {
  if (!html || !html.includes('<')) return { text: html || '', links: [] }

  const links: DescriptionLink[] = []

  // Strip <div>/<p> open/close → newlines, <br> → newline
  let normalized = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:div|p)>/gi, '\n')
    .replace(/<(?:div|p)(?:\s[^>]*)?>/gi, '')

  // Extract <a> tags: capture href and inner text, replace with just the text
  let text = ''
  const anchorRe = /<a\s[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = anchorRe.exec(normalized)) !== null) {
    // Append text before this anchor
    const before = normalized.slice(lastIndex, match.index)
    text += stripTags(before)

    const url = match[1]
    const linkText = stripTags(match[2])
    const start = text.length
    text += linkText
    const end = text.length - 1

    if (url && end >= start) {
      links.push({ text: linkText, url, start, end })
    }

    lastIndex = match.index + match[0].length
  }

  // Append any remaining text after last anchor
  text += stripTags(normalized.slice(lastIndex))

  // Collapse multiple newlines and trim
  text = text.replace(/\n{3,}/g, '\n\n').trim()

  return { text, links }
}

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, '')
}

export async function createGoogleDoc(
  screenshots: { title: string; description: string; tag: TagLevel | null; imageUrl: string }[],
  bugReport: BugReport,
  config: AppConfig,
): Promise<string> {
  const firstTag = screenshots[0]?.tag
  const tagText = firstTag ? `[${TAG_LABEL[firstTag]}] ` : ''
  const reportTitle = `${tagText}${screenshots[0]?.title ?? 'Bug Report'}`

  // Parse HTML descriptions into plain text + structured link data
  const processedScreenshots = screenshots.map(s => {
    const { text, links } = parseDescriptionHtml(s.description)
    return { ...s, description: text, descriptionLinks: links }
  })

  const payload = {
    title: reportTitle,
    screenshots: processedScreenshots,
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
