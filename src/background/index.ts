import type {
  CaptureScreenshotResponse,
  AddScreenshotResponse,
  GetSessionResponse,
  SubmitBugReportMessage,
  SubmitBugReportResponse,
} from '../shared/types/messages'
import { uploadToImgBB } from '../shared/api/imgbb'
import { createGoogleDoc } from '../shared/api/googleDocs'

const MAX_SCREENSHOTS = 10

interface ActiveSession {
  annotationTabId: number
  keys: string[]
}

chrome.runtime.onMessage.addListener(
  (
    message: { type: string; payload?: unknown },
    _sender,
    sendResponse: (r: unknown) => void
  ) => {
    if (message.type === 'CAPTURE_SCREENSHOT') {
      handleCapture().then(sendResponse).catch((err: unknown) => {
        sendResponse({ success: false, error: String(err) })
      })
      return true
    }

    if (message.type === 'ADD_SCREENSHOT') {
      handleAddScreenshot().then(sendResponse).catch((err: unknown) => {
        sendResponse({ success: false, error: String(err) })
      })
      return true
    }

    if (message.type === 'GET_SESSION') {
      handleGetSession().then(sendResponse).catch(() => {
        sendResponse({ hasSession: false })
      })
      return true
    }

    if (message.type === 'CLEAR_SESSION') {
      handleClearSession().then(() => sendResponse({ success: true })).catch(() => {
        sendResponse({ success: false })
      })
      return true
    }

    if (message.type === 'SUBMIT_BUG_REPORT') {
      const msg = message as SubmitBugReportMessage
      handleSubmit(msg.payload).then(sendResponse).catch((err: unknown) => {
        sendResponse({ success: false, error: String(err) })
      })
      return true
    }

    return false
  }
)

// Clear session when annotation tab is closed by the user
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const stored = await chrome.storage.local.get('activeSession')
  const session = stored['activeSession'] as ActiveSession | undefined
  if (session && session.annotationTabId === tabId) {
    await chrome.storage.local.remove('activeSession')
  }
})

async function handleCapture(): Promise<CaptureScreenshotResponse> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

  if (!tab?.windowId) {
    return { success: false, error: 'No active tab found' }
  }

  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' })
  const key = `screenshot_${Date.now()}`
  await chrome.storage.local.set({
    [key]: dataUrl,
    [`${key}_url`]: tab.url ?? '',
  })

  const annotationTab = await chrome.tabs.create({
    url: `${chrome.runtime.getURL('src/annotation/index.html')}#${key}`,
  })

  if (!annotationTab.id) {
    return { success: false, error: 'Failed to open annotation tab' }
  }

  // Store the active session so the popup can detect it
  await chrome.storage.local.set({
    activeSession: {
      annotationTabId: annotationTab.id,
      keys: [key],
    } satisfies ActiveSession,
  })

  return { success: true }
}

async function handleAddScreenshot(): Promise<AddScreenshotResponse> {
  const stored = await chrome.storage.local.get('activeSession')
  const session = stored['activeSession'] as ActiveSession | undefined

  if (!session) {
    return { success: false, error: 'No active annotation session.' }
  }

  if (session.keys.length >= MAX_SCREENSHOTS) {
    return { success: false, error: `Maximum ${MAX_SCREENSHOTS} screenshots reached.` }
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.windowId) return { success: false, error: 'No active tab found' }

  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' })
  const key = `screenshot_${Date.now()}`
  await chrome.storage.local.set({
    [key]: dataUrl,
    [`${key}_url`]: tab.url ?? '',
  })

  // Update session with the new key
  const updatedSession: ActiveSession = {
    ...session,
    keys: [...session.keys, key],
  }
  await chrome.storage.local.set({ activeSession: updatedSession })

  // Notify the annotation tab about the new screenshot
  try {
    await chrome.tabs.sendMessage(session.annotationTabId, {
      type: 'SCREENSHOT_ADDED',
      dataUrl,
      tabUrl: tab.url ?? '',
    })
  } catch {
    // Annotation tab may have closed; session already cleaned up by onRemoved
  }

  // Focus the annotation tab so the user sees the new screenshot
  await chrome.tabs.update(session.annotationTabId, { active: true })

  return { success: true, key, dataUrl, tabUrl: tab.url ?? '' }
}

async function handleGetSession(): Promise<GetSessionResponse> {
  const stored = await chrome.storage.local.get('activeSession')
  const session = stored['activeSession'] as ActiveSession | undefined

  if (!session) return { hasSession: false }

  // Verify the tab still exists
  try {
    await chrome.tabs.get(session.annotationTabId)
    return {
      hasSession: true,
      screenshotCount: session.keys.length,
      annotationTabId: session.annotationTabId,
    }
  } catch {
    await chrome.storage.local.remove('activeSession')
    return { hasSession: false }
  }
}

async function handleClearSession(): Promise<void> {
  const stored = await chrome.storage.local.get('activeSession')
  const session = stored['activeSession'] as ActiveSession | undefined
  if (session) {
    try {
      await chrome.tabs.remove(session.annotationTabId)
    } catch {
      // Tab already closed
    }
    await chrome.storage.local.remove('activeSession')
  }
}

async function handleSubmit(
  payload: SubmitBugReportMessage['payload']
): Promise<SubmitBugReportResponse> {
  const { screenshots, bugReport, config } = payload

  if (!config.googleScriptUrl) {
    return { success: false, error: 'Please configure your Google Apps Script URL in Settings.' }
  }

  if (!config.imgbbApiKey) {
    return { success: false, error: 'ImgBB API key is missing. Please open Settings.' }
  }

  // Upload all screenshots to ImgBB (in parallel)
  const imageUrls = await Promise.all(
    screenshots.map(s => uploadToImgBB(s.annotatedImageBase64, config.imgbbApiKey))
  )

  // Attach uploaded URLs to screenshot entries
  const screenshotsWithUrls = screenshots.map((s, i) => ({
    title: s.title,
    description: s.description,
    tag: s.tag,
    imageUrl: imageUrls[i],
  }))

  let commentId = ''
  const commentUrl = await createGoogleDoc(screenshotsWithUrls, bugReport, config)

  // Clear the active session
  await chrome.storage.local.remove('activeSession')

  return { success: true, commentId, commentUrl }
}
