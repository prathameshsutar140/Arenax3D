import { toPng } from 'html-to-image';
import QRCode from 'qrcode';
import type { BookingRecord } from '../types/stadium';
import { apiFetch } from './apiClient';

export async function fetchMyBookings(): Promise<BookingRecord[]> {
  const res = await apiFetch<{ bookings: BookingRecord[] }>('/api/my/bookings');
  return res.bookings;
}

export async function generateQrDataUrl(payload: string): Promise<string> {
  return QRCode.toDataURL(payload, {
    width: 240,
    margin: 1,
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
    errorCorrectionLevel: 'M',
  });
}

export async function downloadTicketAsPng(element: HTMLElement, fileName: string): Promise<void> {
  const dataUrl = await toPng(element, {
    quality: 1.0,
    pixelRatio: 2,
    backgroundColor: '#050814',
    skipFonts: true,
  });
  const link = document.createElement('a');
  link.download = `${fileName}.png`;
  link.href = dataUrl;
  link.click();
}
