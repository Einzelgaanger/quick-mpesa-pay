
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

      console.log('Payment request received:', { phone_number, amount })

      // Get M-Pesa access token
      let accessToken;
      try {
        accessToken = await getMpesaAccessToken()
        console.log('Access token obtained successfully')
      } catch (error) {
        console.error('Failed to get access token:', error)
        return new Response(
          JSON.stringify({ error: 'Failed to authenticate with M-Pesa' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // Format phone number (ensure it starts with 254)
      const formattedPhone = formatPhoneNumber(phone_number)
      console.log('Formatted phone:', formattedPhone)
      
      // Generate timestamp
      const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)
      
      // Use sandbox test shortcode for paybill payments
      const shortcode = '174379' // Sandbox test shortcode for paybill
      const passkey = 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919' // Test passkey
      const password = btoa(shortcode + passkey + timestamp)

      console.log('Paybill configuration:', { shortcode, timestamp })

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

      if (paymentError) {
        console.error('Payment record creation error:', paymentError)
        return new Response(
          JSON.stringify({ error: 'Failed to create payment record' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log('Payment record created:', payment.id)

      // STK Push request for paybill payments
      const stkPushData = {
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline', // For paybill payments
        Amount: Math.round(amount),
        PartyA: formattedPhone,
        PartyB: shortcode,
        PhoneNumber: formattedPhone,
        CallBackURL: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mpesa-callback`,
        AccountReference: payment.id, // Use payment ID as reference
        TransactionDesc: 'Payment to BizLens'
      }

      console.log('STK Push request data:', stkPushData)

      try {
        const stkResponse = await fetch('https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(stkPushData)
        })

        const stkResult = await stkResponse.json()
        console.log('STK Push Response:', stkResult)

        if (stkResult.ResponseCode === '0') {
          // Update payment with M-Pesa details
          await supabaseClient
            .from('payments')
            .update({
              merchant_request_id: stkResult.MerchantRequestID,
              checkout_request_id: stkResult.CheckoutRequestID
            })
            .eq('id', payment.id)

          console.log('Payment updated with M-Pesa details')

          return new Response(
            JSON.stringify({
              success: true,
              message: 'Payment request sent to your phone',
              payment_id: payment.id,
              checkout_request_id: stkResult.CheckoutRequestID
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        } else {
          console.error('STK Push failed:', stkResult)
          return new Response(
            JSON.stringify({
              error: `Payment request failed: ${stkResult.errorMessage || stkResult.ResponseDescription || 'Unknown error'}`
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      } catch (fetchError) {
        console.error('Error calling M-Pesa API:', fetchError)
        return new Response(
          JSON.stringify({ error: 'Failed to communicate with M-Pesa API' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
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

  if (!response.ok) {
    throw new Error(`Failed to get access token: ${response.status} ${response.statusText}`)
  }

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
