import { Outlet } from 'react-router-dom';

export default function PlatformLayout() {
  return <div className="workspace-shell min-h-screen"><Outlet /></div>;
}
