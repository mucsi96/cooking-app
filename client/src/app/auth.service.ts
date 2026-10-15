import { DestroyRef, inject, Injectable, signal } from '@angular/core';

interface SessionInfo {
  user: string;
  email: string;
  preferredUsername?: string;
  additionalClaims?: { name?: string };
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly authenticated = signal(false);
  private readonly identity = signal<{ name: string; preferred_username: string } | null>(null);
  private readonly error = signal<string | null>(null);
  private popup: Window | null = null;
  private popupTimer: ReturnType<typeof setInterval> | null = null;
  private loading: Promise<boolean> | null = null;
  private signingOut = false;

  readonly isAuthenticated = this.authenticated.asReadonly();
  readonly userData = this.identity.asReadonly();
  readonly authError = this.error.asReadonly();

  async init(): Promise<void> {
    Object.keys(localStorage)
      .filter((key) => key.startsWith('oidc.') || key.startsWith('msal.'))
      .forEach((key) => localStorage.removeItem(key));
    const completed = (event: MessageEvent): void => {
      if (event.origin === window.location.origin && event.source === this.popup && event.data?.type === 'app-session-ready') this.finishLogin();
    };
    window.addEventListener('message', completed);
    this.destroyRef.onDestroy(() => {
      window.removeEventListener('message', completed);
      this.finishPopup();
    });
    await this.refresh();
    if (this.authenticated() && new URL(window.location.href).searchParams.get('auth_complete') === '1' && window.opener) {
      window.opener.postMessage({ type: 'app-session-ready' }, window.location.origin);
      window.close();
    }
  }

  requireLogin(): void {
    this.authenticated.set(false);
    this.error.set('A bejelentkezés lejárt. Jelentkezz be újra; az oldalon végzett munkád megmaradt.');
  }

  login(): void {
    if (this.popup && !this.popup.closed) { this.popup.focus(); return; }
    const returnTo = new URL(window.location.href);
    returnTo.searchParams.set('auth_complete', '1');
    this.popup = window.open(`/oauth2/start?rd=${encodeURIComponent(returnTo.pathname + returnTo.search)}`, `app-sign-in-${window.location.host}`, 'popup,width=600,height=760');
    if (!this.popup) { this.error.set('Engedélyezd a bejelentkezési felugró ablakot, majd próbáld újra.'); return; }
    this.popupTimer = setInterval(() => { if (this.popup?.closed) this.finishLogin(); }, 500);
  }

  async logout(): Promise<void> {
    if (this.signingOut) return;
    this.signingOut = true;
    this.finishPopup();
    try {
      await this.loading;
      const response = await fetch('/oauth2/sign_out', { credentials: 'same-origin', redirect: 'manual', cache: 'no-store' });
      if (response.type !== 'opaqueredirect' && !response.ok) throw new Error('signout_failed');
      this.identity.set(null);
      this.authenticated.set(false);
      this.error.set('Kijelentkeztél. A folytatáshoz jelentkezz be újra.');
    } catch {
      this.error.set('A kijelentkezés átmenetileg nem érhető el. Próbáld újra.');
    } finally {
      this.signingOut = false;
    }
  }

  async ensureAuthenticated(): Promise<boolean> { return this.authenticated() || this.refresh(); }

  refresh(): Promise<boolean> {
    if (this.signingOut) return Promise.resolve(false);
    if (this.loading) return this.loading;
    this.loading = this.loadSession().finally(() => { this.loading = null; });
    return this.loading;
  }

  private async loadSession(): Promise<boolean> {
    try {
      const response = await fetch('/oauth2/userinfo', { credentials: 'same-origin', cache: 'no-store' });
      if (response.status === 401) { this.requireLogin(); return false; }
      if (!response.ok) throw new Error('session_unavailable');
      const session: SessionInfo = await response.json();
      if (!session.user || !session.email) throw new Error('invalid_session');
      this.identity.set({ name: session.additionalClaims?.name ?? session.preferredUsername ?? session.email, preferred_username: session.preferredUsername ?? session.email });
      this.authenticated.set(true);
      this.error.set(null);
      return true;
    } catch {
      this.error.set('A bejelentkezési szolgáltatás átmenetileg nem érhető el. A munkád megmaradt.');
      return false;
    }
  }

  private finishLogin(): void { this.finishPopup(); void this.refresh(); }

  private finishPopup(): void {
    if (this.popupTimer) clearInterval(this.popupTimer);
    this.popupTimer = null;
    this.popup?.close();
    this.popup = null;
  }
}
