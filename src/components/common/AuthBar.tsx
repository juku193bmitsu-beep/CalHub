import React, { useState, useEffect, useCallback } from 'react';
import { googleAuth } from '../../services/googleAuth';
import { AlertCircle, RefreshCw, LogIn, X } from 'lucide-react';

interface AuthBarProps {
  onTokenChange: (token: string | null) => void;
}

const STORAGE_KEY_AUTH_TOKEN = 'calhub_google_auth_token_v1';
const STORAGE_KEY_AUTH_EXPIRES = 'calhub_google_auth_expires_v1';
const STORAGE_KEY_BAR_DISMISSED = 'calhub_auth_bar_dismissed_v1';
const STORAGE_KEY_LOGGED_IN_ONCE = 'calhub_has_logged_in_once';

export const AuthBar: React.FC<AuthBarProps> = ({ onTokenChange }) => {
  const isConfigured = googleAuth.isConfigured();

  // Restore cached token if valid
  const [token, setToken] = useState<string | null>(() => {
    try {
      const savedToken = localStorage.getItem(STORAGE_KEY_AUTH_TOKEN);
      const savedExpires = localStorage.getItem(STORAGE_KEY_AUTH_EXPIRES);
      if (savedToken && savedExpires && Number(savedExpires) > Date.now()) {
        return savedToken;
      }
    } catch {
      // fallback
    }
    return null;
  });

  const [expiresAt, setExpiresAt] = useState<number | null>(() => {
    try {
      const savedExpires = localStorage.getItem(STORAGE_KEY_AUTH_EXPIRES);
      if (savedExpires) return Number(savedExpires);
    } catch {
      // fallback
    }
    return null;
  });

  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_BAR_DISMISSED) === 'true';
    } catch {
      return false;
    }
  });

  const [isExpiringSoon, setIsExpiringSoon] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Notify parent on mount if restored token is valid
  useEffect(() => {
    if (token) {
      onTokenChange(token);
    }
  }, []);

  const saveToken = useCallback((newToken: string | null, newExpiresAt: number | null) => {
    setToken(newToken);
    setExpiresAt(newExpiresAt);
    try {
      if (newToken && newExpiresAt) {
        localStorage.setItem(STORAGE_KEY_AUTH_TOKEN, newToken);
        localStorage.setItem(STORAGE_KEY_AUTH_EXPIRES, String(newExpiresAt));
        localStorage.setItem(STORAGE_KEY_LOGGED_IN_ONCE, 'true');
      } else {
        localStorage.removeItem(STORAGE_KEY_AUTH_TOKEN);
        localStorage.removeItem(STORAGE_KEY_AUTH_EXPIRES);
      }
    } catch {
      // ignore
    }
  }, []);

  // Initialize GIS on mount and attempt silent auto-login if previously connected
  useEffect(() => {
    if (!isConfigured) return;

    const timer = setTimeout(() => {
      googleAuth.init(
        (newToken, newExpiresAt) => {
          saveToken(newToken, newExpiresAt);
          setIsExpiringSoon(false);
          setIsLoading(false);
          onTokenChange(newToken);
        },
        (err) => {
          console.error('Auth init error:', err);
          setIsLoading(false);
        }
      );

      // Attempt silent auto-login on app launch if previously connected
      try {
        const hasLoggedInOnce = localStorage.getItem(STORAGE_KEY_LOGGED_IN_ONCE) === 'true';
        const savedToken = localStorage.getItem(STORAGE_KEY_AUTH_TOKEN);
        const savedExp = localStorage.getItem(STORAGE_KEY_AUTH_EXPIRES);
        const isCurrentValid = savedToken && savedExp && Number(savedExp) > Date.now();

        if (hasLoggedInOnce && !isCurrentValid) {
          googleAuth
            .requestToken('none')
            .then((newToken) => {
              const exp = Date.now() + 3600 * 1000;
              saveToken(newToken, exp);
              setIsExpiringSoon(false);
              onTokenChange(newToken);
            })
            .catch(() => {
              // Expected if silent iframe login is blocked by third-party cookie restrictions
            });
        }
      } catch {}
    }, 500);

    return () => clearTimeout(timer);
  }, [isConfigured, onTokenChange, saveToken]);

  const handleSilentRefresh = useCallback(async () => {
    if (!isConfigured) return;
    try {
      setIsLoading(true);
      const newToken = await googleAuth.requestToken('none');
      const newExpiresAt = Date.now() + 3600 * 1000;
      saveToken(newToken, newExpiresAt);
      setIsExpiringSoon(false);
      onTokenChange(newToken);
    } catch {
      // If silent refresh fails, prompt user
      setIsExpiringSoon(true);
    } finally {
      setIsLoading(false);
    }
  }, [isConfigured, onTokenChange, saveToken]);

  // Check token expiration periodically (every 1 min)
  useEffect(() => {
    if (!token || !expiresAt) return;

    const interval = setInterval(() => {
      const remainingMs = expiresAt - Date.now();
      if (remainingMs <= 0) {
        saveToken(null, null);
        onTokenChange(null);
        setIsDismissed(false);
      } else if (remainingMs < 5 * 60 * 1000) {
        handleSilentRefresh();
      }
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, [token, expiresAt, handleSilentRefresh, onTokenChange, saveToken]);

  const handleManualLogin = async () => {
    setIsLoading(true);
    try {
      const newToken = await googleAuth.requestToken();
      const newExpiresAt = Date.now() + 3600 * 1000;
      saveToken(newToken, newExpiresAt);
      setIsExpiringSoon(false);
      setIsDismissed(false);
      try {
        localStorage.removeItem(STORAGE_KEY_BAR_DISMISSED);
      } catch {}
      onTokenChange(newToken);
    } catch (e) {
      console.error('Manual login failed', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      localStorage.setItem(STORAGE_KEY_BAR_DISMISSED, 'true');
    } catch {}
  };

  // 1. If user is authenticated and token is active:
  // As requested, hide the top bar completely to maximize vertical calendar space!
  if (token && !isExpiringSoon) {
    return null;
  }

  // 2. If client ID not configured:
  if (!isConfigured) {
    if (isDismissed) return null;
    return (
      <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200/60 dark:border-amber-900/40 px-3 py-1 flex items-center justify-between text-[11px] text-amber-800 dark:text-amber-300">
        <span className="flex items-center gap-1.5 truncate">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
          デモモードで動作中（モックデータ・ローカル保存）
        </span>
        <button
          onClick={handleDismiss}
          className="text-amber-600 hover:text-amber-800 p-0.5 rounded"
          title="閉じる"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // 3. If dismissed by user, respect dismissal and keep bar hidden
  if (isDismissed) {
    return null;
  }

  // 4. Prompt user with reconnect / login bar
  return (
    <div className="bg-blue-50 dark:bg-blue-950/50 border-b border-blue-200 dark:border-blue-800 px-3 py-1.5 flex items-center justify-between text-xs text-blue-900 dark:text-blue-200 animate-in fade-in">
      <div className="flex items-center gap-1.5 truncate">
        <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
        <span className="font-medium truncate">
          {token ? 'セッション期限切れが近づいています' : 'Googleカレンダーと連携できます'}
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleManualLogin}
          disabled={isLoading}
          className="px-3 py-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-xs"
        >
          {isLoading ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <LogIn className="w-3.5 h-3.5" />
          )}
          <span>{token ? '再接続' : 'Google認証'}</span>
        </button>
        <button
          onClick={handleDismiss}
          className="text-blue-400 hover:text-blue-600 p-0.5 rounded"
          title="閉じる"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
