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
  const priority = searchParams.get('priority')
  const status   = searchParams.get('status')

  let query = client
    .from('workouts')
    .select('*')
    .order('created_at', { ascending: false })

  if (priority && priority !== 'all') query = query.eq('priority', priority)
  if (status   && status   !== 'all') query = query.eq('status',   status)

  const { data, error } = await query
  if (error) return dbError('workouts.GET', error)
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const client = makeSupabaseClient(req)
  const { data: { user } } = await client.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  // Only allow known fields — no mass assignment
  const { title, description, status, priority, scheduled_date, image_url } = body
  if (!title) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

  const { data, error } = await client
    .from('workouts')
    .insert([{ title, description, status, priority, scheduled_date, image_url, user_id: user.id }])
    .select()
    .single()
  if (error) return dbError('workouts.POST', error)
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const client = makeSupabaseClient(req)
  const { data: { user } } = await client.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { id, ...rest } = body
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { data: existing } = await client
    .from('workouts').select('id, user_id').eq('id', id).single()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.user_id !== user.id) {
    console.error(JSON.stringify({ type: 'SECURITY', event: 'FORBIDDEN_UPDATE', userId: user.id, targetId: id, ts: new Date().toISOString() }))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Only allow known fields — drop user_id and id from updates
  const { title, description, status, priority, scheduled_date, image_url } = rest
  const { data, error } = await client
    .from('workouts')
    .update({ title, description, status, priority, scheduled_date, image_url, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) return dbError('workouts.PATCH', error)
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const client = makeSupabaseClient(req)
  const { data: { user } } = await client.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { data: existing } = await client
    .from('workouts').select('id, user_id').eq('id', id).single()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.user_id !== user.id) {
    console.error(JSON.stringify({ type: 'SECURITY', event: 'FORBIDDEN_DELETE', userId: user.id, targetId: id, ts: new Date().toISOString() }))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await client.from('workouts').delete().eq('id', id)
  if (error) return dbError('workouts.DELETE', error)
  return NextResponse.json({ success: true })
}
