import { Download, Eye, Printer, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { downloadTicketAsPng, generateQrDataUrl } from '../services/ticketService';
import type { TicketRecord } from '../types/stadium';
import { ArenaXLogoMark } from './Navbar';

interface HolographicTicketProps {
  ticket: TicketRecord;
  compact?: boolean;
}

export function HolographicTicket({ ticket, compact = false }: HolographicTicketProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [qrUrl, setQrUrl] = useState<string>('');
  const [downloading, setDownloading] = useState(false);
  const [showSnapshotModal, setShowSnapshotModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    generateQrDataUrl(ticket.qrPayload)
      .then((url) => {
        if (active) setQrUrl(url);
      })
      .catch(() => {
        if (active) setErrorMsg('Could not render QR verification code.');
      });
    return () => {
      active = false;
    };
  }, [ticket.qrPayload]);

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    setErrorMsg(null);
    try {
      await downloadTicketAsPng(cardRef.current, `ArenaX-Ticket-${ticket.ticketCode}`);
    } catch {
      setErrorMsg('Failed to export ticket image. Please try Print instead.');
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-3">
      <div
        ref={cardRef}
        className="print-ticket-container holo-card-border relative overflow-hidden rounded-2xl p-6 text-slate-100"
      >
        {/* Subtle Holographic Iridescent Sheen */}
        <div className="holo-sheen pointer-events-none absolute inset-0 opacity-75" />

        {/* Header Row */}
        <div className="relative z-10 flex items-start justify-between gap-4 border-b border-slate-700/60 pb-4">
          <div className="flex items-center gap-2.5">
            <ArenaXLogoMark className="h-7 w-7 shrink-0" />
            <div>
              <div className="font-display text-sm font-bold tracking-tight text-white">
                ArenaX 3D Digital Pass
              </div>
              <div className="text-xs text-slate-400">
                {ticket.stadiumName}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400">Booking Ref</div>
            <div className="font-mono-tabular text-xs font-semibold text-blue-300">
              {ticket.bookingReference}
            </div>
          </div>
        </div>

        {/* Event & Seat Grid */}
        <div className={`relative z-10 mt-5 grid gap-6 ${compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-[1.35fr_0.85fr]'}`}>
          <div className="space-y-4">
            <div>
              <h3 className="font-display text-xl font-bold text-white leading-snug">
                {ticket.eventTitle}
              </h3>
              <p className="mt-1 text-sm text-slate-300">
                {ticket.homeTeam} vs {ticket.awayTeam}
              </p>
              <p className="mt-1.5 text-xs text-slate-400 font-mono-tabular">
                {ticket.eventDate} · {ticket.eventTime}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 rounded-xl border border-slate-700/60 bg-slate-950/60 p-3.5">
              <div>
                <div className="text-xs text-slate-400">Stand</div>
                <div className="font-mono-tabular mt-0.5 text-lg font-bold text-white">
                  {ticket.sectionId}
                </div>
                <div className="text-[11px] text-blue-300 truncate">{ticket.tier} Stand</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Row</div>
                <div className="font-mono-tabular mt-0.5 text-lg font-bold text-white">
                  {ticket.row}
                </div>
                <div className="text-[11px] text-slate-400">Level {ticket.tier}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Seat</div>
                <div className="font-mono-tabular mt-0.5 text-lg font-bold text-emerald-300">
                  {ticket.seatNumber}
                </div>
                <div className="text-[11px] text-slate-400 font-mono-tabular">
                  ₹{ticket.pricePaid.toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
              <span>Holder: <strong className="text-slate-200 font-medium">{ticket.holderName}</strong></span>
              <span className="font-mono-tabular text-slate-400">{ticket.ticketCode}</span>
            </div>
          </div>

          {/* Right Side: Seat Snapshot + QR Verification */}
          <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-700/60 bg-slate-950/70 p-4">
            {ticket.seatSnapshotDataUrl ? (
              <div className="relative overflow-hidden rounded-lg border border-slate-700/70">
                <img
                  src={ticket.seatSnapshotDataUrl}
                  alt={`3D pitch perspective from Stand ${ticket.sectionId} Row ${ticket.row} Seat ${ticket.seatNumber}`}
                  className="h-28 w-full object-cover"
                />
                <div className="bg-slate-950/85 px-2.5 py-1 text-[11px] text-slate-300">
                  3D Pitch View · Stand {ticket.sectionId}-{ticket.row}-{ticket.seatNumber}
                </div>
              </div>
            ) : (
              <div className="flex h-24 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/70 px-3 text-center text-xs text-slate-400">
                3D Pitch View Verified · Stand {ticket.sectionId} Row {ticket.row}
              </div>
            )}

            <div className="flex items-center gap-3.5">
              <div className="shrink-0 rounded-lg bg-white p-1.5">
                {qrUrl ? (
                  <img
                    src={qrUrl}
                    alt={`Verification QR code for ${ticket.ticketCode}`}
                    className="h-20 w-20"
                  />
                ) : (
                  <div className="h-20 w-20 bg-slate-200" />
                )}
              </div>
              <div className="min-w-0 text-xs text-slate-300 space-y-1">
                <div className="font-semibold text-white">Verified Entry QR</div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Scan at ArenaX Gate. Cryptographic token only — no personal data stored.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-950/50 px-3 py-2 text-xs text-rose-200">
          {errorMsg}
        </div>
      )}

      {/* Action Toolbar */}
      <div className="no-print flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" />
          {downloading ? 'Exporting PNG...' : 'Download Ticket'}
        </button>

        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-medium text-slate-200 transition-colors hover:border-slate-500 hover:text-white"
        >
          <Printer className="h-3.5 w-3.5" />
          Print Ticket
        </button>

        {ticket.seatSnapshotDataUrl && (
          <button
            type="button"
            onClick={() => setShowSnapshotModal(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-medium text-slate-200 transition-colors hover:border-blue-500/60 hover:text-white"
          >
            <Eye className="h-3.5 w-3.5" />
            Inspect Seat View
          </button>
        )}
      </div>

      {/* Seat View Snapshot Lightbox */}
      {showSnapshotModal && ticket.seatSnapshotDataUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
          <div className="w-full max-w-3xl rounded-xl border border-slate-800 bg-[#080d20] p-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="text-sm font-semibold text-white">
                Captured 3D Pitch Perspective · Stand {ticket.sectionId} · Row {ticket.row} · Seat {ticket.seatNumber}
              </div>
              <button
                type="button"
                onClick={() => setShowSnapshotModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <img
              src={ticket.seatSnapshotDataUrl}
              alt="Full-size 3D seat perspective"
              className="mt-4 w-full rounded-lg border border-slate-800 object-contain max-h-[70vh]"
            />
          </div>
        </div>
      )}
    </div>
  );
}
