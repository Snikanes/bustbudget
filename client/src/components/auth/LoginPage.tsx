import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { useGoogleLogin } from '../../hooks/queries/useAuth';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const googleLoginMutation = useGoogleLogin();

  // Redirect to budget if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/budget', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleGoogleSuccess = async (response: CredentialResponse) => {
    if (!response.credential) {
      console.error('No credential received from Google');
      return;
    }

    try {
      await googleLoginMutation.mutateAsync(response.credential);
      navigate('/budget', { replace: true });
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const handleGoogleError = () => {
    console.error('Google Sign-In failed');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
      <div className="bg-gray-800/80 backdrop-blur-sm p-8 rounded-2xl shadow-2xl max-w-md w-full mx-4 border border-gray-700">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent mb-2">
            Budgetbyte
          </h1>
          <p className="text-gray-400">Sign in to manage your budget</p>
        </div>

        <div className="flex justify-center">
          {googleLoginMutation.isPending ? (
            <div className="text-gray-400">Signing in...</div>
          ) : (
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              theme="filled_black"
              size="large"
              text="signin_with"
              shape="rectangular"
            />
          )}
        </div>

        {googleLoginMutation.isError && (
          <div className="mt-4 p-3 bg-red-900/50 border border-red-500 rounded text-red-200 text-sm text-center">
            Login failed. Please try again.
          </div>
        )}
      </div>
    </div>
  );
}
