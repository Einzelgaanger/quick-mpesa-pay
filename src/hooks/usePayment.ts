
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PaymentData {
  phone_number: string;
  amount: number;
}

interface PaymentResponse {
  success: boolean;
  message: string;
  payment_id?: string;
  checkout_request_id?: string;
  error?: string;
}

export const usePayment = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const initiatePayment = async (paymentData: PaymentData): Promise<PaymentResponse> => {
    setLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('mpesa-stk-push', {
        body: paymentData
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.success) {
        toast({
          title: "STK Push Sent! 📱",
          description: data.message,
          duration: 5000
        });
        
        // Start polling for payment status
        if (data.payment_id) {
          pollPaymentStatus(data.payment_id);
        }
      }

      return data;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Payment failed';
      
      toast({
        title: "Payment Failed",
        description: errorMessage,
        variant: "destructive"
      });

      return {
        success: false,
        message: errorMessage,
        error: errorMessage
      };
    } finally {
      setLoading(false);
    }
  };

  const pollPaymentStatus = async (paymentId: string) => {
    const maxAttempts = 30; // Poll for 5 minutes (30 attempts * 10 seconds)
    let attempts = 0;

    const checkStatus = async () => {
      try {
        const { data: payment, error } = await supabase
          .from('payments')
          .select('status, mpesa_receipt_number')
          .eq('id', paymentId)
          .single();

        if (error) {
          console.error('Error checking payment status:', error);
          return;
        }

        if (payment.status === 'completed') {
          toast({
            title: "Payment Successful! ✅",
            description: `Payment completed. Receipt: ${payment.mpesa_receipt_number}`,
            duration: 8000
          });
          return;
        } else if (payment.status === 'failed') {
          toast({
            title: "Payment Failed ❌",
            description: "The payment was not successful. Please try again.",
            variant: "destructive",
            duration: 8000
          });
          return;
        } else if (payment.status === 'cancelled') {
          toast({
            title: "Payment Cancelled",
            description: "You cancelled the payment.",
            variant: "destructive",
            duration: 8000
          });
          return;
        }

        // Continue polling if still pending
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkStatus, 10000); // Check every 10 seconds
        } else {
          toast({
            title: "Payment Status Unknown",
            description: "Unable to confirm payment status. Please check your M-Pesa messages.",
            variant: "destructive",
            duration: 8000
          });
        }

      } catch (error) {
        console.error('Error polling payment status:', error);
      }
    };

    // Start polling after 5 seconds
    setTimeout(checkStatus, 5000);
  };

  return {
    initiatePayment,
    loading
  };
};
