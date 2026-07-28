'use client'

import { useState } from 'react'
import { Search, X } from 'lucide-react'

const amenityFilters = [
  { key: 'sea_view', label: 'נוף לים', icon: '🌊' },
  { key: 'ac',      label: 'מיזוג',   icon: '❄️' },
  { key: 'shade',   label: 'הצללה',   icon: '⛱️' },
  { key: 'speakers',label: 'שמע',     icon: '🔊' },
  { key: 'toilets', label: 'שירותים', icon: '🚽' },
  { key: 'parking', label: 'חניה',    icon: '🅿️' },
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
    <div className="space-y-4 py-4">
      {/* Search bar — MOVE style */}
      <div className="relative">
        <Search
          className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4"
          style={{ color: '#6b7c7c' }}
        />
        <input
          type="text"
          placeholder="חיפוש לפי עיר, שם מקום..."
          value={query}
          onChange={e => {
            setQuery(e.target.value)
            onSearch(e.target.value, activeFilters)
          }}
          className="w-full pr-11 pl-4 py-3.5 text-sm outline-none text-right"
          style={{
            background: 'white',
            border: '1.5px solid #f0e6d3',
            borderRadius: 50,
            color: '#1a2a2a',
            boxShadow: '0 2px 12px rgba(10,74,74,0.06)',
            fontFamily: 'Heebo, sans-serif',
          }}
          onFocus={e => { e.target.style.borderColor = '#0d6e6e'; e.target.style.boxShadow = '0 0 0 3px rgba(13,110,110,0.10)' }}
          onBlur={e => { e.target.style.borderColor = '#f0e6d3'; e.target.style.boxShadow = '0 2px 12px rgba(10,74,74,0.06)' }}
        />
      </div>

      {/* Filter pills — MOVE style */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs font-bold uppercase tracking-wider ml-1" style={{ color: '#6b7c7c' }}>סינון</span>

        {amenityFilters.map(filter => {
          const active = activeFilters.includes(filter.key)
          return (
            <button
              key={filter.key}
              onClick={() => toggleFilter(filter.key)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-full transition-all"
              style={{
                background: active ? '#0d6e6e' : 'white',
                border: active ? '1.5px solid #0d6e6e' : '1.5px solid #f0e6d3',
                color: active ? 'white' : '#6b7c7c',
                boxShadow: active ? '0 2px 8px rgba(13,110,110,0.25)' : 'none',
              }}
            >
              <span>{filter.icon}</span>
              {filter.label}
            </button>
          )
        })}

        {activeFilters.length > 0 && (
          <button
            onClick={() => { setActiveFilters([]); onSearch(query, []) }}
            className="flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-full transition-all"
            style={{ background: 'rgba(224,122,95,0.10)', color: '#e07a5f', border: '1px solid rgba(224,122,95,0.25)' }}
          >
            <X className="w-3 h-3" />
            נקה ({activeFilters.length})
          </button>
        )}
      </div>
    </div>
  )
}
