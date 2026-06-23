import { NextRequest, NextResponse } from 'next/server'
import { makeSupabaseClient } from '@/lib/server-client'

function dbError(label: string, err: { message: string }) {
  console.error(JSON.stringify({ type: 'DB_ERROR', label, message: err.message, ts: new Date().toISOString() }))
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}

export async function GET(req: NextRequest) {
  const client = makeSupabaseClient(req)
  const { data: { user } } = await client.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await client
    .from('progress_metrics')
    .select('*')
    .order('recorded_at', { ascending: true })
  if (error) return dbError('progress.GET', error)
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const client = makeSupabaseClient(req)
  const { data: { user } } = await client.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  // Only allow known fields — no mass assignment
  const { weight_kg, body_fat_pct, notes, recorded_at } = body

  const { data, error } = await client
    .from('progress_metrics')
    .insert([{ weight_kg, body_fat_pct, notes, recorded_at, user_id: user.id }])
    .select()
    .single()
  if (error) return dbError('progress.POST', error)
  return NextResponse.json(data)
}
