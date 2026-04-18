import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PermissionContext = createContext({ permissions: {}, role: '', loading: true });

export function PermissionProvider({ children }) {
  const [permissions, setPermissions] = useState({});
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchPermissions = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    try {
      const res = await axios.get(`${API}/my-permissions`, { headers: { Authorization: `Bearer ${token}` } });
      setPermissions(res.data.permissions || {});
      setRole(res.data.role || '');
    } catch { /* ignore */ }
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
