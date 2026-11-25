import crypto from 'crypto';

export interface PaymentExecutionResult {
  success: boolean;
  paymentRef?: string;
  error?: string;
}

export const SimulatedPaymentService = {
  async execute(
    amount: number,
    _idempotencyKey: string,
    reason?: string
  ): Promise<PaymentExecutionResult> {
    // Deterministic failure hook for testing FAILED refund path (06-BACKEND-SPEC §4)
    const cents = Math.round(amount * 100) % 100;
    if (cents === 99 && reason && reason.toUpperCase().includes('FAIL')) {
      return {
        success: false,
        error: 'Simulated payment gateway declined the transaction',
      };
    }

    return {
      success: true,
      paymentRef: `SIM-${crypto.randomUUID()}`,
    };
  },
};
