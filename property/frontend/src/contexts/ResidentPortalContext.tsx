import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';

const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api/v1';

type ResidentPortalContextValue = {
  selectedUnit: string | null;
  tenantName: string | null;
  building: string | null;
  entrance: string | null;
  floor: number | null;
  isLoadingUnit: boolean;
  selectUnit: (unit: string) => void;
  clearUnit: () => void;
};

const ResidentPortalContext = createContext<ResidentPortalContextValue | null>(null);

export function ResidentPortalProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState<string | null>(null);
  const [building, setBuilding] = useState<string | null>(null);
  const [entrance, setEntrance] = useState<string | null>(null);
  const [floor, setFloor] = useState<number | null>(null);
  const [isLoadingUnit, setIsLoadingUnit] = useState(true);
  useEffect(() => {
    if (!token) { setIsLoadingUnit(false); return; }
    void fetch(`${apiBaseUrl}/resident-memberships/me`, { headers: { Authorization: `Bearer ${token}` } }).then((response) => response.json()).then((payload) => {
      const membership = Array.isArray(payload?.data) ? payload.data.find((item: { status?: string }) => item.status === 'active') : null;
      setSelectedUnit(membership?.unit?.number ?? null);
      setTenantName(membership?.tenant?.name ?? null);
      setBuilding(membership?.unit?.floor?.entrance?.building?.name ?? null);
      setEntrance(membership?.unit?.floor?.entrance?.name ?? null);
      setFloor(membership?.unit?.floor?.number ?? null);
    }).catch(() => { setSelectedUnit(null); setTenantName(null); setBuilding(null); setEntrance(null); setFloor(null); }).finally(() => setIsLoadingUnit(false));
  }, [token]);
  const value = useMemo(() => ({
    selectedUnit,
    tenantName,
    building,
    entrance,
    floor,
    isLoadingUnit,
    selectUnit: (unit: string) => setSelectedUnit(unit),
    clearUnit: () => setSelectedUnit(null),
  }), [building, entrance, floor, isLoadingUnit, selectedUnit, tenantName]);

  return <ResidentPortalContext.Provider value={value}>{children}</ResidentPortalContext.Provider>;
}

export function useResidentPortal() {
  const context = useContext(ResidentPortalContext);
  if (!context) throw new Error('useResidentPortal must be used within ResidentPortalProvider');
  return context;
}
