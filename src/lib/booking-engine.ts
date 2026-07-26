export interface TimeSlot {
  start: string // HH:MM
  end: string // HH:MM
  available: boolean
}

const BUFFER_MINUTES = 30 // between bookings
const CLOSING_BUFFER_MINUTES = 60 // before restaurant opens

export function generateTimeSlots(
  availStart: string,
  availEnd: string,
  existingBookings: Array<{ start_time: string; end_time: string }>,
  slotDurationMinutes: number = 90
): TimeSlot[] {
  const slotDurationHours = slotDurationMinutes / 60
  const slots: TimeSlot[] = []
  const [availStartH, availStartM] = availStart.split(':').map(Number)
  const [availEndH, availEndM] = availEnd.split(':').map(Number)

  const availStartMins = availStartH * 60 + availStartM
  // Apply closing buffer
  const availEndMins = availEndH * 60 + availEndM - CLOSING_BUFFER_MINUTES
  const slotDurationMins = slotDurationMinutes

  for (let start = availStartMins; start + slotDurationMins <= availEndMins; start += 30) {
    const end = start + slotDurationMins
    const startStr = minsToTime(start)
    const endStr = minsToTime(end)

    const isAvailable = !existingBookings.some(booking => {
      const bookStart = timeToMins(booking.start_time) - BUFFER_MINUTES
      const bookEnd = timeToMins(booking.end_time) + BUFFER_MINUTES
      const slotStart = start
      const slotEnd = end
      return slotStart < bookEnd && slotEnd > bookStart
    })

    slots.push({ start: startStr, end: endStr, available: isAvailable })
  }

  return slots
}

function timeToMins(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function minsToTime(mins: number): string {
  const h = Math.floor(mins / 60).toString().padStart(2, '0')
  const m = (mins % 60).toString().padStart(2, '0')
  return `${h}:${m}`
}

export function calculatePlatformFee(venueSizeSqm?: number): number {
  if (!venueSizeSqm) return 35
  if (venueSizeSqm <= 50) return 25
  if (venueSizeSqm <= 80) return 35
  return 50
}
