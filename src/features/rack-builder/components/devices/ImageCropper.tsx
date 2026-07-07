import { useState, useRef, useCallback, useEffect } from 'react'
import ReactCrop, { centerCrop, makeAspectCrop, type Crop, type PixelCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import Button from '../ui/Button'

interface ImageCropperProps {
  image: Blob
  aspect?: number
  outputWidth?: number
  outputHeight?: number
  onCropComplete: (blob: Blob) => void
  onCancel: () => void
}

function getCroppedBlob(
  image: HTMLImageElement,
  crop: PixelCrop,
  outputWidth?: number,
  outputHeight?: number,
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  const scaleX = image.naturalWidth / image.width
  const scaleY = image.naturalHeight / image.height
  const sourceWidth = crop.width * scaleX
  const sourceHeight = crop.height * scaleY
  const targetWidth = outputWidth && outputWidth > 0 ? outputWidth : Math.round(sourceWidth)
  const targetHeight = outputHeight && outputHeight > 0 ? outputHeight : Math.round(sourceHeight)
  canvas.width = targetWidth
  canvas.height = targetHeight
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    targetWidth,
    targetHeight,
  )
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Failed to create blob'))),
      'image/jpeg',
      0.9,
    )
  })
}

function getCenteredAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect?: number,
): Crop {
  if (!aspect || aspect <= 0) {
    return {
      unit: '%',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    }
  }

  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 100,
      },
      aspect,
      mediaWidth,
      mediaHeight,
    ),
    mediaWidth,
    mediaHeight,
  )
}

async function rasterizeImageBlob(image: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(image)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas context unavailable')
    ctx.drawImage(bitmap, 0, 0)
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Failed to rasterize image'))
      }, 'image/png')
    })
  } finally {
    bitmap.close()
  }
}

export default function ImageCropper({
  image,
  aspect,
  outputWidth,
  outputHeight,
  onCropComplete,
  onCancel,
}: ImageCropperProps) {
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    let active = true
    let objectUrl: string | null = null
    setImageUrl(null)
    setImageError(null)
    setCrop(undefined)
    setCompletedCrop(undefined)
    void rasterizeImageBlob(image)
      .then((rasterizedImage) => {
        objectUrl = URL.createObjectURL(rasterizedImage)
        if (active) {
          setImageUrl(objectUrl)
        } else {
          URL.revokeObjectURL(objectUrl)
        }
      })
      .catch(() => {
        if (active) setImageError('This image cannot be cropped.')
      })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [image])

  const handleConfirm = useCallback(async () => {
    if (!imgRef.current || !completedCrop) return
    const blob = await getCroppedBlob(imgRef.current, completedCrop, outputWidth, outputHeight)
    onCropComplete(blob)
  }, [completedCrop, onCropComplete, outputWidth, outputHeight])

  return (
    <div className="space-y-4">
      <div className="overflow-hidden">
        {imageUrl ? (
          <ReactCrop
            crop={crop}
            aspect={aspect}
            keepSelection
            onChange={setCrop}
            onComplete={setCompletedCrop}
          >
            <img
              ref={imgRef}
              src={imageUrl}
              alt="Crop preview"
              className="max-w-full block max-h-[55svh] sm:max-h-[70vh]"
              onLoad={(event) => {
                const target = event.currentTarget
                setCrop(getCenteredAspectCrop(target.width, target.height, aspect))
              }}
            />
          </ReactCrop>
        ) : imageError ? (
          <p className="text-sm text-red-600" role="alert">
            {imageError}
          </p>
        ) : (
          <p className="text-sm text-gray-600">Preparing image...</p>
        )}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-3">
        <Button onClick={handleConfirm} disabled={!completedCrop || !imageUrl} className="w-full sm:w-auto">
          Confirm Crop
        </Button>
        <Button variant="secondary" onClick={onCancel} className="w-full sm:w-auto">
          Cancel
        </Button>
      </div>
    </div>
  )
}
