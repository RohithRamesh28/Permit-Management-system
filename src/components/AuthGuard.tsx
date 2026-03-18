import { ReactNode, useEffect, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';

interface AuthGuardProps {
  children: ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, isLoading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const loginAttemptedRef = useRef(false);

  useEffect(() => {
    const handleAuth = async () => {
      if (!isLoading && !isAuthenticated && !isAuthenticating && !loginAttemptedRef.current) {
        // Check if crypto API is available
        if (!window.crypto || !window.crypto.subtle) {
          setAuthError('This application requires a secure HTTPS connection for authentication. Please contact your administrator.');
          return;
        }

        loginAttemptedRef.current = true;
        setIsAuthenticating(true);
        try {
          const account = await login();
          if (account) {
            if (location.pathname === '/' || location.pathname === '') {
              navigate('/new');
            }
          }
        } catch (error: any) {
          console.error('Authentication failed:', error);
          if (error?.message?.includes('MSAL not initialized')) {
            setAuthError('Authentication system initialization failed. Please refresh the page or contact support.');
          } else {
            setAuthError('Authentication failed. Please try again.');
          }
          loginAttemptedRef.current = false;
        } finally {
          setIsAuthenticating(false);
        }
      }
    };

    handleAuth();
  }, [isLoading, isAuthenticated, isAuthenticating, login, navigate, location.pathname]);

  if (authError) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-red-500">
            <div className="flex items-start">
              <AlertCircle className="w-6 h-6 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Authentication Error</h3>
                <p className="text-gray-700 mb-4">{authError}</p>
                <button
                  onClick={() => {
                    setAuthError(null);
                    loginAttemptedRef.current = false;
                    window.location.reload();
                  }}
                  className="px-4 py-2 bg-[#0072BC] text-white rounded hover:bg-[#005a94] transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0072BC] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || isAuthenticating) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0072BC] mx-auto mb-4"></div>
          <p className="text-gray-600">Signing in...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
