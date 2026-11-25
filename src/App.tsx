import { useCallback, useEffect, useState } from 'react';
import { AuthModal } from './components/AuthModal';
import { Navbar, type AppRoute } from './components/Navbar';
import { AuthProvider } from './contexts/AuthContext';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { EventsPage } from './pages/EventsPage';
import { HomePage } from './pages/HomePage';
import { MyTicketsPage } from './pages/MyTicketsPage';
import { StadiumExplorerPage } from './pages/StadiumExplorerPage';
import { fetchEvents } from './services/bookingService';
import type { EventRecord } from './types/stadium';

function ArenaXAppShell() {
  const [route, setRoute] = useState<AppRoute>('home');
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const [events, setEvents] = useState<EventRecord[]>([]);
  const [activeEventId, setActiveEventId] = useState<string>('');
  const [sectionMultipliers, setSectionMultipliers] = useState<Record<string, number>>({});
  const [eventsError, setEventsError] = useState<string | null>(null);

  const loadCatalog = useCallback(async () => {
    try {
      setEventsError(null);
      const data = await fetchEvents();
      setEvents(data.events);
      setSectionMultipliers(data.sectionMultipliers);
      setActiveEventId((prev) => prev || data.events[0]?.id || '');
    } catch (err) {
      setEventsError(err instanceof Error ? err.message : 'Unable to connect to ArenaX server.');
    }
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const handleExploreStadium = (eventId?: string) => {
    if (eventId) setActiveEventId(eventId);
    setRoute('explore');
  };

  return (
    <div className="min-h-screen bg-[#050814] text-slate-100">
      <Navbar
        activeRoute={route}
        onNavigate={setRoute}
        onOpenAuth={() => setAuthModalOpen(true)}
      />

      {eventsError && (
        <div className="mx-auto max-w-[1440px] px-6 pt-4">
          <div className="flex items-center justify-between rounded-lg border border-rose-500/40 bg-rose-950/50 px-4 py-2.5 text-xs text-rose-200">
            <span>{eventsError}</span>
            <button
              type="button"
              onClick={loadCatalog}
              className="rounded border border-rose-400/40 px-2.5 py-1 font-semibold hover:bg-rose-900/40"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      <main>
        {route === 'home' && (
          <HomePage
            events={events}
            onExploreStadium={handleExploreStadium}
            onNavigate={setRoute}
          />
        )}

        {route === 'explore' && (
          <StadiumExplorerPage
            events={events}
            activeEventId={activeEventId}
            onSelectEventId={setActiveEventId}
            sectionMultipliers={sectionMultipliers}
            onRequireAuth={() => setAuthModalOpen(true)}
            onBookingComplete={loadCatalog}
          />
        )}

        {route === 'events' && (
          <EventsPage
            events={events}
            onExploreEvent={(id) => handleExploreStadium(id)}
          />
        )}

        {route === 'tickets' && (
          <MyTicketsPage
            onOpenAuth={() => setAuthModalOpen(true)}
            onExploreStadium={() => handleExploreStadium()}
          />
        )}

        {route === 'admin' && (
          <AdminDashboardPage onEventsUpdated={loadCatalog} />
        )}
      </main>

      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ArenaXAppShell />
    </AuthProvider>
  );
}
