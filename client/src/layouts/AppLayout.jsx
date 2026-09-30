import { Outlet } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import BottomNavigation from '../components/BottomNavigation';

export default function AppLayout() {
  return (
    <div className="app-shell">
      <AppHeader />
      <Outlet />
      <BottomNavigation />
    </div>
  );
}
