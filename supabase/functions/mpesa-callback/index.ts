import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    if (req.method === 'POST') {
      const callbackData = await req.json()
      
      console.log('M-Pesa Callback received:', JSON.stringify(callbackData, null, 2))

      const { Body } = callbackData
      const { stkCallback } = Body

      if (stkCallback) {
        const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc } = stkCallback

        // Find the payment record
        const { data: payment, error: findError } = await supabaseClient
          .from('payments')
          .select('*')
          .eq('checkout_request_id', CheckoutRequestID)
          .single()

        if (findError || !payment) {
          console.error('Payment not found:', findError)
          return new Response('Payment not found', { status: 404 })
        }

        // Log the callback
        await supabaseClient
          .from('mpesa_callbacks')
          .insert({
            payment_id: payment.id,
            callback_data: callbackData
          })

        let status = 'failed'
        let mpesaReceiptNumber = null

        if (ResultCode === 0) {
          // Payment successful
          status = 'completed'
          
          // Extract M-Pesa receipt number from callback items
          if (stkCallback.CallbackMetadata?.Item) {
            const receiptItem = stkCallback.CallbackMetadata.Item.find(
              (item: any) => item.Name === 'MpesaReceiptNumber'
            )
            if (receiptItem) {
              mpesaReceiptNumber = receiptItem.Value
            }
          }
        } else if (ResultCode === 1032) {
          // User cancelled
          status = 'cancelled'
        } else {
          // Other failure
          status = 'failed'
        }

        // Update payment status
        const { error: updateError } = await supabaseClient
          .from('payments')
          .update({
            status: status,
            mpesa_receipt_number: mpesaReceiptNumber
          })
          .eq('id', payment.id)

        if (updateError) {
          console.error('Error updating payment:', updateError)
        }

        console.log(`Payment ${payment.id} updated to status: ${status}`)
      }

      return new Response('OK', { status: 200 })

    } else {
      return new Response('Method not allowed', { status: 405 })
    }

  } catch (error) {
    console.error('Callback error:', error)
    return new Response('Internal server error', { status: 500 })
  }
})
