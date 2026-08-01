// Email notifications via Resend API
// Requires RESEND_API_KEY in .env.local
// Sign up at https://resend.com (free tier: 3,000 emails/month)

const FROM_EMAIL = 'Wellness&Sea <noreply@wellness-sea.co.il>'
const RESEND_API = 'https://api.resend.com/emails'

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    // Dev mode: just log
    console.log(`[EMAIL] To: ${to} | Subject: ${subject}`)
    return
  }

  try {
    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
    })
    if (!res.ok) {
      const body = await res.text()
      console.error('[EMAIL] Send failed:', body)
    }
  } catch (e) {
    console.error('[EMAIL] Network error:', e)
  }
}

function baseLayout(content: string): string {
  return `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; background: #f5f5f0; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #1a5f7a, #0d3d52); padding: 32px 24px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .header p { color: rgba(255,255,255,0.7); margin: 8px 0 0; font-size: 14px; }
    .body { padding: 32px 24px; }
    .detail-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
    .detail-label { color: #888; }
    .detail-value { font-weight: 600; color: #1a2e3b; }
    .cta { display: block; background: #1a5f7a; color: white !important; text-decoration: none; text-align: center; padding: 14px 28px; border-radius: 10px; font-weight: bold; margin: 24px 0; font-size: 15px; }
    .footer { background: #f9f9f6; padding: 20px 24px; text-align: center; font-size: 12px; color: #aaa; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .badge-green { background: #d1fae5; color: #065f46; }
    .badge-red { background: #fee2e2; color: #991b1b; }
    .badge-yellow { background: #fef3c7; color: #92400e; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Wellness & Sea 🌊</h1>
      <p>פלטפורמת הכושר על חוף הים</p>
    </div>
    <div class="body">${content}</div>
    <div class="footer">
      <p>Wellness & Sea | wellness-sea.co.il</p>
      <p>לתמיכה: support@wellness-sea.co.il</p>
    </div>
  </div>
</body>
</html>`
}

interface BookingEmailData {
  instructorName: string
  instructorEmail: string
  hostName: string
  hostEmail: string
  venueName: string
  venueAddress: string
  venueCity: string
  bookingDate: string
  startTime: string
  endTime: string
  totalPrice: number
  hostPayout: number
  classType?: string
  participantsCount?: number
  bookingId: string
}

