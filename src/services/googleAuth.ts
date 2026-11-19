/**
 * Google Identity Services (GIS) OAuth 2.0 client
 */

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar';
export const STORAGE_KEY_CLIENT_ID = 'calhub_google_client_id';

// Default Client ID created for project "CalHub"
export const DEFAULT_GOOGLE_CLIENT_ID = '880852432503-6hms964904svvmmbffq39eq9odmbdjja.apps.googleusercontent.com';

export interface AuthState {
  isSignedIn: boolean;
  accessToken: string | null;
  expiresAt: number | null;
  error: string | null;
}

type TokenCallback = (token: string) => void;
type ErrorCallback = (err: any) => void;

class GoogleAuthService {
  private tokenClient: any = null;
  private tokenCallback: TokenCallback | null = null;
  private errorCallback: ErrorCallback | null = null;

  public getClientId(): string {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CLIENT_ID);
      // Ignore old PDFHub client ID if previously cached in localStorage
      if (saved && saved.trim() && !saved.startsWith('447035337299')) {
        return saved.trim();
      }
    } catch {
      // fallback
    }
    return (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) || DEFAULT_GOOGLE_CLIENT_ID;
  }

  public setClientId(clientId: string): void {
    try {
      localStorage.setItem(STORAGE_KEY_CLIENT_ID, clientId.trim());
      this.tokenClient = null; // force re-initialization
    } catch {
      // ignore
    }
  }

  public isConfigured(): boolean {
    return !!this.getClientId();
  }

  public init(
    onSuccess: (token: string, expiresAt: number) => void,
    onError: (err: any) => void
  ) {
    const clientId = this.getClientId();
    if (!clientId) {
      console.warn('Google Client ID is not configured. Running in Mock Demo mode.');
      return;
    }

    if (typeof window === 'undefined' || !(window as any).google?.accounts?.oauth2) {
      console.warn('GIS SDK script not loaded yet.');
      return;
    }

    try {
      this.tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: CALENDAR_SCOPE,
        callback: (resp: any) => {
          if (resp.error) {
            console.error('GIS Auth error:', resp);
            onError(resp);
            if (this.errorCallback) {
              this.errorCallback(resp);
              this.errorCallback = null;
            }
            return;
          }
          if (resp.access_token) {
            const expiresIn = resp.expires_in ? Number(resp.expires_in) * 1000 : 3600 * 1000;
            const expiresAt = Date.now() + expiresIn;
            onSuccess(resp.access_token, expiresAt);
            if (this.tokenCallback) {
              this.tokenCallback(resp.access_token);
              this.tokenCallback = null;
            }
          }
        },
        error_callback: (err: any) => {
          console.error('GIS error_callback:', err);
          onError(err);
          if (this.errorCallback) {
            this.errorCallback(err);
            this.errorCallback = null;
          }
        },
      });
    } catch (e) {
      console.error('Failed to init GIS token client:', e);
      onError(e);
    }
  }

  public requestToken(prompt: string = ''): Promise<string> {
    return new Promise((resolve, reject) => {
      const clientId = this.getClientId();
      if (!clientId) {
        reject(new Error('Google Client ID が設定されていません'));
        return;
      }

      if (!this.tokenClient) {
        this.init(
          (t) => resolve(t),
          (err) => reject(err)
        );
      }

      if (!this.tokenClient) {
        reject(new Error('Google認証クライアントの初期化に失敗しました'));
        return;
      }

      let timeoutTimer: any = null;

      this.tokenCallback = (token: string) => {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        this.errorCallback = null;
        resolve(token);
      };

      this.errorCallback = (err: any) => {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        this.tokenCallback = null;
        reject(err);
      };

      // Set a 45-second timeout in case popup was closed or blocked without trigger
      timeoutTimer = setTimeout(() => {
        this.tokenCallback = null;
        this.errorCallback = null;
        reject(new Error('認証がタイムアウトしました。ポップアップがブロックされていないかご確認ください。'));
      }, 45000);

      try {
        const opts = prompt ? { prompt } : {};
        this.tokenClient.requestAccessToken(opts);
      } catch (e) {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        this.tokenCallback = null;
        this.errorCallback = null;
        reject(e);
      }
    });
  }
}

export const googleAuth = new GoogleAuthService();
