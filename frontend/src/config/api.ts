// Konfigurasi base URL API
// Gunakan environment variable VITE_API_BASE_URL jika tersedia, fallback ke relative path
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// Helper untuk mendapatkan URL endpoint
export const getApiUrl = (endpoint: string): string => {
  // Jika endpoint sudah absolute, kembalikan apa adanya
  if (endpoint.startsWith('http')) return endpoint;
  // Gabungkan base URL dengan endpoint
  const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${base}${path}`;
};