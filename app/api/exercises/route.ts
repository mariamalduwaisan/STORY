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
  const workoutId = searchParams.get('workout_id')

  let query = client
    .from('exercises')
    .select('*')
    .order('created_at', { ascending: true })
  if (workoutId) query = query.eq('workout_id', workoutId)

  const { data, error } = await query
  if (error) return dbError('exercises.GET', error)
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const client = makeSupabaseClient(req)
  const { data: { user } } = await client.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  // Only allow known fields — no mass assignment
  const { workout_id, name, target_sets, target_reps, target_weight } = body
  if (!workout_id || !name) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

  const { data, error } = await client
    .from('exercises')
    .insert([{ workout_id, name, target_sets, target_reps, target_weight }])
    .select()
    .single()
  if (error) return dbError('exercises.POST', error)
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const client = makeSupabaseClient(req)
  const { data: { user } } = await client.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { error } = await client.from('exercises').delete().eq('id', id)
  if (error) return dbError('exercises.DELETE', error)
  return NextResponse.json({ success: true })
}
