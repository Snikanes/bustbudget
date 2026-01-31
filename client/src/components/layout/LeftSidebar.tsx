import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Wallet, PiggyBank, Users, LogOut } from 'lucide-react';
import AccountList from '../accounts/AccountList';
import ManagePayeesModal from '../payees/ManagePayeesModal';
import { useAuthStore } from '../../stores/authStore';
import { useLogout } from '../../hooks/queries/useAuth';

const MIN_WIDTH = 200;
const MAX_WIDTH = 500;
const DEFAULT_WIDTH = 256;
const STORAGE_KEY = 'leftSidebarWidth';

function LeftSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const logoutMutation = useLogout();
  const [width, setWidth] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? parseInt(stored, 10) : DEFAULT_WIDTH;
  });
  const [isResizing, setIsResizing] = useState(false);
  const [showManagePayees, setShowManagePayees] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, width.toString());
  }, [width]);

  useEffect(() => {
    if (!isResizing) return;

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = e.clientX;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizing]);

  return (
    <aside
      ref={sidebarRef}
      style={{ width: `${width}px` }}
      className="bg-slate-800 text-white flex flex-col relative"
    >
      <div className="p-4 border-b border-slate-700">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <PiggyBank className="w-6 h-6" />
          Budgetbyte
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

      {/* Bottom section */}
      <div className="p-2 border-t border-slate-700 space-y-1">
        {/* Manage Payees Button */}
        <button
          onClick={() => setShowManagePayees(true)}
          className="flex items-center gap-2 w-full px-3 py-2 text-slate-300 hover:bg-slate-700 rounded-lg transition-colors"
        >
          <Users className="w-5 h-5" />
          Manage payees
        </button>

        {/* User section */}
        {user && (
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              {user.picture ? (
                <img
                  src={user.picture}
                  alt={user.name || 'User'}
                  className="w-6 h-6 rounded-full flex-shrink-0"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center text-xs flex-shrink-0">
                  {(user.name || user.email)[0].toUpperCase()}
                </div>
              )}
              <span className="text-sm text-slate-300 truncate">
                {user.name || user.email}
              </span>
            </div>
            <button
              onClick={() => {
                logoutMutation.mutate();
                navigate('/login');
              }}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors flex-shrink-0"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Manage Payees Modal */}
      {showManagePayees && (
        <ManagePayeesModal onClose={() => setShowManagePayees(false)} />
      )}

      {/* Resize Handle */}
      <div
        className="absolute top-0 right-0 w-1 h-full group"
        onMouseDown={() => setIsResizing(true)}
        style={{ touchAction: 'none' }}
      >
        <div
          className={`h-full w-full cursor-col-resize transition-colors ${
            isResizing
              ? 'bg-blue-500'
              : 'bg-transparent group-hover:bg-slate-600'
          }`}
        />
      </div>
    </aside>
  );
}

export default LeftSidebar;
