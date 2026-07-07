import { useRef } from 'react'
import { useAutoScaleFont } from '../../hooks/useAutoScaleFont'

interface AutoScaleTextProps {
  text: string
  className?: string
  minFontPx?: number
  maxFontPx?: number
}

export default function AutoScaleText({ text, className, minFontPx, maxFontPx }: AutoScaleTextProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const fontSize = useAutoScaleFont(containerRef, text, { minFontPx, maxFontPx })

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ fontSize: `${fontSize}px`, lineHeight: 1.2 }}
    >
      {text}
    </div>
  )
}
