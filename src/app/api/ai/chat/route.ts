import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getVenues, getHappeningNowVenues } from '@/lib/supabase/queries'

export const runtime = 'nodejs'
export const maxDuration = 30

const SYSTEM_PROMPT = `אתה סוכן AI של פלטפורמת WELLNESS&SEA — מרקטפלייס המחבר מסעדות חוף עם מדריכות יוגה ופילאטיס.
אתה מדבר עברית בלבד, בטון חברותי, מקצועי וחם.

## מה שאתה יכול לעשות:
1. **חיפוש חללים** — לפי עיר, קיבולת, תקציב, שעה, ציוד
2. **שיעורים מתרחשים עכשיו** — להציג חללים עם שיעורים פעילים ברגע זה
3. **המלצת שעות שכירות** — לפי גודל החלל ומספר משתתפים
4. **חיפוש לפי מיקום** — כשהמשתמשת שותפת מיקום

## כללי התנהגות:
- כשמדריכה מחפשת חלל: שאלי על עיר, משתתפים, תקציב, ושעה
- כשיש מספיק מידע — קראי ל-search_venues
- כשמשתמשת שואלת "מה קורה עכשיו" / "שיעורים פעילים" — קראי ל-get_happening_now
- כשמשתמשת שולחת מיקום — השתמשי ב-city שמסופק לחיפוש קרוב
- המלצות שעות: < 50מ"ר → שעה, 50-80מ"ר → 1.5 שעות, > 80מ"ר → 2 שעות

## בידול WELLNESS&SEA:
- אנחנו היחידים שמתמחים במרחבי חוף וים בישראל
- כל חלל עם גישה לחוף, נוף לים, מאוורר טבעי
- בונוסים בלעדיים לסיום השיעור (מיץ, קפה, פרי)
- מחיר שקוף — ללא עמלות נסתרות`

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface ToolUse {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

interface ContentBlock {
  type: 'text' | 'tool_use'
  text?: string
  id?: string
  name?: string
  input?: Record<string, unknown>
}

async function searchVenues(input: Record<string, unknown>) {
  const venues = await getVenues({
    city: input.city as string | undefined,
    minCapacity: input.min_capacity as number | undefined,
    maxPrice: input.max_price as number | undefined,
    date: input.date as string | undefined,
    startTime: input.start_time as string | undefined,
    amenities: input.amenities as string[] | undefined,
  })
  return venues.slice(0, 6)
}

async function getHappeningNow() {
  return getHappeningNowVenues(6)
}

function getRecommendedHours(input: Record<string, unknown>) {
  const sqm = (input.space_size_sqm as number) ?? 0
  const cap = (input.capacity as number) ?? 0
  if (sqm > 80 || cap > 20) return { hours: 2, label: '2 שעות', reason: 'חלל גדול — אידיאלי לקבוצות גדולות' }
  if (sqm >= 50 || cap >= 10) return { hours: 1.5, label: '1.5 שעות', reason: 'חלל בינוני — הזמן המאוזן ביותר' }
  return { hours: 1, label: 'שעה', reason: 'חלל קטן — אינטנסיבי וממוקד' }
}

const TOOLS = [
  {
    name: 'search_venues',
    description: 'חיפוש חללים זמינים. השתמשי כשיש מספיק מידע ממשתמש.',
    input_schema: {
      type: 'object',
      properties: {
        city: { type: 'string', description: 'עיר החיפוש (ת"א, חיפה, הרצליה...)' },
        min_capacity: { type: 'number', description: 'מינימום משתתפים' },
        max_price: { type: 'number', description: 'מחיר מקסימלי לשעה ₪' },
        date: { type: 'string', description: 'תאריך YYYY-MM-DD' },
        start_time: { type: 'string', description: 'שעת התחלה HH:MM' },
        amenities: { type: 'array', items: { type: 'string' }, description: 'מתקנים נדרשים (ac, shower, sea_view...)' },
      },
    },
  },
  {
    name: 'get_happening_now',
    description: 'מחזיר חללים עם שיעורים פעילים ברגע זה. קרא כשמשתמשת שואלת מה קורה עכשיו.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_recommended_hours',
    description: 'המלץ על משך שכירות מיטבי לפי גודל חלל וקיבולת.',
    input_schema: {
      type: 'object',
      properties: {
        space_size_sqm: { type: 'number', description: 'שטח החלל במ"ר' },
        capacity: { type: 'number', description: 'קיבולת מקסימלית' },
      },
    },
  },
]

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const body = await req.json()
  const messages: Message[] = body.messages ?? []
  // Optional: user's location city passed from client
  const userCity: string | undefined = body.userCity

  if (!messages.length) {
    return new Response(JSON.stringify({ error: 'No messages' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (!anthropicKey) {
    return new Response(JSON.stringify({ error: 'AI not configured' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
  const apiKey: string = anthropicKey

  // Inject location context into the last user message if available
  const enrichedMessages = userCity
    ? messages.map((m, i) =>
        i === messages.length - 1 && m.role === 'user'
          ? { ...m, content: `[מיקום המשתמשת: ${userCity}]\n${m.content}` }
          : m
      )
    : messages

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()

      function send(event: string, data: string) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`))
      }

      function sendText(text: string) {
        send('message', `0:${JSON.stringify(text)}`)
      }

      async function callAnthropic(msgs: Message[]) {
        return fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1024,
            system: SYSTEM_PROMPT,
            messages: msgs,
            tools: TOOLS,
          }),
        })
      }

      try {
        const firstResponse = await callAnthropic(enrichedMessages)

        if (!firstResponse.ok) {
          sendText('מצטערת, אירעה שגיאה. אנא נסי שוב.')
          controller.close()
          return
        }

        const firstData = await firstResponse.json()

        const toolUseBlock = firstData.content?.find(
          (b: ContentBlock) => b.type === 'tool_use'
        ) as ToolUse | undefined

        if (toolUseBlock) {
          let toolResult: unknown

          if (toolUseBlock.name === 'search_venues') {
            const venueResults = await searchVenues(toolUseBlock.input)

            const secondResponse = await callAnthropic([
              ...enrichedMessages,
              { role: 'assistant', content: firstData.content },
              {
                role: 'user',
                content: [{
                  type: 'tool_result',
                  tool_use_id: toolUseBlock.id,
                  content: JSON.stringify({ venues: venueResults, count: venueResults.length }),
                }],
              },
            ] as Message[])

            if (!secondResponse.ok) {
              sendText('מצטערת, אירעה שגיאה בחיפוש. אנא נסי שוב.')
              controller.close()
              return
            }

            const secondData = await secondResponse.json()
            const responseText = secondData.content?.find((b: ContentBlock) => b.type === 'text')?.text ?? ''
            sendText(responseText)

            if (venueResults.length > 0) {
              sendText(`\n__VENUES_JSON__${JSON.stringify(venueResults)}__VENUES_END__`)
            }
          } else if (toolUseBlock.name === 'get_happening_now') {
            const nowVenues = await getHappeningNow()
            toolResult = { venues: nowVenues, count: nowVenues.length }

            const secondResponse = await callAnthropic([
              ...enrichedMessages,
              { role: 'assistant', content: firstData.content },
              {
                role: 'user',
                content: [{
                  type: 'tool_result',
                  tool_use_id: toolUseBlock.id,
                  content: JSON.stringify(toolResult),
                }],
              },
            ] as Message[])

            if (!secondResponse.ok) {
              sendText('מצטערת, אירעה שגיאה. אנא נסי שוב.')
              controller.close()
              return
            }

            const secondData = await secondResponse.json()
            const responseText = secondData.content?.find((b: ContentBlock) => b.type === 'text')?.text ?? ''
            sendText(responseText)

            if (nowVenues.length > 0) {
              sendText(`\n__VENUES_JSON__${JSON.stringify(nowVenues)}__VENUES_END__`)
            }
          } else if (toolUseBlock.name === 'get_recommended_hours') {
            toolResult = getRecommendedHours(toolUseBlock.input)

            const secondResponse = await callAnthropic([
              ...enrichedMessages,
              { role: 'assistant', content: firstData.content },
              {
                role: 'user',
                content: [{
                  type: 'tool_result',
                  tool_use_id: toolUseBlock.id,
                  content: JSON.stringify(toolResult),
                }],
              },
            ] as Message[])

            const secondData = await secondResponse.json()
            const responseText = secondData.content?.find((b: ContentBlock) => b.type === 'text')?.text ?? ''
            sendText(responseText)
          }
        } else {
          const textContent = firstData.content?.find((b: ContentBlock) => b.type === 'text')?.text ?? ''
          sendText(textContent)
        }

        send('message', 'd:{"finishReason":"stop"}')
      } catch (err) {
        console.error('AI chat error:', err)
        sendText('מצטערת, אירעה שגיאה. אנא נסי שוב.')
        send('message', 'd:{"finishReason":"error"}')
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
