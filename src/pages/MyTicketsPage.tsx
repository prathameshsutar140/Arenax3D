import { Ticket } from 'lucide-react';
import { useEffect, useState } from 'react';
import { HolographicTicket } from '../components/HolographicTicket';
import { useAuth } from '../contexts/AuthContext';
import { fetchMyBookings } from '../services/ticketService';
import type { BookingRecord } from '../types/stadium';

interface MyTicketsPageProps {
  onOpenAuth: () => void;
  onExploreStadium: () => void;
}

export function MyTicketsPage({ onOpenAuth, onExploreStadium }: MyTicketsPageProps) {
  const { isAuthenticated, user } = useAuth();
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setBookings([]);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    fetchMyBookings()
      .then((list) => {
        if (active) setBookings(list);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load tickets.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  const allTickets = bookings.flatMap((b) => b.tickets);

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-12 sm:px-10">
      <div className="border-b border-slate-800/80 pb-6">
        <h1 className="font-display text-3xl font-bold text-white">My Holographic Tickets</h1>
        <p className="mt-1.5 text-sm text-slate-400">
          {user
            ? `Showing verified ArenaX 3D digital passes for ${user.email}`
            : 'Sign in to view, download, and print your booked holographic passes.'}
        </p>
      </div>

      {!isAuthenticated ? (
        <div className="mt-10 rounded-xl border border-slate-800 bg-[#0a1024] p-10 text-center">
          <Ticket className="mx-auto h-10 w-10 text-blue-400" />
          <h2 className="font-display mt-4 text-xl font-bold text-white">Sign in to access your passes</h2>
          <p className="mt-2 text-sm text-slate-400">
            Your confirmed 3D seat views, QR entry tokens, and booking receipts are linked to your ArenaX account.
          </p>
          <button
            type="button"
            onClick={onOpenAuth}
            className="mt-6 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
          >
            Sign In / Register
          </button>
        </div>
      ) : loading ? (
        <div className="mt-10 space-y-4">
          <div className="h-56 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/60" />
          <div className="h-56 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/60" />
        </div>
      ) : error ? (
        <div className="mt-10 rounded-xl border border-rose-500/40 bg-rose-950/40 p-6 text-sm text-rose-200">
          {error}
        </div>
      ) : allTickets.length === 0 ? (
        <div className="mt-10 rounded-xl border border-slate-800 bg-[#0a1024] p-10 text-center">
          <Ticket className="mx-auto h-10 w-10 text-slate-500" />
          <h2 className="font-display mt-4 text-xl font-bold text-white">No booked tickets yet</h2>
          <p className="mt-2 text-sm text-slate-400">
            Explore the 3D cricket stadium, preview an eye-level pitch view, and book your first seat to mint a holographic pass.
          </p>
          <button
            type="button"
            onClick={onExploreStadium}
            className="mt-6 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
          >
            Explore 3D Stadium
          </button>
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {allTickets.map((ticket) => (
            <HolographicTicket key={ticket.id} ticket={ticket} />
          ))}
        </div>
      )}
    </div>
  );
}
