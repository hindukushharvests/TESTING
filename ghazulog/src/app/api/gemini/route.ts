import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(req: Request) {
  try {
    // Require login to prevent quota abuse
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (n) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { tradingData } = await req.json()
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY not set in .env.local' }, { status: 400 })

    const prompt = `You are an expert professional trading coach with 20 years of experience. Analyze this trader's performance data and give them specific, actionable coaching advice.

TRADER STATS:
${JSON.stringify(tradingData, null, 2)}

Provide a detailed analysis covering:
1. 🏆 TOP 3 STRENGTHS - What they do well
2. ⚠️ TOP 3 WEAKNESSES - What's hurting their performance  
3. 🎯 SPECIFIC RULES TO ADD - Exact rules they should add to their trading plan
4. 📅 TIMING - Best days/hours to trade based on their data
5. 🧠 PSYCHOLOGY - Mental game improvements needed
6. 🎯 30-DAY ACTION PLAN - Specific steps to improve

Be direct, specific, and tough but fair. Use their actual numbers. Format with clear sections.`

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 1500 }
      })
    })

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: `Gemini API error: ${err}` }, { status: 400 })
    }

    const data = await res.json()
    const analysis = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from Gemini'
    return NextResponse.json({ analysis })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