export async function sendBookingConfirmedEmailToInstructor(data: BookingEmailData) {
  const dateStr = new Date(data.bookingDate).toLocaleDateString('he-IL', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const html = baseLayout(`
    <h2 style="color:#1a2e3b;margin-top:0">ההזמנה שלך אושרה! ✅</h2>
    <p style="color:#555">שלום ${data.instructorName},</p>
    <p style="color:#555">אנחנו שמחים לאשר שההזמנה שלך אושרה בהצלחה.</p>
    <div style="background:#f9fafb;border-radius:12px;padding:20px;margin:20px 0">
      <div class="detail-row"><span class="detail-label">מקום</span><span class="detail-value">${data.venueName}</span></div>
      <div class="detail-row"><span class="detail-label">כתובת</span><span class="detail-value">${data.venueAddress}, ${data.venueCity}</span></div>
      <div class="detail-row"><span class="detail-label">תאריך</span><span class="detail-value">${dateStr}</span></div>
      <div class="detail-row"><span class="detail-label">שעות</span><span class="detail-value">${data.startTime.slice(0,5)} – ${data.endTime.slice(0,5)}</span></div>
      ${data.classType ? `<div class="detail-row"><span class="detail-label">סוג שיעור</span><span class="detail-value">${data.classType}</span></div>` : ''}
      ${data.participantsCount ? `<div class="detail-row"><span class="detail-label">משתתפים</span><span class="detail-value">${data.participantsCount}</span></div>` : ''}
      <div class="detail-row" style="border:0"><span class="detail-label">סה"כ שולם</span><span class="detail-value" style="color:#1a5f7a;font-size:18px">₪${data.totalPrice}</span></div>
    </div>
    <div style="background:#eff6ff;border-radius:10px;padding:16px;margin:16px 0;font-size:13px;color:#1e40af">
      <strong>תזכורות:</strong><br>
      • יש להציג ביטוח מקצועי בתוקף<br>
      • כל משתתף חייב לחתום על הצהרת בריאות<br>
      • יש לפנות את החלל 15 דקות לפני סיום
    </div>
    <a href="${appUrl}/instructor-dashboard/bookings" class="cta">לצפייה בהזמנות שלי</a>
  `)

  await sendEmail(data.instructorEmail, `ההזמנה ב${data.venueName} אושרה! ✅`, html)
}

export async function sendNewBookingEmailToHost(data: BookingEmailData) {
  const dateStr = new Date(data.bookingDate).toLocaleDateString('he-IL', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const html = baseLayout(`
    <h2 style="color:#1a2e3b;margin-top:0">הזמנה חדשה התקבלה! 🎉</h2>
    <p style="color:#555">שלום ${data.hostName},</p>
    <p style="color:#555">התקבלה הזמנה חדשה עבור <strong>${data.venueName}</strong>.</p>
    <div style="background:#f9fafb;border-radius:12px;padding:20px;margin:20px 0">
      <div class="detail-row"><span class="detail-label">מדריכה</span><span class="detail-value">${data.instructorName}</span></div>
      <div class="detail-row"><span class="detail-label">תאריך</span><span class="detail-value">${dateStr}</span></div>
      <div class="detail-row"><span class="detail-label">שעות</span><span class="detail-value">${data.startTime.slice(0,5)} – ${data.endTime.slice(0,5)}</span></div>
      ${data.classType ? `<div class="detail-row"><span class="detail-label">סוג שיעור</span><span class="detail-value">${data.classType}</span></div>` : ''}
      ${data.participantsCount ? `<div class="detail-row"><span class="detail-label">משתתפים</span><span class="detail-value">${data.participantsCount}</span></div>` : ''}
      <div class="detail-row" style="border:0"><span class="detail-label">תשלום שלך</span><span class="detail-value" style="color:#059669;font-size:18px">₪${data.hostPayout}</span></div>
    </div>
    <a href="${appUrl}/host-dashboard/bookings" class="cta">לניהול ההזמנות</a>
  `)

  await sendEmail(data.hostEmail, `הזמנה חדשה ל${data.venueName}! 🎉`, html)
}

// ============================================================
// STUDENT ENROLLMENT CONFIRMATION
// ============================================================

interface EnrollmentEmailData {
  studentName: string
  studentEmail: string
  instructorName: string
  classType?: string
  venueName: string
  venueCity: string
  bookingDate: string
  startTime: string
  endTime: string
  pricePerStudent: number
  bookingId: string
}

export async function sendEnrollmentConfirmationEmail(data: EnrollmentEmailData) {
  const dateStr = new Date(data.bookingDate).toLocaleDateString('he-IL', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const html = baseLayout(`
    <h2 style="color:#1a2e3b;margin-top:0">נרשמת לשיעור! 🌊</h2>
    <p style="color:#555">שלום ${data.studentName},</p>
    <p style="color:#555">ההרשמה שלך אושרה. כל שנותר הוא לשלוח את התשלום ישירות למדריכה.</p>
    <div style="background:#f9fafb;border-radius:12px;padding:20px;margin:20px 0">
      <div class="detail-row"><span class="detail-label">שיעור</span><span class="detail-value">${data.classType ?? 'שיעור'}</span></div>
      <div class="detail-row"><span class="detail-label">מדריכה</span><span class="detail-value">${data.instructorName}</span></div>
      <div class="detail-row"><span class="detail-label">מיקום</span><span class="detail-value">${data.venueName} · ${data.venueCity}</span></div>
      <div class="detail-row"><span class="detail-label">תאריך</span><span class="detail-value">${dateStr}</span></div>
      <div class="detail-row"><span class="detail-label">שעות</span><span class="detail-value">${data.startTime.slice(0,5)} – ${data.endTime.slice(0,5)}</span></div>
      <div class="detail-row" style="border:0"><span class="detail-label">לתשלום</span><span class="detail-value" style="color:#1a5f7a;font-size:18px">₪${data.pricePerStudent}</span></div>
    </div>
    <div style="background:#fff7ed;border-radius:10px;padding:16px;margin:16px 0;font-size:13px;color:#9a3412">
      <strong>שלב הבא:</strong> שלחי ₪${data.pricePerStudent} ישירות למדריכה דרך Bit, PayBox, או מזומן.
    </div>
    <a href="${appUrl}/classes/${data.bookingId}/pay" class="cta">לדף התשלום ←</a>
    <p style="font-size:12px;color:#aaa;text-align:center;margin-top:16px">
      לא נרשמת? פני לתמיכה: support@wellness-sea.co.il
    </p>
  `)

  await sendEmail(
    data.studentEmail,
    `נרשמת לשיעור ${data.classType ?? ''} עם ${data.instructorName}! 🌊`,
    html
  )
}

export async function sendBookingCancelledEmailToInstructor(data: BookingEmailData, reason?: string) {
  const dateStr = new Date(data.bookingDate).toLocaleDateString('he-IL', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const html = baseLayout(`
    <h2 style="color:#1a2e3b;margin-top:0">ההזמנה בוטלה</h2>
    <p style="color:#555">שלום ${data.instructorName},</p>
    <p style="color:#555">ההזמנה הבאה בוטלה${reason ? ` (${reason})` : ''}.</p>
    <div style="background:#f9fafb;border-radius:12px;padding:20px;margin:20px 0">
      <div class="detail-row"><span class="detail-label">מקום</span><span class="detail-value">${data.venueName}</span></div>
      <div class="detail-row"><span class="detail-label">תאריך</span><span class="detail-value">${dateStr}</span></div>
      <div class="detail-row" style="border:0"><span class="detail-label">שעות</span><span class="detail-value">${data.startTime.slice(0,5)} – ${data.endTime.slice(0,5)}</span></div>
    </div>
    <a href="${appUrl}/venues" class="cta">חפש חלל חלופי</a>
  `)

  await sendEmail(data.instructorEmail, `ביטול הזמנה - ${data.venueName}`, html)
}

export async function sendBookingCancelledEmailToHost(data: BookingEmailData, reason?: string) {
  const dateStr = new Date(data.bookingDate).toLocaleDateString('he-IL', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const html = baseLayout(`
    <h2 style="color:#1a2e3b;margin-top:0">הזמנה בוטלה</h2>
    <p style="color:#555">שלום ${data.hostName},</p>
    <p style="color:#555">הזמנה ב<strong>${data.venueName}</strong> בוטלה${reason ? ` (${reason})` : ''}.</p>
    <div style="background:#f9fafb;border-radius:12px;padding:20px;margin:20px 0">
      <div class="detail-row"><span class="detail-label">מדריכה</span><span class="detail-value">${data.instructorName}</span></div>
      <div class="detail-row"><span class="detail-label">תאריך</span><span class="detail-value">${dateStr}</span></div>
      <div class="detail-row" style="border:0"><span class="detail-label">שעות</span><span class="detail-value">${data.startTime.slice(0,5)} – ${data.endTime.slice(0,5)}</span></div>
    </div>
    <a href="${appUrl}/host-dashboard/bookings" class="cta">לניהול ההזמנות</a>
  `)

  await sendEmail(data.hostEmail, `ביטול הזמנה ב${data.venueName}`, html)
}
