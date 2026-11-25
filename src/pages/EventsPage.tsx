import { ArrowRight, Calendar, MapPin, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { EventRecord } from '../types/stadium';

interface EventsPageProps {
  events: EventRecord[];
  onExploreEvent: (eventId: string) => void;
}

export function EventsPage({ events, onExploreEvent }: EventsPageProps) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'on_sale' | 'selling_fast'>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((evt) => {
      if (statusFilter !== 'all' && evt.status !== statusFilter) return false;
      if (!q) return true;
      return (
        evt.title.toLowerCase().includes(q) ||
        evt.homeTeam.toLowerCase().includes(q) ||
        evt.awayTeam.toLowerCase().includes(q) ||
        evt.category.toLowerCase().includes(q)
      );
    });
  }, [events, query, statusFilter]);

  return (
    <div className="mx-auto max-w-[1440px] px-6 py-12 sm:px-10">
      <div className="flex flex-col gap-4 border-b border-slate-800/80 pb-8 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-white">Upcoming Cricket Matches</h1>
          <p className="mt-2 text-sm text-slate-400">
            Sample Indian T20 and ODI cricket fixtures are pre-loaded as demonstration data. Select a match to launch the interactive 3D stadium.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search teams or events..."
              className="w-60 rounded-lg border border-slate-700 bg-slate-900/90 py-2 pl-9 pr-3 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1 rounded-lg bg-slate-900 p-1">
            {(['all', 'on_sale', 'selling_fast'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  statusFilter === tab
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab === 'all' ? 'All Events' : tab === 'on_sale' ? 'On Sale' : 'Selling Fast'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-12 rounded-xl border border-slate-800 bg-[#0a1024] p-12 text-center">
          <p className="text-sm text-slate-300">No events match your search filter.</p>
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setStatusFilter('all');
            }}
            className="mt-4 rounded-lg border border-slate-700 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          {filtered.map((evt) => {
            const minPrice = Math.round(850 * evt.priceMultiplier);
            const maxPrice = Math.round(11500 * evt.priceMultiplier);
            return (
              <div
                key={evt.id}
                className="grid grid-cols-1 overflow-hidden rounded-xl border border-slate-800 bg-[#0a1024] lg:grid-cols-12"
              >
                <div className="aspect-[16/10] lg:aspect-auto lg:col-span-4 bg-slate-900">
                  <img
                    src={evt.imageUrl}
                    alt={evt.title}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                </div>

                <div className="flex flex-col justify-between p-6 lg:col-span-8">
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                      <span className="font-mono-tabular">
                        {evt.category} · {evt.isDemoData ? 'Demonstration Event' : 'Live Event'}
                      </span>
                      <span className="font-medium text-blue-400">
                        {evt.status === 'selling_fast'
                          ? 'Selling Fast'
                          : evt.status === 'sold_out'
                          ? 'Sold Out'
                          : 'Tickets Available'}
                      </span>
                    </div>

                    <h2 className="font-display mt-2 text-2xl font-bold text-white">
                      {evt.title}
                    </h2>
                    <p className="mt-1 text-sm font-medium text-blue-300">
                      {evt.homeTeam} vs {evt.awayTeam}
                    </p>
                    <p className="mt-3 text-sm leading-relaxed text-slate-300">
                      {evt.description}
                    </p>
                  </div>

                  <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-800/80 pt-4">
                    <div className="flex flex-wrap items-center gap-5 text-xs text-slate-300 font-mono-tabular">
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-blue-400" />
                        {evt.date} · {evt.time}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-blue-400" />
                        {evt.stadiumName}
                      </span>
                      <span>
                        Range:{' '}
                        <strong className="text-white">
                          ₹{minPrice.toLocaleString('en-IN')} – ₹{maxPrice.toLocaleString('en-IN')}
                        </strong>
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={evt.status === 'sold_out'}
                      onClick={() => onExploreEvent(evt.id)}
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-50 whitespace-nowrap"
                    >
                      Open 3D Seat Map
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
