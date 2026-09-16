import React, { useEffect, useState } from 'react'
import { cn } from '../ui/utils'
import { StackedPhotoPlaceholder } from '../StackedPhotoPlaceholder'

export function ImageWithFallback(props: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [didError, setDidError] = useState(false)

  const handleError = () => {
    setDidError(true)
  }

  const { src, alt, style, className, ...rest } = props

  useEffect(() => {
    setDidError(false)
  }, [src])

  return didError || !src ? (
    <div
      className={cn('inline-block max-h-full max-w-full align-middle', className)}
      style={style}
    >
      <StackedPhotoPlaceholder className="h-full w-full min-h-full min-w-full" />
    </div>
  ) : (
    <img
      src={src}
      alt={alt}
      className={cn('max-h-full max-w-full', className)}
      style={style}
      decoding="async"
      {...rest}
      onError={handleError}
    />
  )
}
