import { Link, useLocation } from 'react-router-dom';
import { Wallet, PiggyBank } from 'lucide-react';
import AccountList from '../accounts/AccountList';

function LeftSidebar() {
  const location = useLocation();

  return (
    <aside className="w-64 bg-slate-800 text-white flex flex-col">
      <div className="p-4 border-b border-slate-700">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <PiggyBank className="w-6 h-6" />
          Budget
        </h1>
      </div>

      <nav className="p-2">
        <Link
          to="/budget"
          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
            location.pathname === '/budget'
              ? 'bg-slate-700 text-white'
              : 'text-slate-300 hover:bg-slate-700 hover:text-white'
          }`}
        >
          <Wallet className="w-5 h-5" />
          Budget
        </Link>
      </nav>

      <div className="flex-1 overflow-auto">
        <AccountList />
      </div>
    </aside>
  );
}

export default LeftSidebar;
