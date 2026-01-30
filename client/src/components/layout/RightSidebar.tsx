import { useState, useEffect, useRef } from 'react';
import { useUIStore } from '@/stores/uiStore';
import MonthlySummary from '../budget/MonthlySummary';
import CategoryInspector from '../budget/CategoryInspector';

const MIN_WIDTH = 200;
const MAX_WIDTH = 500;
const DEFAULT_WIDTH = 288;
const STORAGE_KEY = 'rightSidebarWidth';

function RightSidebar() {
  const selectedCategory = useUIStore((s) => s.selectedCategory);
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

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX;
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
      className="bg-white border-l border-gray-200 p-4 overflow-auto relative flex-shrink-0"
    >
      {/* Resize Handle */}
      <div
        className="absolute top-0 left-0 w-1 h-full group"
        onMouseDown={() => setIsResizing(true)}
        style={{ touchAction: 'none' }}
      >
        <div
          className={`h-full w-full cursor-col-resize transition-colors ${
            isResizing
              ? 'bg-blue-500'
              : 'bg-transparent group-hover:bg-gray-300'
          }`}
        />
      </div>

      {selectedCategory ? <CategoryInspector /> : <MonthlySummary />}
    </aside>
  );
}

export default RightSidebar;
