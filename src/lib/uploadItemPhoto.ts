// src/lib/uploadItemPhoto.ts
// Shared utility for uploading user-supplied item photos.
// Used by AddItemModal, EditItemModal, and AIUploadModal review screen.
// Server-side only: never import in a server component.

import { createBrowserClient } from '@/lib/supabase'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

function compressItemImage(
  file: File,
  maxSizePx = 800,
  quality = 0.8,
): Promise<{ base64: string; blob: Blob; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxSizePx / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
      canvas.toBlob(
        blob => {
          if (!blob) { reject(new Error('Compression failed')); return }
          const reader = new FileReader()
          reader.onload = () => resolve({
            base64: (reader.result as string).split(',')[1],
            blob,
            mediaType: 'image/jpeg',
          })
          reader.onerror = reject
          reader.readAsDataURL(blob)
        },
        'image/jpeg',
        quality,
      )
    }
    img.onerror = reject
    img.src = url
  })
}

async function moderateImage(base64: string, mediaType: string): Promise<boolean> {
  try {
    const res = await fetch('/api/moderate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64, mediaType }),
    })
    const data = await res.json()
    return data.flagged === true
  } catch {
    return false // fail open
  }
}

export interface UploadItemPhotoResult {
  url: string | null
  error: string | null
}

export async function uploadItemPhoto(
  file: File,
  userId: string,
  itemId: string,
): Promise<UploadItemPhotoResult> {
  // 1. File size check
  if (file.size > MAX_FILE_SIZE) {
    return { url: null, error: 'Image must be under 5MB' }
  }

  if (!file.type.startsWith('image/')) {
    return { url: null, error: 'Please select an image file' }
  }

  // 2. Compress
  let compressed: { base64: string; blob: Blob; mediaType: string }
  try {
    compressed = await compressItemImage(file)
  } catch {
    return { url: null, error: 'Could not process image' }
  }

  // 3. Moderate
  const flagged = await moderateImage(compressed.base64, compressed.mediaType)
  if (flagged) {
    return { url: null, error: 'This image was flagged as inappropriate and cannot be uploaded.' }
  }

  // 4. Upload to Supabase Storage
  const supabase = createBrowserClient()
  const path = `${userId}/${itemId}.jpg`

  const { error: uploadError } = await supabase.storage
    .from('item-covers')
    .upload(path, compressed.blob, {
      upsert: true,
      contentType: 'image/jpeg',
    })

  if (uploadError) {
    return { url: null, error: uploadError.message }
  }

  const { data: { publicUrl } } = supabase.storage
    .from('item-covers')
    .getPublicUrl(path)

  // Cache-bust so re-uploads show immediately
  return { url: `${publicUrl}?t=${Date.now()}`, error: null }
}
