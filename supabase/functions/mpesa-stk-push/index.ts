
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface STKPushRequest {
  phone_number: string;
  amount: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    if (req.method === 'POST') {
      const { phone_number, amount }: STKPushRequest = await req.json()

      // Get M-Pesa access token
      const accessToken = await getMpesaAccessToken()
      
      // Format phone number (ensure it starts with 254)
      const formattedPhone = formatPhoneNumber(phone_number)
      
      // Generate timestamp
      const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)
      
      // Generate password
      const shortcode = '174379' // Test shortcode
      const passkey = 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919' // Test passkey
      const password = btoa(shortcode + passkey + timestamp)

      // Create payment record
      const { data: payment, error: paymentError } = await supabaseClient
        .from('payments')
        .insert({
          phone_number: formattedPhone,
          amount: amount,
          status: 'pending'
        })
        .select()
        .single()

      if (paymentError) throw paymentError

      // STK Push request
      const stkPushData = {
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(amount),
        PartyA: formattedPhone,
        PartyB: shortcode,
        PhoneNumber: formattedPhone,
        CallBackURL: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mpesa-callback`,
        AccountReference: `Payment-${payment.id}`,
        TransactionDesc: 'Payment for services'
      }

      const stkResponse = await fetch('https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(stkPushData)
      })

      const stkResult = await stkResponse.json()

      if (stkResult.ResponseCode === '0') {
        // Update payment with M-Pesa details
        await supabaseClient
          .from('payments')
          .update({
            merchant_request_id: stkResult.MerchantRequestID,
            checkout_request_id: stkResult.CheckoutRequestID
          })
          .eq('id', payment.id)

        return new Response(
          JSON.stringify({
            success: true,
            message: 'STK Push sent successfully',
            payment_id: payment.id,
            checkout_request_id: stkResult.CheckoutRequestID
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } else {
        throw new Error(`STK Push failed: ${stkResult.errorMessage || 'Unknown error'}`)
      }
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function getMpesaAccessToken(): Promise<string> {
  const consumerKey = Deno.env.get('MPESA_CONSUMER_KEY')
  const consumerSecret = Deno.env.get('MPESA_CONSUMER_SECRET')
  
  if (!consumerKey || !consumerSecret) {
    throw new Error('M-Pesa credentials not configured')
  }

  const auth = btoa(`${consumerKey}:${consumerSecret}`)
  
  const response = await fetch('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
    headers: {
      'Authorization': `Basic ${auth}`
    }
  })

  const data = await response.json()
  
  if (!data.access_token) {
    throw new Error('Failed to get M-Pesa access token')
  }
  
  return data.access_token
}

function formatPhoneNumber(phone: string): string {
  const cleanPhone = phone.replace(/\D/g, '')
  if (cleanPhone.startsWith('0')) {
    return '254' + cleanPhone.substring(1)
  }
  if (cleanPhone.startsWith('254')) {
    return cleanPhone
  }
  return '254' + cleanPhone
}
