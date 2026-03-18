import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AccountInfo, PublicClientApplication, InteractionRequiredAuthError } from '@azure/msal-browser';
import { loginRequest, initializeMsal } from '../lib/msalConfig';

interface AuthContextType {
  account: AccountInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => Promise<AccountInfo | null>;
  logout: () => Promise<void>;
  userEmail: string | null;
  userName: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [msalInstance, setMsalInstance] = useState<PublicClientApplication | null>(null);

  useEffect(() => {
    const initialize = async () => {
      try {
        // Check if crypto API is available
        if (!window.crypto || !window.crypto.subtle) {
          console.error('Web Crypto API not available. Please use HTTPS or a secure context.');
          setIsLoading(false);
          return;
        }

        const instance = await initializeMsal();
        setMsalInstance(instance);

        const response = await instance.handleRedirectPromise();
        if (response) {
          setAccount(response.account);
        } else {
          const accounts = instance.getAllAccounts();
          if (accounts.length > 0) {
            setAccount(accounts[0]);
          } else {
            setAccount(null);
          }
        }
      } catch (error: any) {
        console.error('MSAL initialization error:', error);

        // Provide user-friendly error messages
        if (error?.errorCode === 'crypto_nonexistent') {
          console.error('Authentication requires HTTPS. Please access this application via a secure connection.');
        }

        setAccount(null);
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, []);

  const login = async () => {
    if (!msalInstance) {
      throw new Error('MSAL not initialized');
    }
    try {
      const popupResponse = await msalInstance.loginPopup({
        ...loginRequest,
        prompt: 'select_account',
      });
      setAccount(popupResponse.account);
      return popupResponse.account;
    } catch (error: any) {
      if (error.errorCode === 'user_cancelled') {
        return null;
      }

      if (error.errorCode === 'timed_out' || error.errorCode === 'popup_window_error') {
        console.warn('Popup failed, trying redirect flow:', error);
        try {
          await msalInstance.loginRedirect({
            ...loginRequest,
            prompt: 'select_account',
          });
          return null;
        } catch (redirectError) {
          console.error('Redirect login error:', redirectError);
          throw redirectError;
        }
      }

      console.error('Login error:', error);
      alert(`Login failed: ${error.errorMessage || error.message}`);
      throw error;
    }
  };

  const logout = async () => {
    if (!msalInstance) {
      return;
    }
    try {
      await msalInstance.logoutPopup();
      setAccount(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        account,
        isAuthenticated: !!account,
        isLoading,
        login,
        logout,
        userEmail: account?.username || null,
        userName: account?.name || null,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
