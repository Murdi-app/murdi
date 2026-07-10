import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { createClient } = await import('@supabase/supabase-js')
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string
    )
    const name = String(body.name || '').trim()
    const phone = String(body.phone || '').trim()
    if (name.length < 2 || phone.length < 9) {
      return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 })
    }
    const answers = Array.isArray(body.answers) ? body.answers : []
    const score = Number(body.score) || 0
    const track = String(body.track || '')
    const src = body.src ? String(body.src) : null
    const completed = Boolean(body.completed)
    if (body.id) {
      await admin.from('mini_assessments').update({ answers, score, track, completed }).eq('id', String(body.id))
      return NextResponse.json({ id: String(body.id) })
    }
    const { data, error } = await admin.from('mini_assessments').insert({
      full_name: name, phone, answers, score, track, src, completed,
    }).select('id').single()
    if (error) throw error
    return NextResponse.json({ id: data.id })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'خطأ' }, { status: 500 })
  }
}
