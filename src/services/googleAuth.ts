/**
 * Google Identity Services (GIS) OAuth 2.0 client
 */

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar';

export interface AuthState {
  isSignedIn: boolean;
  accessToken: string | null;
  expiresAt: number | null;
  error: string | null;
}

type TokenCallback = (token: string) => void;

class GoogleAuthService {
  private tokenClient: any = null;
  private tokenCallback: TokenCallback | null = null;

  public isConfigured(): boolean {
    return !!GOOGLE_CLIENT_ID;
  }

  public getClientId(): string {
    return GOOGLE_CLIENT_ID;
  }

  public init(onSuccess: (token: string, expiresAt: number) => void, onError: (err: any) => void) {
    if (!this.isConfigured()) {
      console.warn('VITE_GOOGLE_CLIENT_ID is not configured. Running in Mock Demo mode.');
      return;
    }

    if (typeof window === 'undefined' || !(window as any).google?.accounts?.oauth2) {
      console.warn('GIS SDK script not loaded yet.');
      return;
    }

    try {
      this.tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: CALENDAR_SCOPE,
        callback: (resp: any) => {
          if (resp.error) {
            console.error('GIS Auth error:', resp);
            onError(resp);
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
      });
    } catch (e) {
      console.error('Failed to init GIS token client:', e);
      onError(e);
    }
  }

  public requestToken(prompt: string = ''): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.tokenClient) {
        reject(new Error('GIS token client not initialized'));
        return;
      }

      this.tokenCallback = resolve;
      try {
        this.tokenClient.requestAccessToken({ prompt });
      } catch (e) {
        this.tokenCallback = null;
        reject(e);
      }
    });
  }

  public revokeToken(accessToken: string) {
    if ((window as any).google?.accounts?.oauth2) {
      (window as any).google.accounts.oauth2.revoke(accessToken, () => {
        console.log('Access token revoked');
      });
    }
  }
}

export const googleAuth = new GoogleAuthService();
