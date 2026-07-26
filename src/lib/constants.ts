// Shared constants — import from here, NOT from mock-data.ts

export const AMENITY_OPTIONS = [
  { key: 'ac', label: 'מיזוג אוויר', icon: '❄️' },
  { key: 'shade', label: 'הצללה', icon: '⛱️' },
  { key: 'toilets', label: 'שירותים', icon: '🚽' },
  { key: 'shower', label: 'מקלחת', icon: '🚿' },
  { key: 'speakers', label: 'מערכת שמע', icon: '🔊' },
  { key: 'wifi', label: 'Wi-Fi', icon: '📶' },
  { key: 'parking', label: 'חניה', icon: '🅿️' },
  { key: 'sea_view', label: 'נוף לים', icon: '🌊' },
  { key: 'natural_light', label: 'אור טבעי', icon: '☀️' },
  { key: 'power_outlets', label: 'שקעי חשמל', icon: '🔌' },
  { key: 'accessible', label: 'נגישות', icon: '♿' },
] as const

export const amenityLabels: Record<string, string> = Object.fromEntries(
  AMENITY_OPTIONS.map(({ key, label }) => [key, label])
)

export const amenityIcons: Record<string, string> = Object.fromEntries(
  AMENITY_OPTIONS.map(({ key, icon }) => [key, icon])
)

export const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

export const ISRAELI_CITIES = [
  'תל אביב',
  'תל אביב - יפו',
  'הרצליה',
  'נתניה',
  'חיפה',
  'אשדוד',
  'אשקלון',
  'קיסריה',
  'עכו',
  'נהריה',
  'בת ים',
  'ראשון לציון',
  'פתח תקווה',
  'חולון',
]

export const CLASS_TYPES = [
  'יוגה',
  'פילאטיס',
  'מדיטציה',
  'HIIT',
  'זומבה',
  'אירובי',
  'קרוספיט',
  'בוקסינג',
  'כושר פונקציונלי',
  'אחר',
]

// Platform fee calculation (hidden from users)
export function calculatePlatformFee(spaceSizeSqm: number): number {
  if (spaceSizeSqm <= 50) return 25
  if (spaceSizeSqm <= 80) return 35
  return 50
}

// Mandatory venue fields for publishing
export const MANDATORY_VENUE_FIELDS = [
  'title',
  'description',
  'location_address',
  'location_city',
  'hourly_price',
  'capacity',
  'space_size_sqm',
] as const
