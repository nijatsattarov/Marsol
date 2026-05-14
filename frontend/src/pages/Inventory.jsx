import { useState, useEffect } from 'react';
import axios from 'axios';
import { Toaster } from 'sonner';
import InventoryTab from '../components/InventoryTab';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Inventory() {
  const [options, setOptions] = useState(null);
  const [responsiblePersons, setResponsiblePersons] = useState([]);
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    (async () => {
      try {
        const [optionsRes, employeesRes, usersRes] = await Promise.all([
          axios.get(`${API}/options/all`, { headers }).catch(() => ({ data: null })),
          axios.get(`${API}/employees`, { headers }).catch(() => ({ data: [] })),
          axios.get(`${API}/settings/users`, { headers }).catch(() => ({ data: [] })),
        ]);
        setOptions(optionsRes.data);
        const names = new Set();
        (usersRes.data || []).filter(u => (u.status || 'Aktiv') === 'Aktiv' && u.name).forEach(u => names.add(u.name));
        (employeesRes.data || []).forEach(e => {
          const full = `${e.first_name || ''} ${e.last_name || ''}`.trim();
          if (full) names.add(full);
        });
        setResponsiblePersons([...names].sort());
      } catch (err) {
        console.error('Inventory page load error', err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-4 sm:p-6" data-testid="inventory-page">
      <Toaster position="top-right" />
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#3D4F6F]">İnventar</h1>
        <p className="text-sm text-slate-500 mt-1">Şirkət əmlakı və dəyər hesabatı</p>
      </div>
      <InventoryTab responsiblePersons={responsiblePersons} departments={options?.departments || []} />
    </div>
  );
}
