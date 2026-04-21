import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PermissionContext = createContext({ permissions: {}, role: '', loading: true });

// Retry helper for cold-start resilience (Render free tier sleeps after 15min)
async function fetchWithRetry(url, config, maxAttempts = 5) {
  const delays = [0, 3000, 8000, 15000, 20000]; // up to ~46s total
  let lastErr;
  for (let i = 0; i < maxAttempts; i++) {
    if (delays[i] > 0) await new Promise(r => setTimeout(r, delays[i]));
    try {
      return await axios.get(url, { ...config, timeout: 30000 });
    } catch (e) {
      lastErr = e;
      // Don't retry on auth errors
      if (e.response?.status === 401 || e.response?.status === 403) throw e;
    }
  }
  throw lastErr;
}

export function PermissionProvider({ children }) {
  const [permissions, setPermissions] = useState({});
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchPermissions = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetchWithRetry(`${API}/my-permissions`, { headers: { Authorization: `Bearer ${token}` } });
      setPermissions(res.data.permissions || {});
      setRole(res.data.role || '');
    } catch { /* ignore — keep empty permissions */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchPermissions(); }, [fetchPermissions]);

  return (
    <PermissionContext.Provider value={{ permissions, role, loading, refetch: fetchPermissions }}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  return useContext(PermissionContext);
}

export function canView(permissions, module) {
  return permissions[module] === 'read' || permissions[module] === 'write';
}

export function canEdit(permissions, module) {
  return permissions[module] === 'write';
}
