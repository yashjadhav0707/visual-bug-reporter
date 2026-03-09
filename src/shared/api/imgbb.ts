import { IMGBB_UPLOAD_URL } from '../utils/constants'

export async function uploadToImgBB(base64Image: string, apiKey: string): Promise<string> {
  // Strip data URL prefix if present
  const base64 = base64Image.replace(/^data:image\/\w+;base64,/, '')

  // Use URLSearchParams instead of FormData — FormData can fail in MV3 service workers
  // with large payloads; x-www-form-urlencoded is more reliable.
  const body = new URLSearchParams()
  body.append('image', base64)
  body.append('expiration', '0')

  let response: Response
  try {
    response = await fetch(`${IMGBB_UPLOAD_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
  } catch (err) {
    throw new Error(`ImgBB network error: ${String(err)}. Check your internet connection and ImgBB API key.`)
  }

  if (!response.ok) {
    throw new Error(`ImgBB upload failed (HTTP ${response.status}). Check your API key in Settings.`)
  }

  const data = await response.json() as { success: boolean; data: { url: string }; error?: { message: string } }

  if (!data.success) {
    throw new Error(`ImgBB error: ${data.error?.message ?? 'Unknown error'}`)
  }

  return data.data.url
}
