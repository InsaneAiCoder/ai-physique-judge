export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:3001' : '');

export type BackendHealthResult = {
  ok: boolean;
  url: string;
  status?: number;
  message: string;
  data?: unknown;
};

export async function checkBackendHealth(): Promise<BackendHealthResult> {
  const url = `${API_BASE_URL}/api/health`;

  if (!API_BASE_URL) {
    return {
      ok: false,
      url,
      message: 'VITE_API_BASE_URL is missing.',
    };
  }

  try {
    const response = await fetch(url);
    const data = await response.json().catch(() => null);
    return {
      ok: response.ok && data?.ok === true,
      url,
      status: response.status,
      message: response.ok ? 'Backend health route reached.' : 'Backend returned an error.',
      data,
    };
  } catch (error) {
    return {
      ok: false,
      url,
      message: error instanceof Error ? error.message : 'Network request failed.',
    };
  }
}
