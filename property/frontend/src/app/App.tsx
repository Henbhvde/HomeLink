import AppRoutes from '../routes';
import { useLocation } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import CommandPalette from '../components/ui/CommandPalette';
import { useLiveUpdates } from '../hooks/useLiveUpdates';

export default function App() {
  useLiveUpdates();
  const { pathname } = useLocation();
  const { theme } = useTheme();
  const isPlatform = pathname.startsWith('/platform');
  const lightBase = pathname === '/pricing' || pathname.startsWith('/soh') || pathname === '/resident/join';
  const shouldInvert = !isPlatform && ((theme === 'dark' && lightBase) || (theme === 'light' && !lightBase));

  return <><div className={shouldInvert ? 'app-theme-inverted' : ''}><AppRoutes /></div><CommandPalette /></>;
}
