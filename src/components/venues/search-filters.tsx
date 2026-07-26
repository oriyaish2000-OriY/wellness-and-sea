'use client'

import { useState } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { Input } from '@/components/ui/input'

const amenityFilters = [
  { key: 'ac', label: '❄️ מיזוג אוויר' },
  { key: 'shade', label: '⛱️ הצללה' },
  { key: 'sea_view', label: '🌊 נוף לים' },
  { key: 'speakers', label: '🔊 מערכת שמע' },
  { key: 'toilets', label: '🚽 שירותים' },
  { key: 'parking', label: '🅿️ חניה' },
]

interface SearchFiltersProps {
  onSearch: (query: string, filters: string[]) => void
}

export function SearchFilters({ onSearch }: SearchFiltersProps) {
  const [query, setQuery] = useState('')
  const [activeFilters, setActiveFilters] = useState<string[]>([])

  const toggleFilter = (key: string) => {
    const updated = activeFilters.includes(key)
      ? activeFilters.filter(f => f !== key)
      : [...activeFilters, key]
    setActiveFilters(updated)
    onSearch(query, updated)
  }

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="חיפוש לפי עיר, שם מקום..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            onSearch(e.target.value, activeFilters)
          }}
          className="pr-10 text-right bg-white border-gray-200 focus:border-ocean"
        />
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-1 text-gray-500 text-sm ml-2">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>סינון:</span>
        </div>
        {amenityFilters.map((filter) => (
          <button
            key={filter.key}
            onClick={() => toggleFilter(filter.key)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
              activeFilters.includes(filter.key)
                ? 'bg-ocean text-white border-ocean'
                : 'bg-white text-gray-600 border-gray-200 hover:border-ocean hover:text-ocean'
            }`}
          >
            {filter.label}
          </button>
        ))}
        {activeFilters.length > 0 && (
          <button
            onClick={() => {
              setActiveFilters([])
              onSearch(query, [])
            }}
            className="text-xs px-3 py-1.5 rounded-full bg-red-50 text-red-500 border border-red-100 flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            נקה הכל
          </button>
        )}
      </div>
    </div>
  )
}
