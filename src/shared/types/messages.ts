import type { BugReport, TagLevel } from './bugReport'
import type { AppConfig } from './config'

export interface CaptureScreenshotMessage {
  type: 'CAPTURE_SCREENSHOT'
}

export interface CaptureScreenshotResponse {
  success: boolean
  error?: string
}

export interface AddScreenshotMessage {
  type: 'ADD_SCREENSHOT'
}

export interface AddScreenshotResponse {
  success: boolean
  key?: string
  dataUrl?: string
  tabUrl?: string
  error?: string
}

export interface GetSessionMessage {
  type: 'GET_SESSION'
}

export interface GetSessionResponse {
  hasSession: boolean
  screenshotCount?: number
  annotationTabId?: number
}

export interface ClearSessionMessage {
  type: 'CLEAR_SESSION'
}

export interface ClearSessionResponse {
  success: boolean
}

export interface ScreenshotPayload {
  title: string
  description: string
  tag: TagLevel | null
  annotatedImageBase64: string
}

export interface SubmitBugReportMessage {
  type: 'SUBMIT_BUG_REPORT'
  payload: {
    screenshots: ScreenshotPayload[]
    bugReport: BugReport
    config: AppConfig
  }
}

export interface SubmitBugReportResponse {
  success: boolean
  commentId?: string
  commentUrl?: string
  error?: string
}

export type ExtensionMessage =
  | CaptureScreenshotMessage
  | AddScreenshotMessage
  | GetSessionMessage
  | ClearSessionMessage
  | SubmitBugReportMessage
