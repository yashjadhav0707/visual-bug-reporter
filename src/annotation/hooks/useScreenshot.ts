import { useEffect, useState } from 'react'
import { getScreenshot, removeScreenshot } from '../../shared/utils/storage'

interface ScreenshotData {
  dataUrl: string
  tabUrl: string
}

export function useScreenshot() {
  const [screenshot, setScreenshot] = useState<ScreenshotData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const key = window.location.hash.slice(1)

    if (!key) {
      setError('No screenshot key found in URL.')
      setLoading(false)
      return
    }

    async function load() {
      try {
        const [dataUrl, tabUrl] = await Promise.all([
          getScreenshot(key),
          getScreenshot(`${key}_url`),
        ])

        if (!dataUrl) {
          setError('Screenshot not found. Please try capturing again.')
          setLoading(false)
          return
        }

        setScreenshot({ dataUrl, tabUrl: tabUrl ?? '' })

        // Clean up storage
        await Promise.all([removeScreenshot(key), removeScreenshot(`${key}_url`)])
      } catch (err) {
        setError(String(err))
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [])

  return { screenshot, loading, error }
}
