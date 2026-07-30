// Pure utility functions — no API calls, no cost. All links open in the user's WhatsApp/Instagram app.

export function buildWhatsAppLink(phone: string, message: string): string {
  // Normalize Israeli numbers: 05X → 9725X
  const normalized = phone
    .replace(/\s/g, '')
    .replace(/^0/, '972')
    .replace(/[^\d]/g, '')
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`
}

export function buildInstagramProfileLink(handle: string): string {
  const clean = handle.replace('@', '').trim()
  return `https://www.instagram.com/${clean}/`
}

export function buildClassReminderMessage(params: {
  venueName: string
  venueAddress: string
  venueCity: string
  bookingDate: string
  startTime: string
  endTime: string
  instructorName: string
  classType?: string
}): string {
  const date = new Date(params.bookingDate).toLocaleDateString('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  const classLabel = params.classType ? `שיעור ${params.classType}` : 'שיעור'
  return `שלום! 🌊\nרציתי להזכיר לך שיש ${classLabel} עם ${params.instructorName}\n📅 ${date}\n⏰ ${params.startTime}–${params.endTime}\n📍 ${params.venueName}, ${params.venueCity}\n\nנתראה שם! 🧘‍♀️`
}
