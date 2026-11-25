import type { BookingRecord } from '../types/stadium';
import { apiFetch, getSessionId } from './apiClient';

export interface CreateOrderResponse {
  mode: 'razorpay' | 'sandbox';
  keyId?: string;
  orderId: string;
  amount: number;
  currency: string;
  expiresAt: number;
}

export async function createPaymentOrder(
  eventId: string,
  seatIds: string[],
): Promise<CreateOrderResponse> {
  return apiFetch<CreateOrderResponse>('/api/payments/create-order', {
    method: 'POST',
    body: JSON.stringify({
      eventId,
      seatIds,
      sessionId: getSessionId(),
    }),
  });
}

export async function verifyPaymentOrder(params: {
  orderId: string;
  paymentId?: string;
  signature?: string;
  simulateFailure?: boolean;
  seatSnapshots?: Record<string, string>;
  holderName?: string;
}): Promise<{ ok: boolean; booking: BookingRecord }> {
  return apiFetch<{ ok: boolean; booking: BookingRecord }>('/api/payments/verify', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}
