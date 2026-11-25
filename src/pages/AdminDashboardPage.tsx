import { BarChart3, CalendarPlus, IndianRupee, Layers, Lock, ShieldCheck, Ticket } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../services/apiClient';
import type { BookingRecord, EventRecord } from '../types/stadium';
import { getStadiumLayout } from '../utils/stadiumLayout';

interface AdminOverviewResponse {
  totalRevenue: number;
  totalTickets: number;
  totalBookings: number;
  totalSeats: number;
  events: EventRecord[];
  sectionMultipliers: Record<string, number>;
  bookings: BookingRecord[];
  eventOccupancy: Array<{
    eventId: string;
    title: string;
    bookedCount: number;
    heldCount: number;
    totalSeats: number;
    occupancyPct: number;
  }>;
}

interface AdminDashboardPageProps {
  onEventsUpdated: () => void;
}

export function AdminDashboardPage({ onEventsUpdated }: AdminDashboardPageProps) {
  const { isAdmin, adminLogin, adminBootstrap } = useAuth();
  const [statusLoading, setStatusLoading] = useState(true);
  const [requiresClaim, setRequiresClaim] = useState(false);

  // Admin auth form state
  const [claimName, setClaimName] = useState('');
  const [claimEmail, setClaimEmail] = useState('');
  const [passcode, setPasscode] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  // Dashboard data
  const [tab, setTab] = useState<'overview' | 'events' | 'pricing' | 'bookings'>('overview');
  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // New Event form
  const [newTitle, setNewTitle] = useState('');
  const [newHome, setNewHome] = useState('');
  const [newAway, setNewAway] = useState('');
  const [newDate, setNewDate] = useState('2027-02-14');
  const [newTime, setNewTime] = useState('19:30 IST');
  const [newCategory, setNewCategory] = useState('Premier T20 League');
  const [newDesc, setNewDesc] = useState('');
  const [newMult, setNewMult] = useState(1.0);

  const layout = getStadiumLayout();

  useEffect(() => {
    apiFetch<{ requiresClaim: boolean }>('/api/admin/status')
      .then((res) => setRequiresClaim(res.requiresClaim))
      .catch(() => {})
      .finally(() => setStatusLoading(false));
  }, []);

  const loadOverview = useCallback(async () => {
    if (!isAdmin) return;
    setLoadingData(true);
    try {
      const data = await apiFetch<AdminOverviewResponse>('/api/admin/overview');
      setOverview(data);
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'Failed to load admin overview.');
    } finally {
      setLoadingData(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const handleAdminAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthBusy(true);
    try {
      if (requiresClaim) {
        await adminBootstrap(claimName, claimEmail, passcode);
      } else {
        await adminLogin(passcode);
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Admin authentication failed.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionMessage(null);
    try {
      await apiFetch('/api/admin/events', {
        method: 'POST',
        body: JSON.stringify({
          title: newTitle,
          homeTeam: newHome,
          awayTeam: newAway,
          date: newDate,
          time: newTime,
          category: newCategory,
          description: newDesc,
          priceMultiplier: Number(newMult),
          status: 'on_sale',
        }),
      });
      setNewTitle('');
      setNewHome('');
      setNewAway('');
      setNewDesc('');
      setActionMessage('Event created and published to stadium catalog.');
      onEventsUpdated();
      await loadOverview();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'Could not create event.');
    }
  };

  const handleUpdateEventStatus = async (eventId: string, status: EventRecord['status']) => {
    try {
      await apiFetch(`/api/admin/events/${encodeURIComponent(eventId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      onEventsUpdated();
      await loadOverview();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'Failed to update event.');
    }
  };

  const handleUpdateSectionMultiplier = async (sectionId: string, multiplier: number) => {
    try {
      await apiFetch(`/api/admin/sections/${encodeURIComponent(sectionId)}/pricing`, {
        method: 'PATCH',
        body: JSON.stringify({ multiplier }),
      });
      setActionMessage(`Updated Section ${sectionId} price multiplier to ${multiplier.toFixed(2)}x.`);
      onEventsUpdated();
      await loadOverview();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'Failed to update section pricing.');
    }
  };

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md px-6 py-16">
        <div className="rounded-2xl border border-slate-800 bg-[#0a1024] p-7 shadow-2xl">
          <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
            <Lock className="h-5 w-5 text-blue-400" />
            <div>
              <h1 className="font-display text-xl font-bold text-white">
                {requiresClaim ? 'Claim Administrator Access' : 'Administrator Sign In'}
              </h1>
              <p className="text-xs text-slate-400">
                Server-verified role protection
              </p>
            </div>
          </div>

          {statusLoading ? (
            <p className="mt-6 text-sm text-slate-400">Checking administrator status...</p>
          ) : (
            <form onSubmit={handleAdminAuth} className="mt-5 space-y-4">
              {requiresClaim && (
                <>
                  <p className="rounded-lg border border-blue-500/30 bg-blue-950/30 p-3 text-xs text-blue-200 leading-relaxed">
                    No administrator passcode is set in environment variables yet. Claim initial admin access below by choosing your own passcode.
                  </p>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Admin Name</label>
                    <input
                      type="text"
                      required
                      minLength={2}
                      value={claimName}
                      onChange={(e) => setClaimName(e.target.value)}
                      placeholder="Arena Director"
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Admin Email</label>
                    <input
                      type="email"
                      required
                      value={claimEmail}
                      onChange={(e) => setClaimEmail(e.target.value)}
                      placeholder="admin@arenax3d.io"
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {requiresClaim ? 'Create Admin Passcode (min 6 chars)' : 'Administrator Passcode'}
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Enter passcode"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              {authError && (
                <div className="rounded-lg border border-rose-500/40 bg-rose-950/50 p-3 text-xs text-rose-200">
                  {authError}
                </div>
              )}

              <button
                type="submit"
                disabled={authBusy}
                className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {authBusy ? 'Verifying...' : requiresClaim ? 'Claim & Enter Admin Console' : 'Unlock Admin Dashboard'}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1440px] px-6 py-10 sm:px-10">
      <div className="flex flex-col gap-4 border-b border-slate-800/80 pb-6 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400">
            <ShieldCheck className="h-4 w-4" />
            Verified Administrator Session
          </div>
          <h1 className="font-display mt-1 text-3xl font-bold text-white">ArenaX Control Center</h1>
        </div>

        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-900 p-1">
          {(
            [
              { id: 'overview', label: 'Analytics' },
              { id: 'events', label: 'Events' },
              { id: 'pricing', label: 'Section Pricing' },
              { id: 'bookings', label: 'Bookings & Tickets' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`rounded-md px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                tab === item.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {actionMessage && (
        <div className="mt-5 rounded-lg border border-blue-500/40 bg-blue-950/30 px-4 py-2.5 text-xs text-blue-200">
          {actionMessage}
        </div>
      )}

      {loadingData && !overview ? (
        <div className="mt-8 h-64 animate-pulse rounded-xl border border-slate-800 bg-slate-900/60" />
      ) : overview ? (
        <div className="mt-8 space-y-8">
          {tab === 'overview' && (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-slate-800 bg-[#0a1024] p-5">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Confirmed Revenue</span>
                    <IndianRupee className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div className="font-mono-tabular mt-2 text-2xl font-bold text-white">
                    ₹{overview.totalRevenue.toLocaleString('en-IN')}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-[#0a1024] p-5">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Tickets Issued</span>
                    <Ticket className="h-4 w-4 text-blue-400" />
                  </div>
                  <div className="font-mono-tabular mt-2 text-2xl font-bold text-white">
                    {overview.totalTickets}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-[#0a1024] p-5">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Active Events</span>
                    <BarChart3 className="h-4 w-4 text-purple-400" />
                  </div>
                  <div className="font-mono-tabular mt-2 text-2xl font-bold text-white">
                    {overview.events.length}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-[#0a1024] p-5">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Arena Capacity</span>
                    <Layers className="h-4 w-4 text-cyan-400" />
                  </div>
                  <div className="font-mono-tabular mt-2 text-2xl font-bold text-white">
                    {overview.totalSeats.toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-[#0a1024] p-6">
                <h2 className="font-display text-lg font-bold text-white">Event Seat Occupancy</h2>
                <div className="mt-5 space-y-4">
                  {overview.eventOccupancy.map((row) => (
                    <div key={row.eventId} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-200">{row.title}</span>
                        <span className="font-mono-tabular text-slate-400">
                          {row.bookedCount.toLocaleString()} booked · {row.heldCount} held · {row.occupancyPct}%
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-900">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                          style={{ width: `${Math.min(100, row.occupancyPct)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {tab === 'events' && (
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
              <form
                onSubmit={handleCreateEvent}
                className="space-y-4 rounded-xl border border-slate-800 bg-[#0a1024] p-6 lg:col-span-5"
              >
                <div className="flex items-center gap-2 text-base font-bold text-white">
                  <CalendarPlus className="h-4 w-4 text-blue-400" />
                  Create New Event
                </div>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Match Title (e.g. T20 Qualifier 1)"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm text-white"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    value={newHome}
                    onChange={(e) => setNewHome(e.target.value)}
                    placeholder="Home Team"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm text-white"
                  />
                  <input
                    type="text"
                    required
                    value={newAway}
                    onChange={(e) => setNewAway(e.target.value)}
                    placeholder="Away Team"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="date"
                    required
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm text-white"
                  />
                  <input
                    type="text"
                    required
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    placeholder="19:30 IST"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="Category"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm text-white"
                  />
                  <input
                    type="number"
                    step="0.05"
                    min="0.2"
                    max="5"
                    value={newMult}
                    onChange={(e) => setNewMult(Number(e.target.value))}
                    placeholder="Price Multiplier"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm text-white font-mono-tabular"
                  />
                </div>
                <textarea
                  required
                  rows={3}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Event description..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm text-white"
                />
                <button
                  type="submit"
                  className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
                >
                  Publish Event
                </button>
              </form>

              <div className="space-y-3 lg:col-span-7">
                {overview.events.map((evt) => (
                  <div
                    key={evt.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-[#0a1024] p-4"
                  >
                    <div>
                      <div className="text-sm font-bold text-white">{evt.title}</div>
                      <div className="text-xs text-slate-400 font-mono-tabular">
                        {evt.homeTeam} vs {evt.awayTeam} · {evt.date} · {evt.priceMultiplier}x pricing
                      </div>
                    </div>
                    <select
                      value={evt.status}
                      onChange={(e) =>
                        handleUpdateEventStatus(evt.id, e.target.value as EventRecord['status'])
                      }
                      className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white"
                    >
                      <option value="on_sale">On Sale</option>
                      <option value="selling_fast">Selling Fast</option>
                      <option value="sold_out">Sold Out</option>
                      <option value="draft">Draft (Hidden)</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'pricing' && (
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#0a1024]">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 bg-slate-900/70 text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Section</th>
                    <th className="px-4 py-3 font-medium">Tier</th>
                    <th className="px-4 py-3 font-medium text-right">Seats</th>
                    <th className="px-4 py-3 font-medium text-right">Base Range</th>
                    <th className="px-4 py-3 font-medium text-right">Multiplier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {layout.sections.map((sec) => {
                    const mult = overview.sectionMultipliers[sec.id] ?? 1.0;
                    return (
                      <tr key={sec.id} className="hover:bg-slate-900/40">
                        <td className="px-4 py-2.5 font-medium text-white">{sec.name}</td>
                        <td className="px-4 py-2.5 text-slate-300">{sec.tier}</td>
                        <td className="px-4 py-2.5 text-right font-mono-tabular text-slate-300">
                          {sec.totalSeats}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono-tabular text-slate-300">
                          ₹{Math.round(sec.minPrice * mult).toLocaleString('en-IN')} – ₹{Math.round(sec.maxPrice * mult).toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <select
                            value={mult.toFixed(2)}
                            onChange={(e) =>
                              handleUpdateSectionMultiplier(sec.id, Number(e.target.value))
                            }
                            className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-mono-tabular text-white"
                          >
                            <option value="0.80">0.80x</option>
                            <option value="1.00">1.00x</option>
                            <option value="1.15">1.15x</option>
                            <option value="1.30">1.30x</option>
                            <option value="1.50">1.50x</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'bookings' && (
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#0a1024]">
              {overview.bookings.length === 0 ? (
                <div className="p-10 text-center text-sm text-slate-400">
                  No bookings recorded yet. Complete a ticket checkout in the 3D Stadium to see live records here.
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-800 bg-slate-900/70 text-slate-400">
                    <tr>
                      <th className="px-4 py-3 font-medium">Reference</th>
                      <th className="px-4 py-3 font-medium">Buyer</th>
                      <th className="px-4 py-3 font-medium">Event</th>
                      <th className="px-4 py-3 font-medium">Seats</th>
                      <th className="px-4 py-3 font-medium text-right">Total</th>
                      <th className="px-4 py-3 font-medium text-right">Provider</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {overview.bookings.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-900/40">
                        <td className="px-4 py-3 font-mono-tabular font-semibold text-blue-300">
                          {b.bookingReference}
                        </td>
                        <td className="px-4 py-3 text-slate-200">{b.userEmail}</td>
                        <td className="px-4 py-3 text-slate-300">{b.eventTitle}</td>
                        <td className="px-4 py-3 font-mono-tabular text-slate-300">
                          {b.seatIds.join(', ')}
                        </td>
                        <td className="px-4 py-3 text-right font-mono-tabular font-semibold text-white">
                          ₹{b.totalAmount.toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-400">{b.paymentProvider}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
