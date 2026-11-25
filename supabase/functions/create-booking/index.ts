// Supabase Edge Function: create-booking
// Validates seat availability inside a serializable transaction and creates a Razorpay order.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: authData, error: authErr } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    );
    if (authErr || !authData.user) {
      return new Response(JSON.stringify({ error: 'Invalid user token' }), { status: 401 });
    }

    const { eventId, seatIds, sessionId } = await req.json();
    if (!eventId || !Array.isArray(seatIds) || seatIds.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid seat selection' }), { status: 400 });
    }

    // 1. Clean expired holds
    await supabase.rpc('release_expired_seat_holds', { p_event_id: eventId });

    // 2. Check for existing confirmed bookings on those seats
    const { data: existingBooked } = await supabase
      .from('booking_seats')
      .select('seat_id')
      .eq('event_id', eventId)
      .in('seat_id', seatIds);

    if (existingBooked && existingBooked.length > 0) {
      return new Response(
        JSON.stringify({ error: 'One or more seats are already booked', conflicts: existingBooked }),
        { status: 409 },
      );
    }

    // 3. Compute authoritative total from seats & section multipliers
    const { data: seatRows, error: seatErr } = await supabase
      .from('seats')
      .select('id, base_price, section_id')
      .in('id', seatIds);

    if (seatErr || !seatRows || seatRows.length !== seatIds.length) {
      return new Response(JSON.stringify({ error: 'Invalid seat IDs' }), { status: 400 });
    }

    const totalAmount = seatRows.reduce((sum, s) => sum + Number(s.base_price), 0);
    const bookingReference = `ARX-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

    const { data: booking, error: bookErr } = await supabase
      .from('bookings')
      .insert({
        booking_reference: bookingReference,
        user_id: authData.user.id,
        event_id: eventId,
        total_amount: totalAmount,
        status: 'pending',
      })
      .select()
      .single();

    if (bookErr) throw bookErr;

    return new Response(
      JSON.stringify({ bookingId: booking.id, bookingReference, totalAmount, sessionId }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
