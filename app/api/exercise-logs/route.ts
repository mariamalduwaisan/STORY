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

  const { searchParams } = new URL(req.url)
  const exerciseId = searchParams.get('exercise_id')

  let query = client
    .from('exercise_logs')
    .select('*')
    .order('logged_at', { ascending: false })
  if (exerciseId) query = query.eq('exercise_id', exerciseId)

  const { data, error } = await query
  if (error) return dbError('exercise_logs.GET', error)
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const client = makeSupabaseClient(req)
  const { data: { user } } = await client.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  // Only allow known fields — no mass assignment
  const { exercise_id, set_number, reps, weight, notes } = body
  if (!exercise_id || set_number == null || reps == null) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { data, error } = await client
    .from('exercise_logs')
    .insert([{ exercise_id, set_number, reps, weight, notes }])
    .select()
    .single()
  if (error) return dbError('exercise_logs.POST', error)
  return NextResponse.json(data)
}
