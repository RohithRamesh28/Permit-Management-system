import { Configuration, PublicClientApplication } from '@azure/msal-browser';

export const msalConfig: Configuration = {
  auth: {
    clientId: 'c01be167-54b5-4e66-a8a1-8c5303b3430b',
    authority: 'https://login.microsoftonline.com/3596b7c3-9b4b-4ef8-9dde-39825373af28',
    redirectUri: window.location.origin,
    navigateToLoginRequestUrl: false,
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: true,
  },
  system: {
    allowNativeBroker: false,
    windowHashTimeout: 120000,
    iframeHashTimeout: 10000,
    loadFrameTimeout: 0,
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) {
          return;
        }
        switch (level) {
          case 0:
            console.error(message);
            return;
          case 1:
            console.warn(message);
            return;
          case 2:
            console.info(message);
            return;
          case 3:
            console.debug(message);
            return;
        }
      },
    },
  },
};

export const loginRequest = {
  scopes: ['User.Read', 'Sites.Read.All'],
};

let msalInstanceCache: PublicClientApplication | null = null;

export const getMsalInstance = () => {
  if (!msalInstanceCache) {
    msalInstanceCache = new PublicClientApplication(msalConfig);
  }
  return msalInstanceCache;
};

export const initializeMsal = async () => {
  try {
    // Check if crypto is available
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error('Web Crypto API not available. HTTPS is required.');
    }

    const instance = getMsalInstance();
    await instance.initialize();
    return instance;
  } catch (error: any) {
    // If initialization fails, try to clear corrupted cache and retry
    if (error?.errorCode === 'crypto_nonexistent' || error?.message?.includes('crypto')) {
      console.warn('Clearing potentially corrupted MSAL cache...');
      try {
        localStorage.removeItem('msal.account.keys');
        localStorage.removeItem('msal.token.keys');
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('msal.')) {
            localStorage.removeItem(key);
          }
        });
      } catch (cleanupError) {
        console.error('Failed to cleanup localStorage:', cleanupError);
      }
    }
    throw error;
  }
};
