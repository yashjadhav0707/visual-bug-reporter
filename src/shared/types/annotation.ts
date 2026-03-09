export type ToolType = 'arrow' | 'rectangle' | 'ellipse' | 'text' | 'freehand'

export interface Point {
  x: number
  y: number
}

interface BaseShape {
  id: string
  color: string
  strokeWidth: number
}

export interface ArrowShape extends BaseShape {
  tool: 'arrow'
  start: Point
  end: Point
}

export interface RectangleShape extends BaseShape {
  tool: 'rectangle'
  start: Point
  end: Point
  filled: boolean
}

export interface EllipseShape extends BaseShape {
  tool: 'ellipse'
  start: Point
  end: Point
  filled: boolean
}

export interface TextShape extends BaseShape {
  tool: 'text'
  position: Point
  text: string
  fontSize: number
}

export interface FreehandShape extends BaseShape {
  tool: 'freehand'
  points: Point[]
}

export type AnnotationShape = ArrowShape | RectangleShape | EllipseShape | TextShape | FreehandShape
