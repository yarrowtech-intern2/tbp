import React, { useMemo, useState } from 'react';
import {
    ArrowLeft,
    Backpack,
    Building2,
    Eye,
    EyeOff,
    Loader2,
    MapPin,
    Phone,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { signUpWithRole } from '../lib/destinations';
import { clearOAuthIntent, setOAuthIntent } from '../lib/oauthIntent';
import {
    DEFAULT_SIGNUP_VALUES,
    ROLE_LABELS,
    ROLE_SIGNUP_CONFIG,
    type RoleFormField,
    type SignupFormValues,
    type UserRole,
} from '../lib/platform';
import './auth.css';

const TOURIST_EXPLORE_PATH = '/explore';

const normalizeAppUrl = (rawUrl?: string) => {
    if (!rawUrl) return '';
    return rawUrl.trim().replace(/\/+$/, '');
};

const getOAuthRedirectBaseUrl = () => {
    const fromEnv = normalizeAppUrl(import.meta.env.VITE_PUBLIC_APP_URL);
    if (fromEnv) return fromEnv;
    return normalizeAppUrl(window.location.origin);
};

const NATURE_SIDE_IMAGES = [
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1470770903676-69b98201ea1c?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1433086966358-54859d0ed716?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
];

const FIELD_INPUT_TYPES: Partial<Record<RoleFormField, string>> = {
    website: 'url',
    yearsExperience: 'number',
};

const FIELD_ICONS: Partial<Record<RoleFormField, React.ReactNode>> = {
    phone: <Phone size={15} />,
    country: <MapPin size={15} />,
    city: <MapPin size={15} />,
};

export const Auth: React.FC = () => {
    const [sideImage] = useState(
        () => NATURE_SIDE_IMAGES[Math.floor(Math.random() * NATURE_SIDE_IMAGES.length)]
    );
    const [isLogin, setIsLogin] = useState(true);
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [showLoginPassword, setShowLoginPassword] = useState(false);
    const [showSignupPassword, setShowSignupPassword] = useState(false);
    const [loginAgree, setLoginAgree] = useState(true);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [formValues, setFormValues] = useState<SignupFormValues>(DEFAULT_SIGNUP_VALUES);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [info, setInfo] = useState<string | null>(null);
    const navigate = useNavigate();

    const activeRole = formValues.role;
    const roleConfig = useMemo(() => ROLE_SIGNUP_CONFIG[activeRole], [activeRole]);

    const updateField = <K extends keyof SignupFormValues>(key: K, value: SignupFormValues[K]) =>
        setFormValues((current) => ({ ...current, [key]: value }));

    const switchMode = (login: boolean) => {
        setIsLogin(login);
        setError(null);
        setInfo(null);
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setInfo(null);

        try {
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: loginEmail,
                password: loginPassword,
            });
            if (signInError) throw signInError;
            navigate(TOURIST_EXPLORE_PATH);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Authentication failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setInfo(null);

        try {
            await signUpWithRole({
                fullName: formValues.fullName,
                email: formValues.email,
                password: formValues.password,
                role: formValues.role,
                phone: formValues.phone,
                country: formValues.country,
                city: formValues.city,
                bio: formValues.bio,
                companyName: formValues.companyName,
                registrationNumber: formValues.registrationNumber,
                website: formValues.website,
                specialties: formValues.specialties,
                licenseNumber: formValues.licenseNumber,
                languages: formValues.languages,
                yearsExperience: formValues.yearsExperience,
                governmentId: formValues.governmentId,
                certificateId: formValues.certificateId,
                worksUnderCompany: formValues.worksUnderCompany,
            });

            if (activeRole === 'tourist') {
                const { data: sessionData } = await supabase.auth.getSession();
                if (sessionData.session?.user) {
                    navigate(TOURIST_EXPLORE_PATH);
                    return;
                }
            }

            setInfo(
                activeRole === 'tour_company' || activeRole === 'tour_instructor' || activeRole === 'tour_guide'
                    ? 'Account created. Check your email verification link, then sign in to submit listings for admin approval.'
                    : 'Account created. Check your email verification link to continue.'
            );
            setIsLogin(true);
            setLoginEmail(formValues.email);
            setLoginPassword('');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Authentication failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleTouristAuth = async (mode: 'login' | 'signup') => {
        if (mode === 'signup' && activeRole !== 'tourist') {
            setInfo('Google signup is available for Tourist accounts only.');
            return;
        }

        setGoogleLoading(true);
        setError(null);
        setInfo(null);

        try {
            const redirectTo = `${getOAuthRedirectBaseUrl()}${TOURIST_EXPLORE_PATH}`;

            if (mode === 'signup') {
                setOAuthIntent({
                    provider: 'google',
                    mode: 'signup',
                    role: 'tourist',
                    fullName: formValues.fullName,
                    phone: formValues.phone,
                    country: formValues.country,
                    city: formValues.city,
                    bio: formValues.bio,
                });
            } else {
                clearOAuthIntent();
            }

            const { error: oauthError } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo,
                    queryParams: {
                        prompt: 'select_account',
                    },
                },
            });
            if (oauthError) throw oauthError;
        } catch (err: unknown) {
            clearOAuthIntent();
            const fallback = 'Google authentication failed. Please try again.';
            const message = err instanceof Error ? err.message : fallback;
            const normalized = message.toLowerCase();

            if (normalized.includes('unsupported provider') || normalized.includes('provider is not enabled')) {
                setError('Google provider is not enabled in Supabase Auth settings. Enable Google OAuth in your Supabase project.');
            } else {
                setError(message || fallback);
            }
        } finally {
            setGoogleLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <a href="/" className="auth-back-link">
                <ArrowLeft size={16} />
                <span>Back to home</span>
            </a>

            <div className="auth-shell">
                <aside className="auth-visual">
                    <img src={sideImage} alt="Nature travel" className="auth-visual-image" />
                    <div className="auth-visual-overlay" />
                    <div className="auth-visual-brand">
                        <img src="/logo/icon.png" alt="The Better Pass" />
                        <span>The Better Pass</span>
                    </div>
                </aside>

                <section className="auth-panel">
                    {error && <div className="auth-alert auth-alert-error">{error}</div>}
                    {info && <div className="auth-alert auth-alert-info">{info}</div>}

                    {isLogin ? (
                        <>
                            <header className="auth-header">
                                <h1>Log in</h1>
                                <p>
                                    Don&apos;t have an account?{' '}
                                    <button type="button" onClick={() => switchMode(false)}>
                                        Create Account
                                    </button>
                                </p>
                            </header>

                            <form onSubmit={handleLogin} className="auth-form">
                                <label className="auth-field">
                                    <span>Email Address</span>
                                    <input
                                        type="email"
                                        required
                                        placeholder="you@example.com"
                                        value={loginEmail}
                                        onChange={(e) => setLoginEmail(e.target.value)}
                                    />
                                </label>

                                <label className="auth-field">
                                    <span>Password</span>
                                    <div className="auth-password-wrap">
                                        <input
                                            type={showLoginPassword ? 'text' : 'password'}
                                            required
                                            placeholder="Enter password"
                                            value={loginPassword}
                                            onChange={(e) => setLoginPassword(e.target.value)}
                                        />
                                        <button
                                            type="button"
                                            className="auth-eye-btn"
                                            onClick={() => setShowLoginPassword((current) => !current)}
                                            aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                                        >
                                            {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </label>

                                <div className="auth-row-link">
                                    <button type="button" className="auth-text-link">Forgot Password?</button>
                                </div>

                                <button type="submit" className="auth-submit" disabled={loading}>
                                    {loading ? <Loader2 className="animate-spin" size={18} /> : 'Log in'}
                                </button>

                                <label className="auth-check-row">
                                    <input
                                        type="checkbox"
                                        checked={loginAgree}
                                        onChange={(e) => setLoginAgree(e.target.checked)}
                                    />
                                    <span>
                                        I agree to the <button type="button" className="auth-text-link" onClick={() => navigate('/terms')}>Terms &amp; Condition</button>
                                    </span>
                                </label>

                                <div className="auth-divider">or</div>

                                <div className="auth-social-row auth-social-row--single">
                                    <button
                                        type="button"
                                        className="auth-social-btn"
                                        disabled={googleLoading}
                                        onClick={() => void handleGoogleTouristAuth('login')}
                                    >
                                        {googleLoading ? 'Redirecting to Google...' : 'Continue with Google'}
                                    </button>
                                </div>
                                {/* <p className="auth-role-note">Google login is available for Tourist accounts only.</p> */}
                            </form>
                        </>
                    ) : (
                        <>
                            <header className="auth-header">
                                <h1>Create account</h1>
                                <p>
                                    Already have an account?{' '}
                                    <button type="button" onClick={() => switchMode(true)}>
                                        Log in
                                    </button>
                                </p>
                            </header>

                            <div className="auth-role-choice">
                                <button
                                    type="button"
                                    className={`auth-role-choice-btn${activeRole === 'tourist' ? ' is-active' : ''}`}
                                    onClick={() => updateField('role', 'tourist')}
                                >
                                    <Backpack size={16} />
                                    <span>Tourist</span>
                                </button>
                                <button
                                    type="button"
                                    className={`auth-role-choice-btn${activeRole !== 'tourist' ? ' is-active' : ''}`}
                                    onClick={() => {
                                        if (activeRole === 'tourist') updateField('role', 'tour_company');
                                    }}
                                >
                                    <Building2 size={16} />
                                    <span>Provider</span>
                                </button>
                            </div>

                            {activeRole !== 'tourist' && (
                                <div className="auth-provider-select-wrap">
                                    <select
                                        className="auth-provider-select"
                                        value={activeRole}
                                        onChange={(e) => updateField('role', e.target.value as UserRole)}
                                        aria-label="Select provider type"
                                    >
                                        <option value="tour_company">Tour Company</option>
                                        <option value="tour_guide">Tour Guide</option>
                                        <option value="tour_instructor">Tour Instructor</option>
                                    </select>
                                </div>
                            )}

                            <form onSubmit={handleSignup} className="auth-form auth-form--signup">
                                <label className="auth-field">
                                    <span>Full Name</span>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Alex Mercer"
                                        value={formValues.fullName}
                                        onChange={(e) => updateField('fullName', e.target.value)}
                                    />
                                </label>

                                <label className="auth-field">
                                    <span>Email Address</span>
                                    <input
                                        type="email"
                                        required
                                        placeholder="you@example.com"
                                        value={formValues.email}
                                        onChange={(e) => updateField('email', e.target.value)}
                                    />
                                </label>

                                <label className="auth-field auth-field-full">
                                    <span>Password</span>
                                    <div className="auth-password-wrap">
                                        <input
                                            type={showSignupPassword ? 'text' : 'password'}
                                            required
                                            minLength={8}
                                            placeholder="Minimum 8 characters"
                                            value={formValues.password}
                                            onChange={(e) => updateField('password', e.target.value)}
                                        />
                                        <button
                                            type="button"
                                            className="auth-eye-btn"
                                            onClick={() => setShowSignupPassword((current) => !current)}
                                            aria-label={showSignupPassword ? 'Hide password' : 'Show password'}
                                        >
                                            {showSignupPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </label>

                                {roleConfig.fields.length > 0 &&
                                    roleConfig.fields.map((field) => (
                                        <label key={field.key} className="auth-field">
                                            <span>{field.label}</span>
                                            <div className="auth-input-icon-wrap">
                                                {FIELD_ICONS[field.key] && <i>{FIELD_ICONS[field.key]}</i>}
                                                <input
                                                    type={FIELD_INPUT_TYPES[field.key] || 'text'}
                                                    required={field.required}
                                                    placeholder={field.placeholder}
                                                    value={String(formValues[field.key] ?? '')}
                                                    onChange={(e) =>
                                                        updateField(field.key, e.target.value as SignupFormValues[typeof field.key])
                                                    }
                                                />
                                            </div>
                                        </label>
                                    ))}

                                {activeRole !== 'tour_company' && activeRole !== 'tourist' && (
                                    <label className="auth-check-row auth-check-row-full">
                                        <input
                                            type="checkbox"
                                            checked={formValues.worksUnderCompany}
                                            onChange={(e) => updateField('worksUnderCompany', e.target.checked)}
                                        />
                                        <span>I currently work under or collaborate with a tour company profile.</span>
                                    </label>
                                )}

                                <p className="auth-role-note">Selected role: {ROLE_LABELS[activeRole]}</p>

                                <p className="auth-role-note">
                                    By creating an account, you agree to the{' '}
                                    <button type="button" className="auth-text-link" onClick={() => navigate('/terms')}>
                                        Terms &amp; Condition
                                    </button>
                                </p>

                                <button type="submit" className="auth-submit" disabled={loading}>
                                    {loading ? <Loader2 className="animate-spin" size={18} /> : 'Create Account'}
                                </button>

                                <div className="auth-signup-social">
                                    <div className="auth-divider">or</div>
                                    <button
                                        type="button"
                                        className="auth-social-btn"
                                        disabled={googleLoading || activeRole !== 'tourist'}
                                        onClick={() => void handleGoogleTouristAuth('signup')}
                                    >
                                        {googleLoading ? 'Redirecting to Google...' : 'Sign up with Google'}
                                    </button>
                                    {activeRole !== 'tourist' && (
                                        <p className="auth-role-note">Switch role to Tourist to use Google signup.</p>
                                    )}
                                </div>
                            </form>
                        </>
                    )}
                </section>
            </div>
        </div>
    );
};
