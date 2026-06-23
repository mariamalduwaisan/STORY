import { NextRequest, NextResponse } from 'next/server'
import { makeSupabaseClient } from '@/lib/server-client'
import { executePayment } from '@/lib/myfatoorah'
import { rateLimit } from '@/lib/rate-limit'

const PACKAGES: Record<number, number> = { 10: 100, 20: 200, 30: 300 }
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

export async function POST(req: NextRequest) {
  const client = makeSupabaseClient(req)
  const { data: { user } } = await client.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Rate limit: 5 payment attempts per user per 10 minutes
  if (!rateLimit(`purchase:${user.id}`, 5, 10 * 60 * 1000)) {
    console.error(JSON.stringify({ type: 'SECURITY', event: 'RATE_LIMITED', userId: user.id, ts: new Date().toISOString() }))
    return NextResponse.json({ error: 'Too many requests. Please wait before trying again.' }, { status: 429 })
  }

  const { sessionsCount, paymentMethodId = 2 } = await req.json()
  const amountKwd = PACKAGES[sessionsCount as number]
  if (!amountKwd) return NextResponse.json({ error: 'Invalid package' }, { status: 400 })
  if (![1, 2].includes(paymentMethodId)) return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 })

  try {
    const reference = `TJ-${sessionsCount}S-${user.id.slice(0, 8)}-${Date.now()}`

    const { invoiceId, paymentUrl } = await executePayment({
      paymentMethodId,
      sessionsCount,
      amountKwd,
      customerEmail: user.email ?? 'customer@example.com',
      customerName:  user.email?.split('@')[0] ?? 'Customer',
      reference,
      callbackUrl: `${SITE_URL}/payment/success`,
      errorUrl:    `${SITE_URL}/payment/error`,
    })

    await client.from('purchases').insert([{
      user_id:           user.id,
      sessions_count:    sessionsCount,
      amount_kwd:        amountKwd,
      invoice_id:        String(invoiceId),
      payment_reference: reference,
      status:            'pending',
    }])

    return NextResponse.json({ paymentUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Payment initiation failed'
    console.error(JSON.stringify({ type: 'PAYMENT_ERROR', userId: user.id, message, ts: new Date().toISOString() }))
    return NextResponse.json({ error: 'Payment could not be initiated. Please try again.' }, { status: 500 })
  }
}
