import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { getPaymentStatus } from '@/lib/myfatoorah'

// Uses anon key — mark_purchase_paid runs as SECURITY DEFINER so RLS is bypassed safely
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Props {
  searchParams: Promise<{ paymentId?: string; Id?: string }>
}

export default async function PaymentSuccess({ searchParams }: Props) {
  const params    = await searchParams
  const paymentId = params.paymentId ?? params.Id ?? null

  if (paymentId) {
    try {
      const json = await fetch(
        `https://apitest.myfatoorah.com/v2/GetPaymentStatus`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.MYFATOORAH_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ Key: paymentId, KeyType: 'PaymentId' }),
        }
      ).then(r => r.json())

      if (json.IsSuccess && json.Data.InvoiceStatus === 'Paid') {
        const invoiceId = String(json.Data.InvoiceId)
        await supabase.rpc('mark_purchase_paid', { p_invoice_id: invoiceId })
      }
    } catch {
      // best-effort — don't block the page
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#000',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '32px 24px', textAlign: 'center',
    }}>
      <div style={{ position: 'relative', width: 120, height: 120, marginBottom: 32 }}>
        <svg viewBox="0 0 120 120" style={{ position: 'absolute', inset: 0 }}>
          <circle cx="60" cy="60" r="52" fill="none" stroke="#A5F04420" strokeWidth="8" />
          <circle
            cx="60" cy="60" r="52"
            fill="none" stroke="#A5F044" strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 52}`}
            strokeDashoffset="0"
            transform="rotate(-90 60 60)"
            style={{ filter: 'drop-shadow(0 0 8px #A5F044)' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 40,
        }}>✓</div>
      </div>

      <h1 style={{ color: '#fff', fontSize: 32, fontWeight: 800, marginBottom: 36 }}>
        Successful
      </h1>

      <Link href="/" style={{
        padding: '15px 44px', borderRadius: 14,
        background: '#A5F044', color: '#000',
        fontSize: 16, fontWeight: 800, textDecoration: 'none',
      }}>
        Let&apos;s Go →
      </Link>
    </div>
  )
}
