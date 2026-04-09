import React, { useState } from 'react'
import { cn } from '../ui/utils'

export function ImageWithFallback(props: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [didError, setDidError] = useState(false)

  const handleError = () => {
    setDidError(true)
  }

  const { src, alt, style, className, ...rest } = props

  return didError || !src ? (
    <div
      className={cn(
        'inline-block bg-gradient-to-br from-gray-50 to-gray-100 text-center align-middle max-h-full max-w-full',
        className,
      )}
      style={style}
    >
      <div className="flex items-center justify-center w-full h-full">
        <svg
          className="w-12 h-12 text-gray-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
          />
        </svg>
      </div>
    </div>
  ) : (
    <img
      src={src}
      alt={alt}
      className={cn('max-h-full max-w-full', className)}
      style={style}
      {...rest}
      onError={handleError}
    />
  )
}