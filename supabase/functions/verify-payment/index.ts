// Supabase Edge Function: verify-payment
// Verifies Razorpay HMAC-SHA256 signature on the server before issuing tickets.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const razorpaySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    if (!razorpaySecret) {
      return new Response(JSON.stringify({ error: 'RAZORPAY_KEY_SECRET not configured' }), { status: 500 });
    }

    const { bookingId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = await req.json();
    const expected = await hmacSha256Hex(razorpaySecret, `${razorpayOrderId}|${razorpayPaymentId}`);
    if (expected !== razorpaySignature) {
      return new Response(JSON.stringify({ error: 'Signature verification failed' }), { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    await supabase.from('bookings').update({ status: 'confirmed' }).eq('id', bookingId);
    return new Response(JSON.stringify({ verified: true, bookingId }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
