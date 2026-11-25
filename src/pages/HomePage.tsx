import { ArrowRight, Compass, Eye, QrCode, ShieldCheck } from 'lucide-react';
import type { EventRecord } from '../types/stadium';
import type { AppRoute } from '../components/Navbar';

interface HomePageProps {
  events: EventRecord[];
  onExploreStadium: (eventId?: string) => void;
  onNavigate: (route: AppRoute) => void;
}

export function HomePage({ events, onExploreStadium, onNavigate }: HomePageProps) {
  const featured = events[0];

  const steps = [
    {
      num: '01.',
      title: 'Explore the 3D Cricket Oval',
      desc: 'Orbit smoothly across 40 curved stands and three open-air decks inside the ArenaX Cricket Stadium.',
    },
    {
      num: '02.',
      title: 'Select Exact Stand Seats',
      desc: 'Zoom into any row and pick from 14,064 individually indexed seats with real-time availability.',
    },
    {
      num: '03.',
      title: 'Inspect Eye-Level Pitch View',
      desc: 'Step directly into your seat coordinates to verify sightlines to the 22-yard pitch, stumps, and scoreboard.',
    },
    {
      num: '04.',
      title: 'Claim Holographic Ticket',
      desc: 'Complete verified INR checkout to mint a downloadable holographic pass with your captured 3D seat view and QR.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#050814] text-slate-100">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-slate-800/80">
        <div className="mx-auto grid max-w-[1440px] grid-cols-1 lg:grid-cols-12 lg:items-stretch">
          <div className="flex flex-col justify-center px-6 py-16 sm:px-10 lg:col-span-6 lg:py-24">
            <p className="text-xs font-medium tracking-wide text-blue-400">
              {featured
                ? `${featured.stadiumName} · ${featured.date} · ${featured.time}`
                : 'ArenaX Cricket Stadium · India'}
            </p>
            <h1 className="font-display mt-4 text-balance text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-[3.5rem] lg:leading-[1.08]">
              Preview every pitch sightline before you book.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300">
              Navigate 14,064 individually mapped seats inside a procedural WebGL cricket stadium.
              Step into any stand row for an eye-level pitch preview and mint a verified holographic pass.
            </p>

            {featured && (
              <div className="mt-6 border-t border-slate-800/80 pt-5 text-sm text-slate-300">
                <span className="font-semibold text-white">Featured Match:</span>{' '}
                {featured.title} — {featured.homeTeam} vs {featured.awayTeam}{' '}
                <span className="text-slate-400">(Demonstration Event)</span>
              </div>
            )}

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => onExploreStadium(featured?.id)}
                className="inline-flex items-center gap-2.5 rounded-lg bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 whitespace-nowrap shrink-0"
              >
                Explore 3D Stadium
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('events')}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/70 px-5 py-3.5 text-sm font-medium text-slate-200 transition-colors hover:border-slate-500 hover:text-white whitespace-nowrap shrink-0"
              >
                Browse Upcoming Events
              </button>
            </div>
          </div>

          <div className="relative min-h-[320px] lg:col-span-6 lg:min-h-[540px]">
            <img
              src="/src/assets/images/hero_cricket_stadium_night_1795594095865.jpg"
              alt="ArenaX 3D cricket stadium oval illuminated under floodlights prior to first ball"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover lg:h-full"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#050814] via-[#050814]/35 to-transparent lg:via-transparent" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#050814] via-transparent to-transparent" />
          </div>
        </div>
      </section>

      {/* 4-Column Stadium Architecture Strip */}
      <section className="border-b border-slate-800/80 bg-[#070b1b]">
        <div className="mx-auto grid max-w-[1440px] grid-cols-2 divide-y divide-slate-800/80 sm:grid-cols-4 sm:divide-y-0 sm:divide-x">
          <div className="px-6 py-7">
            <div className="font-mono-tabular text-2xl font-bold text-white sm:text-3xl">14,064</div>
            <div className="mt-1 text-xs text-slate-400">Indexed 3D Instanced Seats</div>
          </div>
          <div className="px-6 py-7">
            <div className="font-mono-tabular text-2xl font-bold text-white sm:text-3xl">40</div>
            <div className="mt-1 text-xs text-slate-400">Lower, Club & Upper Stands</div>
          </div>
          <div className="px-6 py-7">
            <div className="font-mono-tabular text-2xl font-bold text-blue-400 sm:text-3xl">360°</div>
            <div className="mt-1 text-xs text-slate-400">True-Coordinate Pitch Sightlines</div>
          </div>
          <div className="px-6 py-7">
            <div className="font-mono-tabular text-2xl font-bold text-purple-400 sm:text-3xl">5 min</div>
            <div className="mt-1 text-xs text-slate-400">Transactional Seat Hold Lock</div>
          </div>
        </div>
      </section>

      {/* Upcoming Events Section */}
      <section className="mx-auto max-w-[1440px] px-6 py-16 sm:px-10">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div>
            <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">
              Upcoming Cricket Matches
            </h2>
            <p className="mt-1.5 text-sm text-slate-400">
              Sample Indian T20 and ODI fixtures loaded for demonstration. Select any match to enter the live 3D seat map.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('events')}
            className="text-sm font-medium text-blue-400 hover:text-blue-300 whitespace-nowrap"
          >
            View All Events →
          </button>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          {events.slice(0, 3).map((evt) => (
            <article
              key={evt.id}
              className="group flex flex-col overflow-hidden rounded-xl border border-slate-800 bg-[#0a1024] transition-colors hover:border-blue-500/50"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-slate-900">
                <img
                  src={evt.imageUrl}
                  alt={evt.title}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0a1024] via-transparent to-transparent" />
              </div>

              <div className="flex flex-1 flex-col justify-between p-6">
                <div>
                  <div className="text-xs text-slate-400 font-mono-tabular">
                    {evt.category} · {evt.date} · {evt.time}
                  </div>
                  <h3 className="font-display mt-2 text-lg font-bold text-white">
                    {evt.title}
                  </h3>
                  <p className="mt-1 text-sm text-blue-300">
                    {evt.homeTeam} vs {evt.awayTeam}
                  </p>
                  <p className="mt-2.5 text-xs leading-relaxed text-slate-400">
                    {evt.description}
                  </p>
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-slate-800/80 pt-4">
                  <span className="text-xs text-slate-400">
                    {evt.isDemoData ? 'Demonstration Data' : 'Live Event'}
                  </span>
                  <button
                    type="button"
                    onClick={() => onExploreStadium(evt.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-500 whitespace-nowrap"
                  >
                    Select Seats in 3D
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="border-t border-slate-800/80 bg-[#070b1b]">
        <div className="mx-auto max-w-[1440px] px-6 py-16 sm:px-10">
          <div className="max-w-2xl">
            <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">
              How ArenaX 3D Ticketing Works
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Every seat is positioned mathematically inside the WebGL stadium so your preview matches reality.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, idx) => {
              const Icon = [Compass, ShieldCheck, Eye, QrCode][idx];
              return (
                <div
                  key={step.num}
                  className="rounded-xl border border-slate-800/90 bg-[#0a1024] p-6"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono-tabular text-sm font-semibold text-blue-400">
                      {step.num}
                    </span>
                    <Icon className="h-4 w-4 text-slate-400" />
                  </div>
                  <h3 className="font-display mt-4 text-base font-bold text-white">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-slate-400">
                    {step.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-800/80 bg-[#040712]">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <div>
            <div className="font-display text-base font-bold text-white">ArenaX 3D</div>
            <p className="mt-1 text-xs text-slate-500">
              Interactive 3D Stadium Ticketing Platform · Sample events and sandbox payments are provided for demonstration.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs text-slate-400">
            <button type="button" onClick={() => onExploreStadium()} className="hover:text-white">
              3D Stadium
            </button>
            <button type="button" onClick={() => onNavigate('events')} className="hover:text-white">
              Events
            </button>
            <button type="button" onClick={() => onNavigate('tickets')} className="hover:text-white">
              My Tickets
            </button>
            <button type="button" onClick={() => onNavigate('admin')} className="hover:text-white">
              Admin Console
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
