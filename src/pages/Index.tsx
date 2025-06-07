
import PaymentForm from '@/components/PaymentForm';

const Index = () => {
  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            Quick Pay
          </h1>
          <p className="text-white/90 text-lg">
            Fast and secure M-Pesa payments
          </p>
        </div>
        
        <PaymentForm />
        
        <div className="mt-8 text-center">
          <p className="text-white/80 text-sm">
            Powered by M-Pesa Daraja API
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
