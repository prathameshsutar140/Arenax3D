import type { EventRecord, SeatStateDelta } from '../types/stadium';
import { apiFetch, getSessionId } from './apiClient';

export interface EventsResponse {
  events: EventRecord[];
  sectionMultipliers: Record<string, number>;
}

export interface EventSeatsResponse {
  eventId: string;
  delta: SeatStateDelta;
  sectionMultipliers: Record<string, number>;
  eventPriceMultiplier: number;
}

export async function fetchEvents(): Promise<EventsResponse> {
  return apiFetch<EventsResponse>('/api/events');
}

export async function fetchEventSeats(eventId: string): Promise<EventSeatsResponse> {
  const sessionId = encodeURIComponent(getSessionId());
  return apiFetch<EventSeatsResponse>(`/api/events/${encodeURIComponent(eventId)}/seats?sessionId=${sessionId}`);
}

export async function holdSeats(eventId: string, seatIds: string[]): Promise<{ expiresAt: number }> {
  return apiFetch<{ ok: boolean; expiresAt: number }>('/api/seats/hold', {
    method: 'POST',
    body: JSON.stringify({
      eventId,
      seatIds,
      sessionId: getSessionId(),
    }),
  });
}

export async function releaseSeats(eventId: string, seatIds?: string[]): Promise<void> {
  await apiFetch('/api/seats/release', {
    method: 'POST',
    body: JSON.stringify({
      eventId,
      sessionId: getSessionId(),
      seatIds,
    }),
  });
}

export type SeatSocketEvent =
  | { eventId: string; type: 'seat:held'; seatIds: string[]; sessionId: string; expiresAt: number }
  | { eventId: string; type: 'seat:released'; seatIds: string[] }
  | { eventId: string; type: 'seat:booked'; seatIds: string[] };

export function subscribeSeatUpdates(
  eventId: string,
  onMessage: (msg: SeatSocketEvent) => void,
): () => void {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${proto}//${window.location.host}/ws`;
  let ws: WebSocket | null = null;
  let closedByCaller = false;
  let reconnectTimer: number | null = null;

  const connect = () => {
    if (closedByCaller) return;
    ws = new WebSocket(wsUrl);
    ws.onopen = () => {
      ws?.send(JSON.stringify({ type: 'subscribe', eventId }));
    };
    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(String(evt.data)) as SeatSocketEvent;
        if (msg.eventId === eventId) {
          onMessage(msg);
        }
      } catch {
        // Ignore invalid frame
      }
    };
    ws.onclose = () => {
      if (!closedByCaller) {
        reconnectTimer = window.setTimeout(connect, 2500);
      }
    };
  };

  connect();

  return () => {
    closedByCaller = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    ws?.close();
  };
}
