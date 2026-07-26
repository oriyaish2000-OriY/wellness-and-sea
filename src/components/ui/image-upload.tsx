'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Upload, X, Loader2 } from 'lucide-react'

interface ImageUploadProps {
  bucket: string
  folder: string
  onUpload: (url: string) => void
  onRemove?: (url: string) => void
  existingUrls?: string[]
  maxFiles?: number
  accept?: string
  label?: string
}

export function ImageUpload({
  bucket,
  folder,
  onUpload,
  onRemove,
  existingUrls = [],
  maxFiles = 5,
  accept = 'image/*',
  label = 'העלאת תמונות',
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const uploadFile = async (file: File): Promise<string> => {
    const supabase = createClient()
    const ext = file.name.split('.').pop() ?? 'jpg'
    const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const { data, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filename, file, { upsert: false })

    if (uploadError) throw uploadError

    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(data.path)
    return publicUrl
  }

  const handleFiles = async (files: FileList) => {
    const remaining = maxFiles - existingUrls.length
    if (files.length > remaining) {
      setError(`ניתן להעלות עד ${maxFiles} קבצים סה"כ`)
      return
    }
    setError(null)
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        if (file.size > 10 * 1024 * 1024) {
          setError('גודל קובץ מקסימלי הוא 10MB')
          continue
        }
        const url = await uploadFile(file)
        onUpload(url)
      }
    } catch {
      setError('שגיאה בהעלאת הקובץ. אנא נסה שוב.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files)
  }

  return (
    <div className="space-y-3">
      {existingUrls.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {existingUrls.map((url) => (
            <div key={url} className="relative aspect-video group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                className="w-full h-full object-cover rounded-lg border border-gray-200"
              />
              {onRemove && (
                <button
                  type="button"
                  onClick={() => onRemove(url)}
                  className="absolute top-1 right-1 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {existingUrls.length < maxFiles && (
        <div
          onClick={() => !uploading && inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
            uploading
              ? 'border-ocean/40 bg-ocean/5 cursor-wait'
              : 'border-gray-200 cursor-pointer hover:border-ocean hover:bg-ocean/5'
          }`}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 text-ocean animate-spin" />
              <p className="text-sm text-gray-500">מעלה קובץ...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 bg-ocean/10 rounded-full flex items-center justify-center">
                <Upload className="w-6 h-6 text-ocean" />
              </div>
              <p className="text-sm font-medium text-gray-700">{label}</p>
              <p className="text-xs text-gray-400">
                {maxFiles > 1
                  ? `ניתן להעלות עד ${maxFiles} קבצים • מקסימום 10MB לקובץ`
                  : 'מקסימום 10MB'}
              </p>
              <p className="text-xs text-gray-400">לחץ או גרור קבצים לכאן</p>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            multiple={maxFiles > 1}
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
        </div>
      )}

      {error && (
        <p className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}
    </div>
  )
}
