import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Wallet, PiggyBank } from 'lucide-react';
import AccountList from '../accounts/AccountList';

const MIN_WIDTH = 200;
const MAX_WIDTH = 500;
const DEFAULT_WIDTH = 256;
const STORAGE_KEY = 'leftSidebarWidth';

function LeftSidebar() {
  const location = useLocation();
  const [width, setWidth] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? parseInt(stored, 10) : DEFAULT_WIDTH;
  });
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, width.toString());
  }, [width]);

  useEffect(() => {
    if (!isResizing) return;

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
