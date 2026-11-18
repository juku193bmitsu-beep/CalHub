import React, { useState, useEffect, useCallback } from 'react';
import { googleAuth } from '../../services/googleAuth';
import { AlertCircle, RefreshCw, LogIn, CheckCircle2 } from 'lucide-react';

interface AuthBarProps {
  onTokenChange: (token: string | null) => void;
}

export const AuthBar: React.FC<AuthBarProps> = ({ onTokenChange }) => {
  const isConfigured = googleAuth.isConfigured();
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [isExpiringSoon, setIsExpiringSoon] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize GIS on mount
  useEffect(() => {
    if (!isConfigured) return;

    // Wait slightly for window.google to be ready if script is loading
    const timer = setTimeout(() => {
      googleAuth.init(
        (newToken, newExpiresAt) => {
          setToken(newToken);
          setExpiresAt(newExpiresAt);
          setIsExpiringSoon(false);
          setIsLoading(false);
          onTokenChange(newToken);
        },
        (err) => {
          console.error('Auth init error:', err);
          setIsLoading(false);
        }
      );
    }, 500);

    return () => clearTimeout(timer);
  }, [isConfigured, onTokenChange]);

  const handleSilentRefresh = useCallback(async () => {
    if (!isConfigured) return;
    try {
      setIsLoading(true);
      const newToken = await googleAuth.requestToken('none');
      const newExpiresAt = Date.now() + 3600 * 1000;
      setToken(newToken);
      setExpiresAt(newExpiresAt);
      setIsExpiringSoon(false);
      onTokenChange(newToken);
    } catch {
      // If silent refresh fails (consent required), prompt user with bar
      setIsExpiringSoon(true);
    } finally {
      setIsLoading(false);
    }
  }, [isConfigured, onTokenChange]);

  // Check token expiration periodically (every 1 min)
  useEffect(() => {
    if (!token || !expiresAt) return;

    const interval = setInterval(() => {
      const remainingMs = expiresAt - Date.now();
      // If less than 5 minutes remaining, try silent refresh
      if (remainingMs < 5 * 60 * 1000) {
        handleSilentRefresh();
      }
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, [token, expiresAt, handleSilentRefresh]);

  const handleManualLogin = async () => {
    setIsLoading(true);
    try {
      const newToken = await googleAuth.requestToken();
      const newExpiresAt = Date.now() + 3600 * 1000;
      setToken(newToken);
      setExpiresAt(newExpiresAt);
      setIsExpiringSoon(false);
      onTokenChange(newToken);
    } catch (e) {
      console.error('Manual login failed', e);
    } finally {
      setIsLoading(false);
    }
  };

  // If client ID not configured, show subtle demo indicator
  if (!isConfigured) {
    return (
      <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200/60 dark:border-amber-900/40 px-3 py-1 flex items-center justify-between text-[11px] text-amber-800 dark:text-amber-300">
        <span className="flex items-center gap-1.5 truncate">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
          デモモードで動作中（モックデータ・ローカル保存）
        </span>
        <span className="text-[10px] text-amber-600 dark:text-amber-400 shrink-0">
          .env で Client ID 設定可
        </span>
      </div>
    );
  }

  // If token is expiring or expired, show one-tap reconnect bar
  if (isExpiringSoon || !token) {
    return (
      <div className="bg-blue-50 dark:bg-blue-950/50 border-b border-blue-200 dark:border-blue-800 px-3 py-1.5 flex items-center justify-between text-xs text-blue-900 dark:text-blue-200 animate-in fade-in">
        <div className="flex items-center gap-1.5 truncate">
          <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
          <span className="font-medium truncate">
            {token ? 'セッション期限切れが近づいています' : 'Googleカレンダーと連携できます'}
          </span>
        </div>

        <button
          onClick={handleManualLogin}
          disabled={isLoading}
          className="px-3 py-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-1.5 transition active:scale-95 shrink-0 shadow-xs"
        >
          {isLoading ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <LogIn className="w-3.5 h-3.5" />
          )}
          <span>{token ? '再接続' : 'Google認証'}</span>
        </button>
      </div>
    );
  }

  // Connected state
  return (
    <div className="bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-200/50 dark:border-emerald-900/40 px-3 py-0.5 flex items-center justify-between text-[11px] text-emerald-800 dark:text-emerald-300">
      <span className="flex items-center gap-1.5">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        Googleカレンダー同期中
      </span>
      <button
        onClick={handleManualLogin}
        className="text-[10px] text-emerald-700 dark:text-emerald-400 underline hover:text-emerald-900"
      >
        再接続
      </button>
    </div>
  );
};
