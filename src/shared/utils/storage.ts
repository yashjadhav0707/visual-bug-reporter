import type { AppConfig } from '../types/config'
import { STORAGE_KEYS } from './constants'

const DEFAULT_CONFIG: AppConfig = {
  imgbbApiKey: '',
  googleScriptUrl: '',
  googleDocUrl: '',
}

export async function getAppConfig(): Promise<AppConfig> {
  // Check new key first, fall back to legacy key for existing users
  const result = await chrome.storage.sync.get([STORAGE_KEYS.APP_CONFIG, 'figmaConfig'])
  const stored = result[STORAGE_KEYS.APP_CONFIG] ?? result['figmaConfig'] ?? {}
  return { ...DEFAULT_CONFIG, ...stored }
}

export async function setAppConfig(config: AppConfig): Promise<void> {
  await chrome.storage.sync.set({ [STORAGE_KEYS.APP_CONFIG]: config })
  await chrome.storage.sync.remove('figmaConfig')
}

export async function getScreenshot(key: string): Promise<string | null> {
  const result = await chrome.storage.local.get(key)
  return result[key] ?? null
}

export async function setScreenshot(key: string, dataUrl: string): Promise<void> {
  await chrome.storage.local.set({ [key]: dataUrl })
}

export async function removeScreenshot(key: string): Promise<void> {
  await chrome.storage.local.remove(key)
}
