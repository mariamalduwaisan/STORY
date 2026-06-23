const BASE_URL = process.env.MYFATOORAH_API_URL ?? 'https://apitest.myfatoorah.com'
const API_KEY  = process.env.MYFATOORAH_API_KEY!

const headers = () => ({
  Authorization:  `Bearer ${API_KEY}`,
  'Content-Type': 'application/json',
})

export async function getAvailablePaymentMethods(amount: number): Promise<{ PaymentMethodId: number; PaymentMethodEn: string }[]> {
  const res  = await fetch(`${BASE_URL}/v2/InitiatePayment`, {
    method:  'POST',
    headers: headers(),
    body: JSON.stringify({ InvoiceAmount: amount, CurrencyIso: 'KWD', CountryCode: 'KWT' }),
  })
  const json = await res.json()
  if (!json.IsSuccess) throw new Error(json.Message || 'InitiatePayment failed')
  const methods = json.Data.PaymentMethods as { PaymentMethodId: number; PaymentMethodEn: string }[]
  if (!methods?.length) throw new Error('No payment methods available')
  return methods
}

export async function executePayment(opts: {
  paymentMethodId: number
  sessionsCount:   number
  amountKwd:       number
  customerEmail:   string
  customerName:    string
  reference:       string
  callbackUrl:     string
  errorUrl:        string
}): Promise<{ invoiceId: number; paymentUrl: string }> {
  const res  = await fetch(`${BASE_URL}/v2/ExecutePayment`, {
    method:  'POST',
    headers: headers(),
    body: JSON.stringify({
      PaymentMethodId:    opts.paymentMethodId,
      CustomerName:       opts.customerName,
      DisplayCurrencyIso: 'KWD',
      MobileCountryCode:  '965',
      CustomerMobile:     '50000000',
      CustomerEmail:      opts.customerEmail,
      InvoiceValue:       opts.amountKwd,
      CallBackUrl:        opts.callbackUrl,
      ErrorUrl:           opts.errorUrl,
      Language:           'en',
      CustomerReference:  opts.reference,
      InvoiceItems: [{
        ItemName:  `${opts.sessionsCount} Training Sessions`,
        Quantity:  1,
        UnitPrice: opts.amountKwd,
      }],
    }),
  })
  const json = await res.json()
  if (!json.IsSuccess) {
    const detail = json.ValidationErrors?.map((e: { Error: string }) => e.Error).join(', ')
    throw new Error(detail || json.Message || 'ExecutePayment failed')
  }
  return { invoiceId: json.Data.InvoiceId, paymentUrl: json.Data.PaymentURL }
}

export async function getPaymentStatus(paymentId: string): Promise<string> {
  const res  = await fetch(`${BASE_URL}/v2/GetPaymentStatus`, {
    method:  'POST',
    headers: headers(),
    body: JSON.stringify({ Key: paymentId, KeyType: 'PaymentId' }),
  })
  const json = await res.json()
  if (!json.IsSuccess) throw new Error(json.Message || 'GetPaymentStatus failed')
  return json.Data.InvoiceStatus as string   // 'Paid' | 'Pending' | 'Failed' etc.
}
