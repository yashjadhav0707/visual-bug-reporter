import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AnnotationApp } from './AnnotationApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AnnotationApp />
  </StrictMode>
)
