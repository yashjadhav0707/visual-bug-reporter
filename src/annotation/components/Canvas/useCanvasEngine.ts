import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  AnnotationShape,
  ArrowShape,
  EllipseShape,
  FreehandShape,
  Point,
  RectangleShape,
  TextShape,
  ToolType,
} from '../../../shared/types/annotation'

interface TextInputState {
  position: Point
  value: string
}

type DragHandle = 'start' | 'end' | 'move'

interface DragState {
  handle: DragHandle
  startPt: Point
  origShape: AnnotationShape
}

export interface CanvasEngine {
  canvasRef: React.RefObject<HTMLCanvasElement>
  activeTool: ToolType
  currentColor: string
  strokeWidth: number
  isFilled: boolean
  canUndo: boolean
  canRedo: boolean
  isHoveringShape: boolean
  textInput: TextInputState | null
  selectedShapeId: string | null
  setActiveTool: (tool: ToolType) => void
  setColor: (color: string) => void
  setStrokeWidth: (width: number) => void
  setIsFilled: (filled: boolean) => void
  undo: () => void
  redo: () => void
  clearAll: () => void
  commitTextInput: (text: string) => void
  cancelTextInput: () => void
  getAnnotatedDataUrl: () => string
  getShapes: () => AnnotationShape[]
  loadShapes: (shapes: AnnotationShape[]) => void
  notifyCanvasMounted: () => void
  onMouseDown: (e: React.MouseEvent<HTMLCanvasElement>) => void
  onMouseMove: (e: React.MouseEvent<HTMLCanvasElement>) => void
  onMouseUp: (e: React.MouseEvent<HTMLCanvasElement>) => void
}

