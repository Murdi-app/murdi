import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const STATIC_BENCHMARKS = {
  avg_murdi_score: 48,
  avg_liquidity_months: 2.1,
  avg_debt_ratio: 0.65,
  avg_cash_flow_positive_months: 6,
  source: 'SAMA + وزارة التجارة 2024'
}

export async function GET() {
  const { data, error } = await supabase
    .from('market_benchmarks')
    .select('*')
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST() {
  try {
    for (const [metric, value] of Object.entries(STATIC_BENCHMARKS)) {
      if (metric === 'source') continue
      await supabase
        .from('market_benchmarks')
        .upsert({ 
          metric,
          value: value as number,
          source: STATIC_BENCHMARKS.source,
          updated_at: new Date().toISOString()
        }, { onConflict: 'metric' })
    }
    return NextResponse.json({ success: true, data: STATIC_BENCHMARKS })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
