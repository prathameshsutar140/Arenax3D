import { AlertTriangle, CheckCircle2, Clock, CreditCard, ShieldCheck, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { createPaymentOrder, verifyPaymentOrder, type CreateOrderResponse } from '../services/paymentService';
import type { BookingRecord, EventRecord, SeatRecord } from '../types/stadium';
import { HolographicTicket } from './HolographicTicket';

interface CheckoutModalProps {
  open: boolean;
  event: EventRecord;
  selectedSeats: SeatRecord[];
  seatSnapshots: Record<string, string>;
  sectionMultipliers: Record<string, number>;
  holdExpiresAt: number | null;
  onRequireAuth: () => void;
  onCaptureMissingSnapshots: (seats: SeatRecord[]) => Record<string, string>;
  onBookingConfirmed: (booking: BookingRecord) => void;
  onClose: () => void;
}

export function CheckoutModal({
  open,
  event,
  selectedSeats,
  seatSnapshots,
  sectionMultipliers,
  holdExpiresAt,
  onRequireAuth,
  onCaptureMissingSnapshots,
  onBookingConfirmed,
  onClose,
}: CheckoutModalProps) {
  const { user, isAuthenticated } = useAuth();
  const [step, setStep] = useState<'review' | 'payment' | 'confirmed'>('review');
  const [order, setOrder] = useState<CreateOrderResponse | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<BookingRecord | null>(null);
  const [holderName, setHolderName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);

  useEffect(() => {
    if (user?.fullName && !holderName) {
      setHolderName(user.fullName);
    }
  }, [user, holderName]);

  useEffect(() => {
    if (!open) {
      setStep('review');
      setOrder(null);
      setConfirmedBooking(null);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    const targetExpiry = order?.expiresAt ?? holdExpiresAt;
    if (!open || !targetExpiry) return;
    const tick = () => {
      setSecondsLeft(Math.max(0, Math.floor((targetExpiry - Date.now()) / 1000)));
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [open, holdExpiresAt, order]);

  const computedItems = useMemo(() => {
    return selectedSeats.map((seat) => {
      const secMult = sectionMultipliers[seat.sectionId] ?? 1.0;
      const price = Math.round(seat.basePrice * event.priceMultiplier * secMult);
      return { seat, price };
    });
  }, [selectedSeats, sectionMultipliers, event.priceMultiplier]);

  const totalAmount = useMemo(
    () => computedItems.reduce((sum, item) => sum + item.price, 0),
    [computedItems],
  );

  if (!open) return null;

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleCreateOrder = async () => {
    if (!isAuthenticated) {
      onRequireAuth();
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const created = await createPaymentOrder(
        event.id,
        selectedSeats.map((s) => s.id),
      );
      setOrder(created);
      setStep('payment');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create booking order.');
    } finally {
      setLoading(false);
    }
  };

  const handleCompletePayment = async (simulateFailure = false) => {
    if (!order) return;
    setLoading(true);
    setError(null);
    try {
      // Ensure every booked seat has a genuine 3D pitch snapshot captured from its coordinates
      const missing = selectedSeats.filter((s) => !seatSnapshots[s.id]);
      const extraSnaps = missing.length > 0 ? onCaptureMissingSnapshots(missing) : {};
      const mergedSnapshots = { ...seatSnapshots, ...extraSnaps };

      const res = await verifyPaymentOrder({
        orderId: order.orderId,
        simulateFailure,
        seatSnapshots: mergedSnapshots,
        holderName: holderName.trim() || user?.fullName,
      });

      setConfirmedBooking(res.booking);
      setStep('confirmed');
      onBookingConfirmed(res.booking);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment verification failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 overflow-y-auto">
      <div className="my-8 w-full max-w-3xl rounded-2xl border border-slate-800 bg-[#080d20] p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h2 className="font-display text-xl font-bold text-white">
              {step === 'confirmed' ? 'Booking Confirmed — Holographic Tickets Issued' : 'Complete Your ArenaX Booking'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              {event.title} · {event.date} · {event.time}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {step !== 'confirmed' && holdExpiresAt && (
              <div className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-950/30 px-3 py-1.5 text-xs font-mono-tabular text-amber-200">
                <Clock className="h-3.5 w-3.5" />
                Hold: {formatTimer(secondsLeft)}
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close checkout"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Step 1: Review */}
        {step === 'review' && (
          <div className="mt-5 space-y-5">
            <div className="divide-y divide-slate-800/80 rounded-xl border border-slate-800 bg-slate-900/50">
              {computedItems.map(({ seat, price }) => (
                <div key={seat.id} className="flex items-center justify-between gap-4 p-4">
                  <div className="flex items-center gap-3.5 min-w-0">
                    {seatSnapshots[seat.id] ? (
                      <img
                        src={seatSnapshots[seat.id]}
                        alt={`Seat ${seat.id} preview`}
                        className="h-12 w-20 shrink-0 rounded-md border border-slate-700 object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-20 shrink-0 items-center justify-center rounded-md border border-slate-700 bg-slate-950 text-[10px] text-slate-400">
                        3D Auto-Snap
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white truncate">
                        {seat.sectionName}
                      </div>
                      <div className="text-xs text-slate-400 font-mono-tabular">
                        Row {seat.row} · Seat {seat.seatNumber} · {seat.tier} Tier
                      </div>
                    </div>
                  </div>
                  <div className="font-mono-tabular text-sm font-semibold text-white shrink-0">
                    ₹{price.toLocaleString('en-IN')}
                  </div>
                </div>
              ))}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Ticket Holder Name (Printed on Digital Pass)
              </label>
              <input
                type="text"
                value={holderName}
                onChange={(e) => setHolderName(e.target.value)}
                placeholder={user?.fullName || 'Enter full name'}
                className="w-full rounded-lg border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="text-sm text-slate-300">
                Total ({selectedSeats.length} {selectedSeats.length === 1 ? 'Seat' : 'Seats'})
              </div>
              <div className="font-mono-tabular text-2xl font-bold text-white">
                ₹{totalAmount.toLocaleString('en-IN')}
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-rose-500/40 bg-rose-950/50 p-3 text-xs text-rose-200">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              {!isAuthenticated ? (
                <button
                  type="button"
                  onClick={onRequireAuth}
                  className="w-full rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500"
                >
                  Sign In or Register to Lock & Pay
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCreateOrder}
                  disabled={loading || selectedSeats.length === 0}
                  className="w-full rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
                >
                  {loading
                    ? 'Creating Server Payment Order...'
                    : `Continue to Payment · ₹${totalAmount.toLocaleString('en-IN')}`}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Payment Verification */}
        {step === 'payment' && order && (
          <div className="mt-5 space-y-5">
            <div className="rounded-xl border border-blue-500/30 bg-blue-950/20 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-blue-200">
                  <ShieldCheck className="h-4 w-4" />
                  {order.mode === 'sandbox'
                    ? 'Sandbox / Demo Payment Mode (No Real Charge)'
                    : 'Razorpay Verified Checkout'}
                </span>
                <span className="font-mono-tabular text-xs text-slate-400">
                  Order: {order.orderId}
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {order.mode === 'sandbox'
                  ? 'Live payment credentials (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET) are not configured in this environment. Test either a verified sandbox settlement or a simulated payment decline below.'
                  : 'Complete your payment securely via Razorpay. Your booking is only finalized after server-side signature verification.'}
              </p>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <div>
                <div className="text-xs text-slate-400">Amount Due (Server-Calculated)</div>
                <div className="font-mono-tabular text-2xl font-bold text-white mt-0.5">
                  ₹{order.amount.toLocaleString('en-IN')} {order.currency}
                </div>
              </div>
              <CreditCard className="h-7 w-7 text-blue-400" />
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-rose-500/40 bg-rose-950/50 p-3 text-xs text-rose-200">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleCompletePayment(false)}
                disabled={loading}
                className="rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
              >
                {loading ? 'Verifying & Issuing Tickets...' : 'Authorize Sandbox Payment'}
              </button>

              <button
                type="button"
                onClick={() => handleCompletePayment(true)}
                disabled={loading}
                className="rounded-lg border border-rose-500/40 bg-rose-950/30 px-4 py-3 text-sm font-medium text-rose-200 transition-colors hover:bg-rose-900/40 disabled:opacity-50"
              >
                Simulate Payment Failure
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Confirmed Holographic Tickets */}
        {step === 'confirmed' && confirmedBooking && (
          <div className="mt-5 space-y-6">
            <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-950/30 p-4 text-sm text-emerald-200">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
              <div>
                Payment verified and seats locked permanently under reference{' '}
                <strong className="font-mono-tabular text-white">{confirmedBooking.bookingReference}</strong>.
              </div>
            </div>

            <div className="space-y-6">
              {confirmedBooking.tickets.map((tkt) => (
                <HolographicTicket key={tkt.id} ticket={tkt} />
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-700 bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
