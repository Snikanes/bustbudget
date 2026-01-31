import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useCheckAuth } from '../../hooks/queries/useAuth';

export default function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuthStore();

  // Check auth status on mount
  useCheckAuth();

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Render the protected content
  return <Outlet />;
}
