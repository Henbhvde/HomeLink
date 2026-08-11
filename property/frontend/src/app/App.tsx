import AppRoutes from '../routes';
import { useLocation } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import CommandPalette from '../components/ui/CommandPalette';
import GuidedTour from '../components/ui/GuidedTour';
import { useLiveUpdates } from '../hooks/useLiveUpdates';

export default function App() {
  useLiveUpdates();
  const { pathname } = useLocation();
  const { theme } = useTheme();
  const lightBase = pathname.startsWith('/platform') || pathname === '/pricing' || pathname.startsWith('/soh') || pathname === '/resident/join';
  const shouldInvert = (theme === 'dark' && lightBase) || (theme === 'light' && !lightBase);

  return <><div className={shouldInvert ? 'app-theme-inverted' : ''}><AppRoutes /></div><CommandPalette /><GuidedTour /></>;
}
