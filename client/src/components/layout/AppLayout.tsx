import { Outlet, useLocation } from 'react-router-dom';
import LeftSidebar from './LeftSidebar';
import RightSidebar from './RightSidebar';
import HelpButton from '../shared/HelpButton';

function AppLayout() {
  const location = useLocation();
  const isBudgetView = location.pathname === '/budget';

  return (
    <div className="flex h-screen bg-gray-100">
      <LeftSidebar />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
      {isBudgetView && <RightSidebar />}
      <HelpButton />
    </div>
  );
}

export default AppLayout;
