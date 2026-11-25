import {
  AlertTriangle,
  Camera,
  ChevronDown,
  ChevronUp,
  Compass,
  Eye,
  Orbit,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckoutModal } from '../components/CheckoutModal';
import {
  fetchEventSeats,
  holdSeats,
  releaseSeats,
  subscribeSeatUpdates,
} from '../services/bookingService';
import type { CameraPreset } from '../three/CameraController';
import { StadiumScene, isWebGLSupported } from '../three/StadiumScene';
import type {
  BookingRecord,
  EventRecord,
  SeatRecord,
  SeatStateDelta,
  SeatTier,
  SectionDefinition,
} from '../types/stadium';
import { getStadiumLayout } from '../utils/stadiumLayout';

interface StadiumExplorerPageProps {
  events: EventRecord[];
  activeEventId: string;
  onSelectEventId: (id: string) => void;
  sectionMultipliers: Record<string, number>;
  onRequireAuth: () => void;
  onBookingComplete: () => void;
}

export function StadiumExplorerPage({
  events,
  activeEventId,
  onSelectEventId,
  sectionMultipliers: initialSectionMultipliers,
  onRequireAuth,
  onBookingComplete,
}: StadiumExplorerPageProps) {
  const layout = useMemo(() => getStadiumLayout(), []);
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<StadiumScene | null>(null);

  const [webglOk] = useState(() => isWebGLSupported());
  const [contextLost, setContextLost] = useState(false);

  const [seatDelta, setSeatDelta] = useState<SeatStateDelta>({
    heldByMe: [],
    heldByOthers: [],
    booked: [],
    holdExpiresAt: {},
  });
  const [liveSectionMults, setLiveSectionMults] = useState<Record<string, number>>(
    initialSectionMultsFallback(initialSectionMultipliers),
  );
  const [loadingSeats, setLoadingSeats] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [tierFilter, setTierFilter] = useState<SeatTier | 'ALL'>('ALL');
  const [activeSection, setActiveSection] = useState<SectionDefinition | null>(null);
  const [hoveredSection, setHoveredSection] = useState<SectionDefinition | null>(null);
  const [hoverScreenPos, setHoverScreenPos] = useState<{ x: number; y: number } | null>(null);
  const [hoveredSeat, setHoveredSeat] = useState<SeatRecord | null>(null);

  const [selectedSeats, setSelectedSeats] = useState<SeatRecord[]>([]);
  const [focusedSeatForPreview, setFocusedSeatForPreview] = useState<SeatRecord | null>(null);
  const [isSeatView, setIsSeatView] = useState(false);
  const [autoRotateOn, setAutoRotateOn] = useState(true);
  const [seatSnapshots, setSeatSnapshots] = useState<Record<string, string>>({});
  const [snapshotNotice, setSnapshotNotice] = useState<string | null>(null);

  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [holdExpiresAt, setHoldExpiresAt] = useState<number | null>(null);
  const [holdBusy, setHoldBusy] = useState(false);

  const activeEvent = useMemo(
    () => events.find((e) => e.id === activeEventId) || events[0],
    [events, activeEventId],
  );

  const seatDeltaRef = useRef(seatDelta);
  seatDeltaRef.current = seatDelta;

  function initialSectionMultsFallback(mults: Record<string, number>) {
    return mults && Object.keys(mults).length > 0 ? mults : {};
  }

  const getSeatPrice = useCallback(
    (seat: SeatRecord) => {
      const evtMult = activeEvent?.priceMultiplier ?? 1.0;
      const secMult = liveSectionMults[seat.sectionId] ?? 1.0;
      return Math.round(seat.basePrice * evtMult * secMult);
    },
    [activeEvent, liveSectionMults],
  );

  useEffect(() => {
    if (!activeEvent) return;
    let active = true;
    setLoadingSeats(true);
    setStatusError(null);
    setSelectedSeats([]);
    setFocusedSeatForPreview(null);
    setHoldExpiresAt(null);

    fetchEventSeats(activeEvent.id)
      .then((res) => {
        if (!active) return;
        setSeatDelta(res.delta);
        setLiveSectionMults(res.sectionMultipliers);
      })
      .catch((err) => {
        if (!active) return;
        setStatusError(err instanceof Error ? err.message : 'Unable to sync stadium seats.');
      })
      .finally(() => {
        if (active) setLoadingSeats(false);
      });

    const unsub = subscribeSeatUpdates(activeEvent.id, (msg) => {
      setSeatDelta((prev) => {
        const booked = new Set(prev.booked);
        const heldByOthers = new Set(prev.heldByOthers);
        const heldByMe = new Set(prev.heldByMe);

        if (msg.type === 'seat:booked') {
          msg.seatIds.forEach((id) => {
            booked.add(id);
            heldByOthers.delete(id);
            heldByMe.delete(id);
          });
        } else if (msg.type === 'seat:held') {
          msg.seatIds.forEach((id) => {
            if (!booked.has(id) && !heldByMe.has(id)) {
              heldByOthers.add(id);
            }
          });
        } else if (msg.type === 'seat:released') {
          msg.seatIds.forEach((id) => {
            heldByOthers.delete(id);
          });
        }

        return {
          booked: Array.from(booked),
          heldByOthers: Array.from(heldByOthers),
          heldByMe: Array.from(heldByMe),
          holdExpiresAt: prev.holdExpiresAt,
        };
      });
    });

    return () => {
      active = false;
      unsub();
    };
  }, [activeEvent]);

  const handleToggleSeat = useCallback((seat: SeatRecord) => {
    const delta = seatDeltaRef.current;
    if (delta.booked.includes(seat.id)) {
      setStatusError(`Seat ${seat.sectionId} Row ${seat.row} Seat ${seat.seatNumber} is already booked.`);
      return;
    }
    if (delta.heldByOthers.includes(seat.id)) {
      setStatusError(`Seat ${seat.sectionId} Row ${seat.row} Seat ${seat.seatNumber} is temporarily held by another fan.`);
      return;
    }

    setStatusError(null);
    setAutoRotateOn(false);
    setSelectedSeats((prev) => {
      const exists = prev.some((s) => s.id === seat.id);
      if (exists) {
        const next = prev.filter((s) => s.id !== seat.id);
        setFocusedSeatForPreview(next[next.length - 1] || null);
        return next;
      }
      if (prev.length >= 6) {
        setStatusError('You can select up to 6 seats per booking.');
        return prev;
      }
      setFocusedSeatForPreview(seat);
      return [...prev, seat];
    });
  }, []);

  useEffect(() => {
    if (!webglOk || !mountRef.current) return;

    const scene = new StadiumScene(mountRef.current, {
      onHoverSection: (sec, pos) => {
        setHoveredSection(sec);
        setHoverScreenPos(pos);
      },
      onSelectSection: (sec) => {
        setAutoRotateOn(false);
        setActiveSection(sec);
        setTierFilter(sec.tier);
        scene.focusSection(sec);
      },
      onHoverSeat: (seat) => {
        setHoveredSeat(seat);
      },
      onSelectSeat: (seat) => {
        handleToggleSeat(seat);
      },
      onContextLost: () => setContextLost(true),
      onContextRestored: () => setContextLost(false),
    });

    sceneRef.current = scene;

    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'h' && document.activeElement?.tagName !== 'INPUT') {
        setDockCollapsed((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('keydown', onKey);
      scene.dispose();
      sceneRef.current = null;
    };
  }, [webglOk, handleToggleSeat]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (activeEvent) {
      scene.setEvent(activeEvent);
    }
    scene.syncState({
      delta: seatDelta,
      selectedIds: selectedSeats.map((s) => s.id),
      activeSectionId: activeSection?.id || null,
      tierFilter,
      focusedSeat: focusedSeatForPreview,
    });
  }, [activeEvent, seatDelta, selectedSeats, activeSection, tierFilter, focusedSeatForPreview]);

  const sectionAvailability = useMemo(() => {
    const bookedSet = new Set(seatDelta.booked);
    const heldSet = new Set([...seatDelta.heldByOthers, ...seatDelta.heldByMe]);
    const stats = new Map<string, { available: number; total: number }>();

    for (const sec of layout.sections) {
      stats.set(sec.id, { available: sec.totalSeats, total: sec.totalSeats });
    }
    for (const seat of layout.seats) {
      if (bookedSet.has(seat.id) || heldSet.has(seat.id)) {
        const cur = stats.get(seat.sectionId);
        if (cur) cur.available = Math.max(0, cur.available - 1);
      }
    }
    return stats;
  }, [layout, seatDelta]);

  const handleCameraPreset = (preset: CameraPreset) => {
    if (preset === 'overview') {
      setActiveSection(null);
      setTierFilter('ALL');
    } else if (preset === 'lower' || preset === 'courtside') {
      setActiveSection(null);
      setTierFilter('Lower');
    } else if (preset === 'club') {
      setActiveSection(null);
      setTierFilter('Club');
    } else if (preset === 'upper') {
      setActiveSection(null);
      setTierFilter('Upper');
    }
    setAutoRotateOn(false);
    setIsSeatView(false);
    sceneRef.current?.goToPreset(preset);
  };

  const handleToggleAutoRotate = () => {
    const next = !autoRotateOn;
    setAutoRotateOn(next);
    sceneRef.current?.setAutoRotate(next);
  };

  const handleFindBestSeat = () => {
    const bookedSet = new Set(seatDelta.booked);
    const heldSet = new Set([...seatDelta.heldByOthers, ...seatDelta.heldByMe]);

    // Prefer center sideline sections matching active filter
    const preferredTier = tierFilter === 'ALL' ? 'Lower' : tierFilter;
    const candidates = layout.seats.filter((s) => {
      if (activeSection && s.sectionId !== activeSection.id) return false;
      if (!activeSection && s.tier !== preferredTier) return false;
      if (bookedSet.has(s.id) || heldSet.has(s.id)) return false;
      return true;
    });

    // Sort by sideline angle closeness (large |z|) and lower row
    candidates.sort((a, b) => {
      if (a.row !== b.row) return a.row - b.row;
      return Math.abs(b.worldPosition.z) - Math.abs(a.worldPosition.z);
    });

    const best = candidates[0];
    if (!best) {
      setStatusError('No open seats found in this filter.');
      return;
    }

    const sec = layout.sectionById.get(best.sectionId) || null;
    if (sec) {
      setActiveSection(sec);
      setTierFilter(sec.tier);
      sceneRef.current?.focusSection(sec);
    }
    setAutoRotateOn(false);
    setSelectedSeats([best]);
    setFocusedSeatForPreview(best);
    setStatusError(null);
  };

  const handleSelectSectionDropdown = (sectionId: string) => {
    setAutoRotateOn(false);
    if (!sectionId) {
      setActiveSection(null);
      setTierFilter('ALL');
      sceneRef.current?.goToPreset('overview');
      return;
    }
    const sec = layout.sectionById.get(sectionId);
    if (sec) {
      setActiveSection(sec);
      setTierFilter(sec.tier);
      setIsSeatView(false);
      sceneRef.current?.focusSection(sec);
    }
  };

  const handleEnterSeatView = (seat: SeatRecord) => {
    const scene = sceneRef.current;
    if (!scene) return;
    setAutoRotateOn(false);
    setFocusedSeatForPreview(seat);
    setIsSeatView(true);
    scene.enterFirstPersonSeatView(seat, () => {
      const snap = scene.captureSeatSnapshot(seat);
      setSeatSnapshots((prev) => ({ ...prev, [seat.id]: snap }));
    });
  };

  const handleManualSnapshot = () => {
    const scene = sceneRef.current;
    if (!scene || !focusedSeatForPreview) return;
    const snap = scene.captureSeatSnapshot(focusedSeatForPreview);
    setSeatSnapshots((prev) => ({ ...prev, [focusedSeatForPreview.id]: snap }));
    setSnapshotNotice(
      `Captured 3D pitch snapshot from Stand ${focusedSeatForPreview.sectionId} Row ${focusedSeatForPreview.row} Seat ${focusedSeatForPreview.seatNumber}`,
    );
    window.setTimeout(() => setSnapshotNotice(null), 3200);
  };

  const handleExitSeatView = () => {
    setIsSeatView(false);
    sceneRef.current?.exitFirstPersonSeatView();
  };

  const handleProceedToCheckout = async () => {
    if (!activeEvent || selectedSeats.length === 0) return;
    setHoldBusy(true);
    setStatusError(null);
    try {
      const res = await holdSeats(
        activeEvent.id,
        selectedSeats.map((s) => s.id),
      );
      setHoldExpiresAt(res.expiresAt);
      setSeatDelta((prev) => ({
        ...prev,
        heldByMe: selectedSeats.map((s) => s.id),
      }));
      setCheckoutOpen(true);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Unable to lock selected seats.');
      fetchEventSeats(activeEvent.id).then((r) => setSeatDelta(r.delta)).catch(() => {});
    } finally {
      setHoldBusy(false);
    }
  };

  const handleClearSelection = () => {
    if (activeEvent && selectedSeats.length > 0) {
      releaseSeats(activeEvent.id).catch(() => {});
    }
    setSelectedSeats([]);
    setFocusedSeatForPreview(null);
    setHoldExpiresAt(null);
    setSeatDelta((prev) => ({ ...prev, heldByMe: [] }));
  };

  const handleCaptureMissingSnapshots = (seatsToCapture: SeatRecord[]): Record<string, string> => {
    const scene = sceneRef.current;
    if (!scene) return {};
    const out: Record<string, string> = {};
    for (const s of seatsToCapture) {
      out[s.id] = scene.captureSeatSnapshot(s);
    }
    setSeatSnapshots((prev) => ({ ...prev, ...out }));
    return out;
  };

  const handleBookingConfirmed = (booking: BookingRecord) => {
    setSeatDelta((prev) => ({
      ...prev,
      booked: Array.from(new Set([...prev.booked, ...booking.seatIds])),
      heldByMe: prev.heldByMe.filter((id) => !booking.seatIds.includes(id)),
    }));
    setSelectedSeats([]);
    setFocusedSeatForPreview(null);
    setHoldExpiresAt(null);
    onBookingComplete();
  };

  const sectionSeats = useMemo(() => {
    if (!activeSection) return [];
    return layout.seats.filter((s) => s.sectionId === activeSection.id);
  }, [activeSection, layout.seats]);

  const totalSelectedPrice = useMemo(
    () => selectedSeats.reduce((sum, s) => sum + getSeatPrice(s), 0),
    [selectedSeats, getSeatPrice],
  );

  const hoveredSecStats = hoveredSection ? sectionAvailability.get(hoveredSection.id) : null;

  return (
    <div className="relative h-[calc(100vh-61px)] w-full overflow-hidden bg-[#040713]">
      {/* Isolated WebGL Canvas Container */}
      {webglOk ? (
        <div ref={mountRef} className="h-full w-full" />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center">
          <AlertTriangle className="h-10 w-10 text-amber-400" />
          <h2 className="font-display mt-4 text-xl font-bold text-white">
            WebGL 3D Acceleration Unavailable
          </h2>
          <p className="mt-2 max-w-md text-sm text-slate-400">
            Your browser or device has disabled WebGL rendering. Enable hardware acceleration or switch to a modern browser to explore the 14,064-seat 3D arena.
          </p>
        </div>
      )}

      {contextLost && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#040713]/90 p-6 text-center">
          <div className="rounded-xl border border-amber-500/40 bg-slate-900 p-6">
            <p className="text-sm font-semibold text-amber-200">
              WebGL context paused by browser — restoring 3D stadium...
            </p>
          </div>
        </div>
      )}

      {/* Top-Left Compact HUD: Event Switcher, Breadcrumb & Legend */}
      {!isSeatView && (
        <div className="pointer-events-auto absolute left-4 top-4 z-20 flex max-w-[calc(100vw-2rem)] flex-col gap-2.5 sm:max-w-md">
          <div className="rounded-xl border border-slate-800 bg-[#080d20]/95 p-3 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <select
                aria-label="Select Cricket Match"
                value={activeEvent?.id || ''}
                onChange={(e) => onSelectEventId(e.target.value)}
                className="max-w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white focus:border-blue-500 focus:outline-none"
              >
                {events.map((evt) => (
                  <option key={evt.id} value={evt.id}>
                    {evt.title} ({evt.date})
                  </option>
                ))}
              </select>
              <span className="font-mono-tabular text-[11px] text-slate-400">
                {loadingSeats
                  ? 'Syncing seats...'
                  : `${(layout.seats.length - seatDelta.booked.length).toLocaleString()} open`}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
              <button
                type="button"
                onClick={() => handleCameraPreset('overview')}
                className="font-medium text-blue-300 hover:text-white"
              >
                ArenaX Cricket Oval
              </button>
              {activeSection && (
                <>
                  <span>→</span>
                  <button
                    type="button"
                    onClick={() => sceneRef.current?.focusSection(activeSection)}
                    className="font-medium text-white hover:text-blue-300"
                  >
                    Sec {activeSection.id}
                  </button>
                </>
              )}
              {focusedSeatForPreview && (
                <>
                  <span>→</span>
                  <span className="font-mono-tabular text-emerald-300">
                    Row {focusedSeatForPreview.row} · Seat {focusedSeatForPreview.seatNumber}
                  </span>
                </>
              )}
            </div>

            <div className="mt-2.5 flex flex-wrap items-center gap-3 border-t border-slate-800/80 pt-2 text-[11px] text-slate-300">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-blue-600" />
                Available
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                Selected
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" />
                Held
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-rose-600" />
                Booked
              </span>
            </div>
          </div>

          {statusError && (
            <div className="rounded-lg border border-rose-500/40 bg-rose-950/90 px-3 py-2 text-xs text-rose-200 shadow-lg">
              {statusError}
            </div>
          )}
        </div>
      )}

      {/* Hover Section / Seat Tooltip */}
      {!isSeatView && hoveredSection && hoverScreenPos && (
        <div
          className="pointer-events-none fixed z-30 hidden sm:block w-60 rounded-xl border border-slate-700 bg-[#080d20]/95 p-3 shadow-2xl"
          style={{
            left: Math.min(hoverScreenPos.x + 16, window.innerWidth - 260),
            top: Math.max(76, Math.min(hoverScreenPos.y - 20, window.innerHeight - 170)),
          }}
        >
          <div className="text-xs font-bold text-white">{hoveredSection.name}</div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-300 font-mono-tabular">
            <span>
              Available: {hoveredSecStats ? hoveredSecStats.available : hoveredSection.totalSeats}/
              {hoveredSection.totalSeats}
            </span>
            <span>
              ₹{Math.round(hoveredSection.minPrice * (activeEvent?.priceMultiplier ?? 1)).toLocaleString('en-IN')}–₹
              {Math.round(hoveredSection.maxPrice * (activeEvent?.priceMultiplier ?? 1)).toLocaleString('en-IN')}
            </span>
          </div>
          {hoveredSeat ? (
            <div className="mt-2 border-t border-slate-800 pt-2 text-[11px] text-cyan-300 font-mono-tabular">
              Row {hoveredSeat.row} · Seat {hoveredSeat.seatNumber} · ₹{getSeatPrice(hoveredSeat).toLocaleString('en-IN')}
              {' — '}
              {seatDelta.booked.includes(hoveredSeat.id)
                ? 'Booked'
                : seatDelta.heldByOthers.includes(hoveredSeat.id)
                ? 'Held'
                : 'Click to select'}
            </div>
          ) : (
            <div className="mt-1.5 text-[11px] text-blue-300">Click stand to zoom in</div>
          )}
        </div>
      )}

      {/* First-Person View From Your Seat Banner */}
      {isSeatView && focusedSeatForPreview && (
        <div className="pointer-events-auto absolute left-1/2 top-4 z-30 w-[min(680px,94vw)] -translate-x-1/2 rounded-xl border border-blue-500/40 bg-[#080d20]/95 p-3.5 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-blue-300">
                First-Person Eye-Level Seat Preview
              </div>
              <div className="font-mono-tabular text-sm font-bold text-white">
                {focusedSeatForPreview.sectionName} · Row {focusedSeatForPreview.row} · Seat{' '}
                {focusedSeatForPreview.seatNumber} · ₹{getSeatPrice(focusedSeatForPreview).toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-slate-400">
                Drag canvas to inspect the 22-yard pitch, stumps, sightscreens, floodlights & scoreboard
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleManualSnapshot}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 hover:border-blue-500 hover:text-white"
              >
                <Camera className="h-3.5 w-3.5" />
                Capture Snapshot
              </button>
              <button
                type="button"
                onClick={handleExitSeatView}
                className="rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-500"
              >
                Return to Seat Selection
              </button>
            </div>
          </div>

          {snapshotNotice && (
            <div className="mt-2 rounded-lg bg-emerald-950/70 px-3 py-1.5 text-xs text-emerald-200">
              {snapshotNotice}
            </div>
          )}
        </div>
      )}

      {/* Collapsible Bottom Control Dock (Zero Center Occlusion) */}
      {!isSeatView && (
        <div
          className={`pointer-events-auto absolute bottom-4 left-1/2 z-20 w-[min(980px,95vw)] -translate-x-1/2 transition-transform duration-200 ${
            dockCollapsed ? 'translate-y-[calc(100%-36px)]' : 'translate-y-0'
          }`}
        >
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setDockCollapsed((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-t-lg border border-b-0 border-slate-800 bg-[#080d20]/95 px-4 py-1.5 text-[11px] font-medium text-slate-300 hover:text-white"
            >
              {dockCollapsed ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5" /> Show Controls (H)
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5" /> Hide Controls (H)
                </>
              )}
            </button>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#080d20]/95 p-3.5 shadow-2xl space-y-3">
            {/* Row 1: Camera Presets + Quick Actions + Section/Seat Pickers */}
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { id: 'overview', label: 'Overview' },
                    { id: 'courtside', label: 'Boundary' },
                    { id: 'lower', label: 'Lower' },
                    { id: 'club', label: 'Club' },
                    { id: 'upper', label: 'Upper' },
                  ] as const
                ).map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleCameraPreset(preset.id)}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      (preset.id === 'overview' && tierFilter === 'ALL' && !activeSection) ||
                      (preset.id === 'lower' && tierFilter === 'Lower' && !activeSection) ||
                      (preset.id === 'club' && tierFilter === 'Club' && !activeSection) ||
                      (preset.id === 'upper' && tierFilter === 'Upper' && !activeSection)
                        ? 'border-blue-500 bg-blue-600/20 text-blue-200'
                        : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-blue-500/60 hover:text-white'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={handleToggleAutoRotate}
                  className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    autoRotateOn
                      ? 'border-purple-500/60 bg-purple-600/20 text-purple-200'
                      : 'border-slate-800 bg-slate-900 text-slate-300 hover:text-white'
                  }`}
                >
                  <Orbit className="h-3.5 w-3.5" />
                  Flyover
                </button>

                <button
                  type="button"
                  onClick={handleFindBestSeat}
                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/50 bg-emerald-950/40 px-2.5 py-1.5 text-xs font-semibold text-emerald-200 transition-colors hover:bg-emerald-900/50 whitespace-nowrap"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Best Seat
                </button>

                <button
                  type="button"
                  onClick={() => handleCameraPreset('overview')}
                  title="Reset camera view"
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-300 hover:text-white"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Jump to Section"
                  value={activeSection?.id || ''}
                  onChange={(e) => handleSelectSectionDropdown(e.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Jump to Stand (All 40)</option>
                  {layout.sections.map((sec) => (
                    <option key={sec.id} value={sec.id}>
                      Stand {sec.id} · {sec.tier} (₹{sec.minPrice.toLocaleString('en-IN')}–₹{sec.maxPrice.toLocaleString('en-IN')})
                    </option>
                  ))}
                </select>

                {activeSection && (
                  <select
                    aria-label="Pick Seat in Stand"
                    value=""
                    onChange={(e) => {
                      const seat = layout.seatById.get(e.target.value);
                      if (seat) handleToggleSeat(seat);
                    }}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">Pick Row / Seat in Stand {activeSection.id}...</option>
                    {sectionSeats.map((s) => {
                      const isBooked = seatDelta.booked.includes(s.id);
                      const isHeld = seatDelta.heldByOthers.includes(s.id);
                      return (
                        <option key={s.id} value={s.id} disabled={isBooked || isHeld}>
                          Row {s.row} · Seat {s.seatNumber} — ₹{getSeatPrice(s).toLocaleString('en-IN')}{' '}
                          {isBooked ? '(Booked)' : isHeld ? '(Held)' : ''}
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>
            </div>

            {/* Row 2: Selected Seats Tray & Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80 pt-3">
              {selectedSeats.length === 0 ? (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Compass className="h-4 w-4 text-blue-400 shrink-0" />
                  <span>
                    Click any curved stand in 3D, use <strong className="text-slate-200">Best Seat</strong> for instant recommendation, or jump directly via the stand dropdown.
                  </span>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    {selectedSeats.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setFocusedSeatForPreview(s)}
                        className={`rounded-lg border px-2.5 py-1 text-xs font-mono-tabular transition-colors ${
                          focusedSeatForPreview?.id === s.id
                            ? 'border-emerald-400 bg-emerald-950/50 text-emerald-200'
                            : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500'
                        }`}
                      >
                        Stand {s.sectionId} · R{s.row} · S{s.seatNumber} (₹{getSeatPrice(s).toLocaleString('en-IN')})
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {focusedSeatForPreview && (
                      <button
                        type="button"
                        onClick={() => handleEnterSeatView(focusedSeatForPreview)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/50 bg-blue-950/40 px-3.5 py-2 text-xs font-semibold text-blue-200 hover:bg-blue-900/50 whitespace-nowrap"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View Seat
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleClearSelection}
                      aria-label="Clear selected seats"
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-300 hover:text-white"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Clear
                    </button>

                    <button
                      type="button"
                      onClick={handleProceedToCheckout}
                      disabled={holdBusy}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 whitespace-nowrap"
                    >
                      <ShoppingBag className="h-3.5 w-3.5" />
                      {holdBusy
                        ? 'Locking Seats...'
                        : `Continue · ₹${totalSelectedPrice.toLocaleString('en-IN')}`}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {activeEvent && (
        <CheckoutModal
          open={checkoutOpen}
          event={activeEvent}
          selectedSeats={selectedSeats}
          seatSnapshots={seatSnapshots}
          sectionMultipliers={liveSectionMults}
          holdExpiresAt={holdExpiresAt}
          onRequireAuth={onRequireAuth}
          onCaptureMissingSnapshots={handleCaptureMissingSnapshots}
          onBookingConfirmed={handleBookingConfirmed}
          onClose={() => setCheckoutOpen(false)}
        />
      )}
    </div>
  );
}
