
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Smartphone, CreditCard } from 'lucide-react';

interface PaymentFormProps {}

const PaymentForm: React.FC<PaymentFormProps> = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Validate Kenya phone number format
  const validatePhoneNumber = (phone: string): boolean => {
    const cleanPhone = phone.replace(/\D/g, '');
    const kenyanPattern = /^(254|0)(7|1)\d{8}$/;
    return kenyanPattern.test(cleanPhone);
  };

  // Format phone number to international format
  const formatPhoneNumber = (phone: string): string => {
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) {
      return '254' + cleanPhone.substring(1);
    }
    if (cleanPhone.startsWith('254')) {
      return cleanPhone;
    }
    return '254' + cleanPhone;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phoneNumber || !amount) {
      toast({
        title: "Missing Information",
        description: "Please enter both phone number and amount",
        variant: "destructive"
      });
      return;
    }

    if (!validatePhoneNumber(phoneNumber)) {
      toast({
        title: "Invalid Phone Number",
        description: "Please enter a valid Kenyan phone number (e.g., 0700000000)",
        variant: "destructive"
      });
      return;
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount < 1) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount (minimum KES 1)",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      // Here you would integrate with M-Pesa Daraja API
      // For demo purposes, we'll simulate the API call
      console.log('Initiating M-Pesa STK Push...');
      console.log('Phone:', formatPhoneNumber(phoneNumber));
      console.log('Amount:', numericAmount);
      console.log('Business Number: 0700861129');
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast({
        title: "STK Push Sent! 📱",
        description: `Check your phone (${phoneNumber}) for the M-Pesa payment prompt`,
        duration: 5000
      });

      // Reset form
      setPhoneNumber('');
      setAmount('');
      
    } catch (error) {
      console.error('Payment error:', error);
      toast({
        title: "Payment Failed",
        description: "Something went wrong. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md payment-card shadow-lg border-0">
      <CardHeader className="text-center pb-4">
        <div className="w-16 h-16 mx-auto mb-4 bg-mpesa-green rounded-full flex items-center justify-center">
          <Smartphone className="w-8 h-8 text-white" />
        </div>
        <CardTitle className="text-2xl font-bold text-gray-800">M-Pesa Payment</CardTitle>
        <CardDescription className="text-gray-600">
          Enter your details to make a secure payment
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-sm font-medium text-gray-700">
              Phone Number
            </Label>
            <div className="relative">
              <Smartphone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="phone"
                type="tel"
                placeholder="0700000000"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="pl-10 text-base"
                disabled={loading}
              />
            </div>
            <p className="text-xs text-gray-500">Enter your M-Pesa registered number</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount" className="text-sm font-medium text-gray-700">
              Amount (KES)
            </Label>
            <div className="relative">
              <CreditCard className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="amount"
                type="number"
                placeholder="100"
                min="1"
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-10 text-base"
                disabled={loading}
              />
            </div>
            <p className="text-xs text-gray-500">Minimum amount: KES 1</p>
          </div>

          <Button 
            type="submit" 
            className="w-full bg-mpesa-green hover:bg-mpesa-green-dark text-white font-semibold py-3 text-base transition-all duration-200 transform hover:scale-[1.02]"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending STK Push...
              </>
            ) : (
              'Pay with M-Pesa'
            )}
          </Button>
        </form>

        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-600 text-center">
            You will receive a payment prompt on your phone. Enter your M-Pesa PIN to complete the transaction.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default PaymentForm;
