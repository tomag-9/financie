import { ImageResponse } from 'next/og'

export const size = {
  width: 32,
  height: 32,
}

export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <svg viewBox="0 0 73 76" width="32" height="32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M36 0L0 76H18L36 37L55 76H73L36 0Z" fill="url(#brandMarkGradient)" />
        <defs>
          <linearGradient id="brandMarkGradient" x1="19" y1="-2" x2="79" y2="76" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0A2E69" />
            <stop offset="1" stopColor="#C15B28" />
          </linearGradient>
        </defs>
      </svg>
    ),
    size,
  )
}