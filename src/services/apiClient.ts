let memoryToken: string | null = null;

// Ephemeral per-tab session ID for temporary 5-minute seat holds
const SESSION_ID =
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? `sess_${crypto.randomUUID()}`
    : `sess_${Math.random().toString(36).slice(2)}_${Date.now()}`;

export function getSessionId(): string {
  return SESSION_ID;
}

export function setAuthToken(token: string | null): void {
  memoryToken = token;
}

export function getAuthToken(): string | null {
  return memoryToken;
}

export async function apiFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (memoryToken) {
    headers.set('Authorization', `Bearer ${memoryToken}`);
  }

  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  let data: Record<string, unknown> = {};
  if (text) {
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new Error(res.ok ? 'Invalid server response' : text);
    }
  }

  if (!res.ok) {
    const errMsg = typeof data.error === 'string' ? data.error : `Request failed (${res.status})`;
    const error = new Error(errMsg) as Error & { status?: number; conflicts?: string[] };
    error.status = res.status;
    if (Array.isArray(data.conflicts)) {
      error.conflicts = data.conflicts as string[];
    }
    throw error;
  }

  return data as T;
}