export function useCanvasEngine(screenshotDataUrl: string | null): CanvasEngine {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const bgImageRef = useRef<HTMLImageElement | null>(null)

  const [shapes, setShapes] = useState<AnnotationShape[]>([])
  const [redoStack, setRedoStack] = useState<AnnotationShape[]>([])
  const [activeTool, setActiveTool] = useState<ToolType>('arrow')
  const [currentColor, setCurrentColor] = useState('#FF0000')
  const [strokeWidth, setStrokeWidth] = useState(3)
  const [isFilled, setIsFilled] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentShape, setCurrentShape] = useState<AnnotationShape | null>(null)
  const [textInput, setTextInput] = useState<TextInputState | null>(null)
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null)
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [isHoveringShape, setIsHoveringShape] = useState(false)

  const shapesRef = useRef(shapes)
  const currentShapeRef = useRef(currentShape)
  const textInputRef = useRef(textInput)
  const dragStateRef = useRef(dragState)
  const selectedShapeIdRef = useRef(selectedShapeId)
  const activeToolRef = useRef(activeTool)
  const isDrawingRef = useRef(isDrawing)
  const isFilledRef = useRef(isFilled)
  const currentColorRef = useRef(currentColor)
  const strokeWidthRef = useRef(strokeWidth)

  const isHoveringShapeRef = useRef(isHoveringShape)

  useEffect(() => { shapesRef.current = shapes }, [shapes])
  useEffect(() => { currentShapeRef.current = currentShape }, [currentShape])
  useEffect(() => { textInputRef.current = textInput }, [textInput])
  useEffect(() => { dragStateRef.current = dragState }, [dragState])
  useEffect(() => { selectedShapeIdRef.current = selectedShapeId }, [selectedShapeId])
  useEffect(() => { activeToolRef.current = activeTool }, [activeTool])
  useEffect(() => { isDrawingRef.current = isDrawing }, [isDrawing])
  useEffect(() => { isFilledRef.current = isFilled }, [isFilled])
  useEffect(() => { currentColorRef.current = currentColor }, [currentColor])
  useEffect(() => { strokeWidthRef.current = strokeWidth }, [strokeWidth])
  useEffect(() => { isHoveringShapeRef.current = isHoveringShape }, [isHoveringShape])

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    const bg = bgImageRef.current
    if (!canvas || !ctx) return

    if (bg && (canvas.width !== bg.naturalWidth || canvas.height !== bg.naturalHeight)) {
      canvas.width = bg.naturalWidth
      canvas.height = bg.naturalHeight
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (bg) ctx.drawImage(bg, 0, 0)

    shapesRef.current.forEach(shape => {
      drawShape(ctx, shape)
      if (shape.id === selectedShapeIdRef.current) drawSelectionHandles(ctx, shape)
    })

    if (currentShapeRef.current) {
      ctx.save()
      ctx.globalAlpha = 0.8
      drawShape(ctx, currentShapeRef.current)
      ctx.restore()
    }
  }, [])

  useEffect(() => {
    if (!screenshotDataUrl) return
    const img = new Image()
    img.onload = () => {
      const canvas = canvasRef.current
      if (canvas) { canvas.width = img.naturalWidth; canvas.height = img.naturalHeight }
      bgImageRef.current = img
      redraw()
    }
    img.src = screenshotDataUrl
  }, [screenshotDataUrl, redraw])

  useEffect(() => { redraw() }, [shapes, currentShape, selectedShapeId, redraw])

  function getCanvasPoint(e: React.MouseEvent<HTMLCanvasElement>): Point {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    }
  }

  function hitTestShape(pt: Point, shape: AnnotationShape, threshold: number): DragHandle | null {
    if (shape.tool === 'arrow') {
      if (Math.hypot(pt.x - shape.start.x, pt.y - shape.start.y) < threshold) return 'start'
      if (Math.hypot(pt.x - shape.end.x, pt.y - shape.end.y) < threshold) return 'end'
      const { start, end } = shape
      const len = Math.hypot(end.x - start.x, end.y - start.y)
      if (len < 1) return null
      const t = ((pt.x - start.x) * (end.x - start.x) + (pt.y - start.y) * (end.y - start.y)) / (len * len)
      if (t >= 0 && t <= 1) {
        const cx = start.x + t * (end.x - start.x), cy = start.y + t * (end.y - start.y)
        if (Math.hypot(pt.x - cx, pt.y - cy) < threshold * 1.5) return 'move'
      }
      return null
    }
    if (shape.tool === 'rectangle' || shape.tool === 'ellipse') {
      const x1 = Math.min(shape.start.x, shape.end.x) - threshold
      const y1 = Math.min(shape.start.y, shape.end.y) - threshold
      const x2 = Math.max(shape.start.x, shape.end.x) + threshold
      const y2 = Math.max(shape.start.y, shape.end.y) + threshold
      if (pt.x >= x1 && pt.x <= x2 && pt.y >= y1 && pt.y <= y2) return 'move'
    }
    if (shape.tool === 'text') {
      if (Math.hypot(pt.x - shape.position.x, pt.y - shape.position.y) < threshold * 3) return 'move'
    }
    return null
  }

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (textInputRef.current) return
    const pt = getCanvasPoint(e)
    const tool = activeToolRef.current

    // Always check for shape hit first — allow dragging from any tool
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const threshold = 20 * (canvas.width / rect.width)
    for (let i = shapesRef.current.length - 1; i >= 0; i--) {
      const shape = shapesRef.current[i]
      const handle = hitTestShape(pt, shape, threshold)
      if (handle !== null) {
        setSelectedShapeId(shape.id)
        setDragState({ handle, startPt: pt, origShape: shape })
        setIsHoveringShape(false)
        return
      }
    }

    // No shape hit — start drawing
    setRedoStack([])
    setSelectedShapeId(null)

    if (tool === 'text') {
      setTextInput({ position: pt, value: '' })
      return
    }

    setIsDrawing(true)
    const id = `shape_${Date.now()}`
    const color = currentColorRef.current
    const sw = strokeWidthRef.current
    const filled = isFilledRef.current
    let shape: AnnotationShape

    if (tool === 'arrow') {
      shape = { id, tool: 'arrow', start: pt, end: pt, color, strokeWidth: sw } as ArrowShape
    } else if (tool === 'rectangle') {
      shape = { id, tool: 'rectangle', start: pt, end: pt, color, strokeWidth: sw, filled } as RectangleShape
    } else if (tool === 'ellipse') {
      shape = { id, tool: 'ellipse', start: pt, end: pt, color, strokeWidth: sw, filled } as EllipseShape
    } else {
      shape = { id, tool: 'freehand', points: [pt], color, strokeWidth: sw } as FreehandShape
    }

    setCurrentShape(shape)
  }, [])

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const pt = getCanvasPoint(e)

    // Handle active drag
    if (dragStateRef.current) {
      const { handle, startPt, origShape } = dragStateRef.current
      const dx = pt.x - startPt.x, dy = pt.y - startPt.y
      setShapes(prev => prev.map(s => {
        if (s.id !== origShape.id) return s
        if (origShape.tool === 'arrow') {
          const o = origShape as ArrowShape
          if (handle === 'start') return { ...o, start: { x: o.start.x + dx, y: o.start.y + dy } }
          if (handle === 'end') return { ...o, end: { x: o.end.x + dx, y: o.end.y + dy } }
          return { ...o, start: { x: o.start.x + dx, y: o.start.y + dy }, end: { x: o.end.x + dx, y: o.end.y + dy } }
        }
        if (origShape.tool === 'rectangle' || origShape.tool === 'ellipse') {
          const o = origShape as RectangleShape | EllipseShape
          return { ...o, start: { x: o.start.x + dx, y: o.start.y + dy }, end: { x: o.end.x + dx, y: o.end.y + dy } }
        }
        if (origShape.tool === 'text') {
          const o = origShape as TextShape
          return { ...o, position: { x: o.position.x + dx, y: o.position.y + dy } }
        }
        return s
      }))
      return
    }

    // Handle active drawing
    if (isDrawingRef.current && currentShapeRef.current) {
      setCurrentShape(prev => {
        if (!prev) return prev
        if (prev.tool === 'arrow' || prev.tool === 'rectangle' || prev.tool === 'ellipse') return { ...prev, end: pt }
        if (prev.tool === 'freehand') return { ...prev, points: [...prev.points, pt] }
        return prev
      })
      return
    }

    // Idle — update hover state for cursor
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const threshold = 20 * (canvas.width / rect.width)
    const hovering = shapesRef.current.some(shape => hitTestShape(pt, shape, threshold) !== null)
    if (hovering !== isHoveringShapeRef.current) setIsHoveringShape(hovering)
  }, [])

  const onMouseUp = useCallback((_e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragStateRef.current) {
      setDragState(null)
      return
    }
    if (!isDrawingRef.current || !currentShapeRef.current) return
    setIsDrawing(false)
    setShapes(prev => [...prev, currentShapeRef.current!])
    setCurrentShape(null)
  }, [])

  const undo = useCallback(() => {
    setShapes(prev => {
      if (prev.length === 0) return prev
      const last = prev[prev.length - 1]
      setRedoStack(r => [...r, last])
      return prev.slice(0, -1)
    })
    setSelectedShapeId(null)
  }, [])

  const redo = useCallback(() => {
    setRedoStack(prev => {
      if (prev.length === 0) return prev
      const next = prev[prev.length - 1]
      setShapes(s => [...s, next])
      return prev.slice(0, -1)
    })
  }, [])

  const clearAll = useCallback(() => {
    setShapes([]); setRedoStack([]); setCurrentShape(null); setSelectedShapeId(null)
  }, [])

  const commitTextInput = useCallback((text: string) => {
    if (!textInputRef.current || !text.trim()) { setTextInput(null); return }
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const fontSize = Math.round(18 * (canvas.width / rect.width))
    const shape: TextShape = {
      id: `shape_${Date.now()}`,
      tool: 'text',
      position: textInputRef.current.position,
      text: text.trim(),
      color: currentColorRef.current,
      strokeWidth: strokeWidthRef.current,
      fontSize,
    }
    setShapes(prev => [...prev, shape])
    setTextInput(null)
  }, [])

  const cancelTextInput = useCallback(() => setTextInput(null), [])
  const getShapes = useCallback((): AnnotationShape[] => shapesRef.current, [])
  const loadShapes = useCallback((newShapes: AnnotationShape[]) => {
    setShapes(newShapes); setRedoStack([]); setCurrentShape(null); setSelectedShapeId(null)
  }, [])
  const getAnnotatedDataUrl = useCallback((): string => { redraw(); return canvasRef.current?.toDataURL('image/png') ?? '' }, [redraw])
  const notifyCanvasMounted = useCallback(() => { if (bgImageRef.current) redraw() }, [redraw])

  return {
    canvasRef, activeTool, currentColor, strokeWidth, isFilled, isHoveringShape,
    canUndo: shapes.length > 0, canRedo: redoStack.length > 0,
    textInput, selectedShapeId,
    setActiveTool, setColor: setCurrentColor, setStrokeWidth, setIsFilled,
    undo, redo, clearAll, commitTextInput, cancelTextInput,
    getAnnotatedDataUrl, getShapes, loadShapes, notifyCanvasMounted,
    onMouseDown, onMouseMove, onMouseUp,
  }
}

