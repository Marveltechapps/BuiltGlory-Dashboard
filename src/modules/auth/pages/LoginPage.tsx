import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '../../../components/ui/Icon';
import { useViewport } from '../../../hooks/useViewport';
import { num } from '../../../lib/format';
import { toast } from '../../../store/uiStore';
import { useLogin, useLoginStats } from '../hooks/useAuth';
import styles from './LoginPage.module.css';

const SAFE_REDIRECT = /^\/admin(?:\/|$|\?)/;
type View = 'login' | 'forgot';

export function LoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { isMd, isLg } = useViewport();
  const login = useLogin();
  const stats = useLoginStats();
  const statVal = (n?: number) => (stats.data ? num(n ?? 0) : stats.isError ? '—' : '…');
  const [view, setView] = useState<View>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [pwError, setPwError] = useState('');
  const [authError, setAuthError] = useState('');
  const timedOut = params.get('reason') === 'timeout';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setAuthError('');
    let ok = true;
    if (!email.trim()) { setEmailError('Email is required'); ok = false; }
    if (!password) { setPwError('Password is required'); ok = false; }
    if (!ok) return;
    login.mutate(
      { email: email.trim().toLowerCase(), password },
      {
        onSuccess: () => {
          const r = params.get('redirect');
          const safe = !!r && SAFE_REDIRECT.test(r);
          setPassword('');
          setEmail('');
          setShowPw(false);
          if (safe) toast('Welcome back! Taking you back to where you left off...', 'green');
          navigate(safe ? r! : '/admin/overview', { replace: true });
        },
        onError: () => {
          setAuthError('Could not sign in. Please try again.');
          setPassword('');
        },
      },
    );
  };

  return (
    <div className={styles.page}>
      {isLg && (
        <aside className={styles.aside}>
          <div>
            <p className={styles.brand}>BUILTGLORY</p>
            <p className={styles.brandSub}>Admin Dashboard</p>
          </div>
          <div className={styles.center}>
            <div className={styles.logoCard}>
              <div className={styles.logoInner}>
                <Icon name="building-2" size={80} stroke={1.25} />
              </div>
            </div>
            <h2 className={styles.headline}>Manage your real estate operations</h2>
            <p className={styles.tagline}>Properties, Pipelines, Users and more — all in one place.</p>
            <div className={styles.stats}>
              <div className={styles.stat}><p className={styles.statValue}>{statVal(stats.data?.properties)}</p><p className={styles.statLabel}>Properties</p></div>
              <div className={styles.stat}><p className={styles.statValue}>{statVal(stats.data?.users)}</p><p className={styles.statLabel}>Users</p></div>
              <div className={styles.stat}><p className={styles.statValue}>{statVal(stats.data?.deals)}</p><p className={styles.statLabel}>Deals</p></div>
            </div>
          </div>
          <p className={styles.copy}>© 2026 Builtglory. All rights reserved.</p>
        </aside>
      )}

      <main className={styles.main} style={{ padding: isMd ? 48 : 32 }}>
        <div className={styles.box}>
          {view === 'login' && (
            <>
              <div>
                <h1 className={styles.h1}>Welcome back</h1>
                <p className={styles.sub}>Sign in to your admin account</p>
              </div>
              {timedOut && (
                <div className={styles.timeout}>⏱ Session expired due to inactivity.<br />Sign in to continue where you left off.</div>
              )}
              <form className={styles.form} onSubmit={submit} noValidate>
                <div>
                  <label htmlFor="email" className={styles.label}>Email Address</label>
                  <input id="email" type="email" autoComplete="username" className={[styles.input, emailError ? styles.inputErr : ''].join(' ')} value={email} placeholder="Enter your email address" onChange={(e) => { setEmail(e.target.value); setEmailError(''); setAuthError(''); }} aria-invalid={!!emailError} />
                  {emailError && <p className={styles.fieldErr}>{emailError}</p>}
                </div>
                <div>
                  <label htmlFor="password" className={styles.label}>Password</label>
                  <div style={{ position: 'relative' }}>
                    <input id="password" type={showPw ? 'text' : 'password'} autoComplete="current-password" className={[styles.input, pwError ? styles.inputErr : ''].join(' ')} style={{ padding: '8px 40px 8px 12px' }} value={password} placeholder="Enter your password" onChange={(e) => { setPassword(e.target.value); setPwError(''); setAuthError(''); }} aria-invalid={!!pwError} />
                    <button type="button" className={styles.eye} onClick={() => setShowPw((s) => !s)} aria-label={showPw ? 'Hide password' : 'Show password'}>
                      <Icon name={showPw ? 'eye-off' : 'eye'} size={16} />
                    </button>
                  </div>
                  {pwError && <p className={styles.fieldErr}>{pwError}</p>}
                  <div style={{ marginTop: 4, textAlign: 'right' }}>
                    <button type="button" className={styles.forgotLink} onClick={() => { setView('forgot'); setAuthError(''); }}>Forgot password?</button>
                  </div>
                </div>
                {authError && (
                  <div className={styles.alert} role="alert">
                    <span style={{ display: 'inline-flex', marginTop: 2 }}><Icon name="alert-circle" size={16} /></span>
                    <p>{authError}</p>
                  </div>
                )}
                <button type="submit" className={styles.submit} disabled={login.isPending} style={{ marginTop: 8, opacity: login.isPending ? 0.5 : 1 }}>
                  {login.isPending ? (<><Icon name="loader-2" size={16} spin />Signing in...</>) : 'Sign In'}
                </button>
              </form>
            </>
          )}

          {view === 'forgot' && (
            <div>
              <button type="button" className={styles.back} onClick={() => setView('login')}><Icon name="chevron-left" size={16} />Back to sign in</button>
              <h1 className={styles.h1}>Reset Password</h1>
              <p className={styles.sub}>A Super Admin resets staff passwords from Access Control. This screen does not email a reset link.</p>
              <div className={styles.notice} role="status">
                <span style={{ display: 'inline-flex', marginTop: 2 }}><Icon name="alert-circle" size={16} /></span>
                <p>Ask a Super Admin to use Access Control, or contact support@builtglory.com. Password changes stay on the admin account in the API.</p>
              </div>
            </div>
          )}

          <p className={styles.help}>
            Having trouble? Contact <a href="mailto:support@builtglory.com">support@builtglory.com</a> · <a href="tel:+918667769670">+91 8667769670</a> ·{' '}
            <a href="https://wa.me/918667769670?text=Hi%20BuiltGlory%20team%2C%20I%20need%20support%20regarding" target="_blank" rel="noopener noreferrer">WhatsApp</a>
          </p>
        </div>
      </main>
    </div>
  );
}
