import type { BugReport, TagLevel } from '../types/bugReport'
import type { AppConfig } from '../types/config'

const TAG_LABEL: Record<TagLevel, string> = { high: '🔴 High', medium: '🟡 Medium', low: '🔵 Low' }

interface DescriptionLink {
  text: string
  url: string
  start: number
  end: number
}

/** Parse an HTML description into plain text + link positions for Google Docs setLinkUrl() */
function parseDescriptionHtml(html: string): { text: string; links: DescriptionLink[] } {
  if (!html || !html.includes('<')) return { text: html || '', links: [] }

  const links: DescriptionLink[] = []
  let text = ''

  // Use a temporary element to walk the HTML
  const el = document.createElement('div')
  el.innerHTML = html

  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent || ''
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = (node as Element).tagName.toLowerCase()
      if (tag === 'a') {
        const href = (node as HTMLAnchorElement).href
        const start = text.length
        // Walk children to get the link text
        node.childNodes.forEach(walk)
        const end = text.length - 1
        if (href && end >= start) {
          links.push({ text: text.slice(start, end + 1), url: href, start, end })
        }
      } else if (tag === 'br') {
        text += '\n'
      } else if (tag === 'div' || tag === 'p') {
        if (text.length > 0 && !text.endsWith('\n')) text += '\n'
        node.childNodes.forEach(walk)
      } else {
        node.childNodes.forEach(walk)
      }
    }
  }

  el.childNodes.forEach(walk)
  return { text: text.trim(), links }
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