// ─── Shape Rendering ──────────────────────────────────────────────────────────

export function drawShape(ctx: CanvasRenderingContext2D, shape: AnnotationShape) {
  ctx.save()
  ctx.strokeStyle = shape.color
  ctx.fillStyle = shape.color
  ctx.lineWidth = shape.strokeWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  switch (shape.tool) {
    case 'arrow': drawArrow(ctx, shape); break
    case 'rectangle': drawRectangle(ctx, shape); break
    case 'ellipse': drawEllipse(ctx, shape); break
    case 'text': drawText(ctx, shape); break
    case 'freehand': drawFreehand(ctx, shape); break
  }
  ctx.restore()
}

function drawSelectionHandles(ctx: CanvasRenderingContext2D, shape: AnnotationShape) {
  ctx.save()
  const handle = (x: number, y: number) => {
    ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2)
    ctx.fillStyle = '#5B3DE8'; ctx.fill()
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke()
  }
  if (shape.tool === 'arrow') {
    handle(shape.start.x, shape.start.y)
    handle(shape.end.x, shape.end.y)
  } else if (shape.tool === 'rectangle' || shape.tool === 'ellipse') {
    ctx.setLineDash([6, 4])
    ctx.strokeStyle = '#5B3DE8'; ctx.lineWidth = 2; ctx.fillStyle = 'transparent'
    const x = Math.min(shape.start.x, shape.end.x) - 6
    const y = Math.min(shape.start.y, shape.end.y) - 6
    const w = Math.abs(shape.end.x - shape.start.x) + 12
    const h = Math.abs(shape.end.y - shape.start.y) + 12
    ctx.strokeRect(x, y, w, h)
  } else if (shape.tool === 'text') {
    handle(shape.position.x, shape.position.y)
  }
  ctx.restore()
}

function drawArrow(ctx: CanvasRenderingContext2D, shape: ArrowShape) {
  const { start, end, strokeWidth } = shape
  const dx = end.x - start.x, dy = end.y - start.y
  const len = Math.hypot(dx, dy)
  if (len < 2) return
  const angle = Math.atan2(dy, dx)
  const headLen = Math.max(14, strokeWidth * 4)
  ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(end.x, end.y)
  ctx.lineTo(end.x - headLen * Math.cos(angle - Math.PI / 6), end.y - headLen * Math.sin(angle - Math.PI / 6))
  ctx.lineTo(end.x - headLen * Math.cos(angle + Math.PI / 6), end.y - headLen * Math.sin(angle + Math.PI / 6))
  ctx.closePath(); ctx.fill()
}

function drawRectangle(ctx: CanvasRenderingContext2D, shape: RectangleShape) {
  const x = Math.min(shape.start.x, shape.end.x), y = Math.min(shape.start.y, shape.end.y)
  const w = Math.abs(shape.end.x - shape.start.x), h = Math.abs(shape.end.y - shape.start.y)
  if (w < 1 || h < 1) return
  if (shape.filled) { ctx.fillStyle = shape.color + '20'; ctx.fillRect(x, y, w, h) }
  ctx.strokeRect(x, y, w, h)
}

function drawEllipse(ctx: CanvasRenderingContext2D, shape: EllipseShape) {
  const cx = (shape.start.x + shape.end.x) / 2, cy = (shape.start.y + shape.end.y) / 2
  const rx = Math.abs(shape.end.x - shape.start.x) / 2, ry = Math.abs(shape.end.y - shape.start.y) / 2
  if (rx < 1 || ry < 1) return
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
  if (shape.filled) { ctx.fillStyle = shape.color + '20'; ctx.fill() }
  ctx.stroke()
}

function drawText(ctx: CanvasRenderingContext2D, shape: TextShape) {
  ctx.font = `bold ${shape.fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`
  ctx.textBaseline = 'top'
  const metrics = ctx.measureText(shape.text)
  const pad = shape.fontSize * 0.3
  ctx.fillStyle = shape.color
  ctx.beginPath()
  ctx.roundRect(shape.position.x - pad, shape.position.y - pad * 0.5, metrics.width + pad * 2, shape.fontSize + pad, 4)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.fillText(shape.text, shape.position.x, shape.position.y)
}

function drawFreehand(ctx: CanvasRenderingContext2D, shape: FreehandShape) {
  const pts = shape.points
  if (pts.length < 2) return
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length - 1; i++) {
    const midX = (pts[i].x + pts[i + 1].x) / 2, midY = (pts[i].y + pts[i + 1].y) / 2
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY)
  }
  ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y); ctx.stroke()
}
