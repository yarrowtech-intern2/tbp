import React, { useEffect, useMemo, useState } from 'react';
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
import { useLocation, useNavigate } from 'react-router-dom';
import { CircleBottomUp } from 'reicon-react';
import { supabase } from '../lib/supabase';
import { getProfile, signUpWithRole } from '../lib/destinations';
import { clearOAuthIntent, setOAuthIntent } from '../lib/oauthIntent';
import {
    DEFAULT_SIGNUP_VALUES,
    PROVIDER_ROLES,
    ROLE_LABELS,
    ROLE_SIGNUP_CONFIG,
    isProviderRole,
    normalizeRoleValue,
    resolveEffectiveAccountRole,
    type RoleFormField,
    type SignupFormValues,
    type UserRole,
} from '../lib/platform';
import { COUNTRY_OPTIONS } from '../lib/countries';
import { getPasswordFormatStatus, PASSWORD_METER_CIRCUMFERENCE, PASSWORD_REQUIREMENTS_ERROR } from '../lib/password';
import { VIRTUAL_TOURS_ENABLED } from '../lib/virtualTours';
import './auth.css';

const TOURIST_EXPLORE_PATH = '/explore';
type SignupBaseField = 'fullName' | 'email' | 'password';
const PROVIDER_ROLE_SET = new Set<UserRole>(PROVIDER_ROLES);
const isProviderSignupRole = (role: UserRole) => PROVIDER_ROLE_SET.has(role);

const normalizeAppUrl = (rawUrl?: string) => {
    if (!rawUrl) return '';
    return rawUrl.trim().replace(/\/+$/, '');
};

const getOAuthRedirectBaseUrl = () => {
    const fromEnv = normalizeAppUrl(import.meta.env.VITE_PUBLIC_APP_URL);
    if (fromEnv) return fromEnv;
    return normalizeAppUrl(window.location.origin);
};

const getPostLoginDestination = (role?: string | null) => {
    const normalizedRole = normalizeRoleValue(role);
    if (normalizedRole === 'admin') return '/dashboard/admin';
    if (normalizedRole === 'marketing') return '/dashboard/marketing';
    if (isProviderRole(normalizedRole) || normalizedRole === 'provider' || normalizedRole === 'vendor') {
        return '/dashboard/provider';
    }
    return TOURIST_EXPLORE_PATH;
};

const getRecoveryRedirectUrl = () => `${getOAuthRedirectBaseUrl()}/login?mode=recovery`;

const getFunctionErrorMessage = async (err: unknown, fallback: string): Promise<string> => {
    const context = typeof err === 'object' && err !== null && 'context' in err
        ? (err as { context?: unknown }).context
        : null;

    if (context instanceof Response) {
        const response = context.clone();
        try {
            const payload = await response.json() as { error?: unknown; message?: unknown };
            const message = typeof payload.error === 'string'
                ? payload.error
                : typeof payload.message === 'string'
                    ? payload.message
                    : '';
            if (message) return message;
        } catch {
            const text = await context.clone().text().catch(() => '');
            if (text.trim()) return text.trim();
        }
    }

    return err instanceof Error && err.message ? err.message : fallback;
};

const getPasswordResetErrorMessage = async (err: unknown): Promise<string> => {
    const message = await getFunctionErrorMessage(err, 'Password reset failed. Please try again.');
    const normalized = message.toLowerCase();
    if (
        normalized.includes('testing emails')
        || normalized.includes('verify a domain')
        || normalized.includes('resend')
        || normalized.includes('email provider')
    ) {
        return 'Password reset email is not available because the sender email service is not fully verified. Please contact support to reset your password.';
    }
    return message;
};

const sendPasswordResetLink = async (email: string): Promise<void> => {
    const redirectTo = getRecoveryRedirectUrl();
    const { error: nativeResetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
    });

    if (!nativeResetError) return;

    const { error: functionResetError } = await supabase.functions.invoke('send-password-reset-email', {
        body: { email },
    });

    if (functionResetError) throw functionResetError;
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

const SIGNUP_ROLE_LABELS: Record<UserRole, string> = {
    ...ROLE_LABELS,
    tour_guide: 'Local Guide',
    tour_instructor: 'Activity Instructor',
};

const GoogleIcon: React.FC = () => (
    <svg className="auth-google-icon" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
        <path
            fill="#4285F4"
            d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
        />
        <path
            fill="#34A853"
            d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
        />
        <path
            fill="#FBBC05"
            d="M11.69 28.18A13.98 13.98 0 0 1 10.9 24c0-1.45.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"
        />
        <path
            fill="#EA4335"
            d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
        />
    </svg>
);

const AUTH_DRAFT_STORAGE_KEY = 'tbp:auth-draft:v1';

type AuthDraft = {
    isLogin: boolean;
    signupValues: Omit<SignupFormValues, 'password'>;
};

type SignupStep =
    | { kind: 'base'; key: SignupBaseField }
    | { kind: 'role'; field: RoleFormField; label: string; placeholder: string; required: boolean }
    | { kind: 'toggle'; key: 'worksUnderCompany'; label: string; description: string }
    | { kind: 'final' };

const getSignupValuesForDraft = (values: SignupFormValues): Omit<SignupFormValues, 'password'> => {
    const { password, ...draftValues } = values;
    void password;
    return draftValues;
};

const readAuthDraft = (): AuthDraft | null => {
    if (typeof window === 'undefined') return null;
    try {
        const raw = window.sessionStorage.getItem(AUTH_DRAFT_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<AuthDraft>;
        if (!parsed || typeof parsed !== 'object' || !parsed.signupValues) return null;
        return {
            isLogin: parsed.isLogin === true,
            signupValues: {
                ...getSignupValuesForDraft(DEFAULT_SIGNUP_VALUES),
                ...parsed.signupValues,
            },
        };
    } catch {
        return null;
    }
};

const writeAuthDraft = (draft: AuthDraft) => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem(AUTH_DRAFT_STORAGE_KEY, JSON.stringify(draft));
};

const clearAuthDraft = () => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.removeItem(AUTH_DRAFT_STORAGE_KEY);
};

const readAuthQueryIntent = (rawSearch?: string): { isLogin?: boolean; isRecovery?: boolean; deleted?: boolean; role?: UserRole } => {
    if (typeof window === 'undefined' && typeof rawSearch !== 'string') return {};

    const params = new URLSearchParams(typeof rawSearch === 'string' ? rawSearch : window.location.search);
    const mode = params.get('mode')?.trim().toLowerCase();
    const rawRole = params.get('role')?.trim().toLowerCase();
    const requestedRole = rawRole === 'provider' ? 'tour_company' : rawRole;
    const role = requestedRole && requestedRole in ROLE_SIGNUP_CONFIG && (VIRTUAL_TOURS_ENABLED || requestedRole !== 'local_guide')
        ? requestedRole as UserRole
        : undefined;

    return {
        isLogin: mode === 'login' ? true : mode === 'signup' ? false : undefined,
        isRecovery: mode === 'recovery',
        deleted: params.get('deleted') === '1',
        role,
    };
};

export const Auth: React.FC = () => {
    const initialDraft = useMemo(() => readAuthDraft(), []);
    const initialQueryIntent = useMemo(() => readAuthQueryIntent(), []);
    const location = useLocation();
    const currentQueryIntent = useMemo(() => readAuthQueryIntent(location.search), [location.search]);
    const [sideImage] = useState(
        () => NATURE_SIDE_IMAGES[Math.floor(Math.random() * NATURE_SIDE_IMAGES.length)]
    );
    const [isLogin, setIsLogin] = useState(() => {
        if (initialQueryIntent.isLogin !== undefined) return initialQueryIntent.isLogin;
        if (typeof window !== 'undefined' && window.location.pathname === '/login') return true;
        if (typeof window !== 'undefined' && window.location.pathname === '/signup') return false;
        return initialDraft?.isLogin ?? true;
    });
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [showLoginPassword, setShowLoginPassword] = useState(false);
    const [showSignupPassword, setShowSignupPassword] = useState(false);
    const [showRecoveryPassword, setShowRecoveryPassword] = useState(false);
    const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
    const [forgotEmail, setForgotEmail] = useState('');
    const [recoveryPassword, setRecoveryPassword] = useState('');
    const [acceptTerms, setAcceptTerms] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [signupStepIndex, setSignupStepIndex] = useState(0);
    const [countrySearch, setCountrySearch] = useState('');
    const [formValues, setFormValues] = useState<SignupFormValues>(() => ({
        ...DEFAULT_SIGNUP_VALUES,
        ...(initialDraft?.signupValues || {}),
        role: initialQueryIntent.role
            ?? (initialDraft?.signupValues.role === 'local_guide' && !VIRTUAL_TOURS_ENABLED ? DEFAULT_SIGNUP_VALUES.role : initialDraft?.signupValues.role)
            ?? DEFAULT_SIGNUP_VALUES.role,
        password: '',
    }));
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [info, setInfo] = useState<string | null>(
        () => initialQueryIntent.deleted ? 'Your account has been deleted.' : null
    );
    const navigate = useNavigate();

    const activeRole = formValues.role;
    const isProviderSignup = isProviderSignupRole(activeRole);
    const passwordFormat = useMemo(() => getPasswordFormatStatus(formValues.password), [formValues.password]);
    const recoveryPasswordFormat = useMemo(() => getPasswordFormatStatus(recoveryPassword), [recoveryPassword]);
    const passwordProgressStyle = {
        '--password-progress': `${passwordFormat.percentage}%`,
        '--password-progress-offset': PASSWORD_METER_CIRCUMFERENCE - (PASSWORD_METER_CIRCUMFERENCE * passwordFormat.percentage) / 100,
    } as React.CSSProperties;
    const recoveryPasswordProgressStyle = {
        '--password-progress': `${recoveryPasswordFormat.percentage}%`,
        '--password-progress-offset': PASSWORD_METER_CIRCUMFERENCE - (PASSWORD_METER_CIRCUMFERENCE * recoveryPasswordFormat.percentage) / 100,
    } as React.CSSProperties;
    const isRecoveryMode = currentQueryIntent.isRecovery === true;
    const roleConfig = useMemo(() => ROLE_SIGNUP_CONFIG[activeRole], [activeRole]);
    const signupSteps = useMemo<SignupStep[]>(() => {
        const requiresCompanyToggle = activeRole === 'tour_instructor' || activeRole === 'tour_guide';

        return [
            { kind: 'base', key: 'fullName' },
            { kind: 'base', key: 'email' },
            { kind: 'base', key: 'password' },
            ...roleConfig.fields
                .filter((field) => field.key !== 'companyName')
                .map((field) => ({
                    kind: 'role' as const,
                    field: field.key,
                    label: field.label,
                    placeholder: field.placeholder,
                    required: field.required,
                })),
            ...(requiresCompanyToggle
                ? [{
                    kind: 'toggle' as const,
                    key: 'worksUnderCompany' as const,
                    label: 'Tour Company Collaboration',
                    description: 'Turn this on if you currently work under or collaborate with a tour company profile.',
                }]
                : []),
            { kind: 'final' as const },
        ];
    }, [activeRole, roleConfig.fields]);
    const isSignupWizard = !isLogin;
    const currentSignupStep = signupSteps[Math.min(signupStepIndex, signupSteps.length - 1)];
    const currentRoleField = currentSignupStep?.kind === 'role' ? currentSignupStep.field : null;
    const filteredCountryOptions = useMemo(() => {
        const query = countrySearch.trim().toLowerCase();
        if (!query) return COUNTRY_OPTIONS;
        return COUNTRY_OPTIONS.filter((country) => country.toLowerCase().startsWith(query));
    }, [countrySearch]);

    const summaryEntries = useMemo(() => {
        const items: Array<{ label: string; value: string }> = [
            { label: 'Role', value: SIGNUP_ROLE_LABELS[activeRole] },
            { label: 'Name', value: formValues.fullName || 'Not set' },
            { label: 'Email', value: formValues.email || 'Not set' },
        ];

        const companyName = formValues.companyName.trim();
        if (isProviderSignup && (activeRole === 'tour_company' || companyName)) {
            items.push({ label: 'Company', value: companyName || 'Not set' });
        }

        for (const field of roleConfig.fields) {
            const value = String(formValues[field.key] ?? '').trim();
            if (!value) continue;
            items.push({ label: field.label, value });
        }

        if (activeRole === 'tour_instructor' || activeRole === 'tour_guide') {
            items.push({
                label: 'Collaboration',
                value: formValues.worksUnderCompany ? 'Works with a tour company' : 'Independent',
            });
        }

        return items;
    }, [activeRole, formValues, isProviderSignup, roleConfig.fields]);

    useEffect(() => {
        writeAuthDraft({
            isLogin,
            signupValues: getSignupValuesForDraft(formValues),
        });
    }, [formValues, isLogin]);

    useEffect(() => {
        if (!isSignupWizard) {
            setSignupStepIndex(0);
            return;
        }
        setSignupStepIndex((current) => Math.min(current, signupSteps.length - 1));
    }, [isSignupWizard, signupSteps.length]);

    useEffect(() => {
        setSignupStepIndex(0);
        setError(null);
    }, [activeRole]);

    useEffect(() => {
        if (currentRoleField !== 'country') {
            setCountrySearch('');
        }
    }, [currentRoleField]);

    useEffect(() => {
        if (currentQueryIntent.deleted) {
            setInfo('Your account has been deleted.');
            setError(null);
        }
    }, [currentQueryIntent.deleted]);

    const updateField = <K extends keyof SignupFormValues>(key: K, value: SignupFormValues[K]) =>
        setFormValues((current) => ({ ...current, [key]: value }));

    const switchMode = (login: boolean) => {
        setIsLogin(login);
        setError(null);
        setInfo(null);
        navigate(login ? '/login' : '/signup', { replace: true });
    };

    const getSignupStepValue = (step: SignupStep) => {
        if (step.kind === 'base') return formValues[step.key];
        if (step.kind === 'role') return formValues[step.field];
        if (step.kind === 'toggle') return formValues[step.key];
        return '';
    };

    const getSignupStepMeta = (step: SignupStep) => {
        if (step.kind === 'base') {
            switch (step.key) {
                case 'fullName':
                    return {
                        label: 'Your name',
                        placeholder: 'Srijon Karmakar',
                        type: 'text',
                        required: true,
                    };
                case 'email':
                    return {
                        label: 'Email Address',
                        placeholder: 'you@example.com',
                        type: 'email',
                        required: true,
                    };
                case 'password':
                    return {
                        label: 'Password',
                        placeholder: 'Minimum 8 characters',
                        type: showSignupPassword ? 'text' : 'password',
                        required: true,
                    };
            }
        }

        if (step.kind === 'role') {
            return {
                label: step.label,
                placeholder: step.placeholder,
                type: FIELD_INPUT_TYPES[step.field] || 'text',
                required: step.required,
            };
        }

        if (step.kind === 'toggle') {
            return {
                label: step.label,
                description: step.description,
                required: false,
            };
        }

        return null;
    };

    const validateSignupStep = (step: SignupStep) => {
        if (step.kind === 'final') {
            if (!acceptTerms) {
                setError('Accept the Terms & Condition before creating an account.');
                setInfo(null);
                return false;
            }
            return true;
        }

        if (step.kind === 'toggle') {
            setError(null);
            return true;
        }

        if (step.kind === 'base' && step.key === 'fullName') {
            if (!formValues.fullName.trim()) {
                setError('Your name is required.');
                setInfo(null);
                return false;
            }

            if (activeRole === 'tour_company' && !formValues.companyName.trim()) {
                setError('Company name is required.');
                setInfo(null);
                return false;
            }
        }

        const value = String(getSignupStepValue(step) ?? '').trim();
        const meta = getSignupStepMeta(step);
        if (!meta) return true;

        if (meta.required && !value) {
            setError(`${meta.label} is required.`);
            setInfo(null);
            return false;
        }

        if (step.kind === 'base' && step.key === 'email') {
            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailPattern.test(value)) {
                setError('Enter a valid email address.');
                setInfo(null);
                return false;
            }
        }

        if (step.kind === 'base' && step.key === 'password' && !getPasswordFormatStatus(value).isComplete) {
            setError(PASSWORD_REQUIREMENTS_ERROR);
            setInfo(null);
            return false;
        }

        setError(null);
        return true;
    };

    const goToNextSignupStep = () => {
        if (!currentSignupStep || !validateSignupStep(currentSignupStep)) return;
        setSignupStepIndex((current) => Math.min(current + 1, signupSteps.length - 1));
    };

    const goToPreviousSignupStep = () => {
        setError(null);
        setSignupStepIndex((current) => Math.max(current - 1, 0));
    };

    const skipSignupStep = () => {
        if (!currentSignupStep || currentSignupStep.kind !== 'role' || currentSignupStep.required) return;
        setError(null);
        setSignupStepIndex((current) => Math.min(current + 1, signupSteps.length - 1));
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setInfo(null);

        try {
            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                email: loginEmail,
                password: loginPassword,
            });
            if (signInError) throw signInError;

            const signedInUser = signInData.user;
            const metadataRole = typeof signedInUser?.user_metadata?.role === 'string'
                ? signedInUser.user_metadata.role
                : null;
            const profileData = signedInUser?.id ? await getProfile(signedInUser.id) : null;
            const destination = getPostLoginDestination(
                resolveEffectiveAccountRole(profileData?.role, metadataRole)
            );

            navigate(destination);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Authentication failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = async (e?: React.FormEvent) => {
        e?.preventDefault();
        const email = forgotEmail.trim() || loginEmail.trim();
        if (!email) {
            setError('Enter your email address to reset your password.');
            setInfo(null);
            return;
        }

        setLoading(true);
        setError(null);
        setInfo(null);

        try {
            await sendPasswordResetLink(email);
            setForgotPasswordOpen(false);
            setInfo('Password reset link sent. Check your email and open the link to set a new password.');
        } catch (err: unknown) {
            setError(await getPasswordResetErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    const handleRecoveryPasswordUpdate = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!recoveryPasswordFormat.isComplete) {
            setError(PASSWORD_REQUIREMENTS_ERROR);
            setInfo(null);
            return;
        }

        setLoading(true);
        setError(null);
        setInfo(null);

        try {
            const { error: updateError } = await supabase.auth.updateUser({ password: recoveryPassword });
            if (updateError) throw updateError;
            await supabase.auth.signOut();
            setRecoveryPassword('');
            setInfo('Password changed. Log in with your new password.');
            navigate('/login', { replace: true });
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Password update failed. Please request a new reset link.');
        } finally {
            setLoading(false);
        }
    };

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!passwordFormat.isComplete) {
            const passwordStepIndex = signupSteps.findIndex((step) => step.kind === 'base' && step.key === 'password');
            if (passwordStepIndex >= 0) setSignupStepIndex(passwordStepIndex);
            setError(PASSWORD_REQUIREMENTS_ERROR);
            setInfo(null);
            return;
        }

        if (!acceptTerms) {
            setError('Accept the Terms & Condition before creating an account.');
            setInfo(null);
            return;
        }

        if (activeRole === 'tour_company' && !formValues.companyName.trim()) {
            setSignupStepIndex(0);
            setError('Company name is required.');
            setInfo(null);
            return;
        }

        setLoading(true);
        setError(null);
        setInfo(null);

        try {
            const signupResult = await signUpWithRole({
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

            const emailDeliveryNote = signupResult.welcomeEmail?.sent === false
                ? ' The welcome email was not sent; email delivery may need admin configuration.'
                : '';

            setInfo(
                (isProviderSignup
                    ? 'Account created. Check your email verification link, then sign in to submit listings for admin approval.'
                    : 'Account created. Check your email verification link to continue.')
                + emailDeliveryNote
            );
            clearAuthDraft();
            setFormValues(DEFAULT_SIGNUP_VALUES);
            setAcceptTerms(false);
            setIsLogin(true);
            setLoginEmail(formValues.email);
            setLoginPassword('');
            navigate('/login', { replace: true });
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

        if (mode === 'signup' && !acceptTerms) {
            setError('Accept the Terms & Condition before creating an account.');
            setInfo(null);
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
            <a href="/" className="auth-back-link" aria-label="Back to home">
                <ArrowLeft size={16} />
            </a>

            <div className="auth-shell">
                <aside className="auth-visual">
                    <img src={sideImage} alt="Nature travel" className="auth-visual-image" />
                    <div className="auth-visual-overlay" />
                    <div className="auth-visual-brand">
                        <img src="/logo/final-logo-white.png" alt="The Better Pass" />
                    </div>
                </aside>

                <section className="auth-panel">
                    {error && <div className="auth-alert auth-alert-error">{error}</div>}
                    {info && <div className="auth-alert auth-alert-info">{info}</div>}

                    {isRecoveryMode ? (
                        <>
                            <header className="auth-header">
                                <h1>Set password</h1>
                                <p>
                                    Enter a new password for your account.{' '}
                                    <button type="button" onClick={() => navigate('/login', { replace: true })}>
                                        Back to login
                                    </button>
                                </p>
                            </header>

                            <form onSubmit={handleRecoveryPasswordUpdate} className="auth-form">
                                <label className="auth-field">
                                    <span>New Password</span>
                                    <div className="auth-password-wrap">
                                        <input
                                            type={showRecoveryPassword ? 'text' : 'password'}
                                            required
                                            minLength={8}
                                            pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{8,}"
                                            placeholder="Create a strong password"
                                            value={recoveryPassword}
                                            onChange={(e) => setRecoveryPassword(e.target.value)}
                                        />
                                        <button
                                            type="button"
                                            className="auth-eye-btn"
                                            onClick={() => setShowRecoveryPassword((current) => !current)}
                                            aria-label={showRecoveryPassword ? 'Hide password' : 'Show password'}
                                        >
                                            {showRecoveryPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </label>

                                <div
                                    className={`auth-password-format${recoveryPasswordFormat.isComplete ? ' is-complete' : ''}`}
                                    aria-live="polite"
                                >
                                    <div
                                        className="auth-password-meter"
                                        style={recoveryPasswordProgressStyle}
                                        role="img"
                                        aria-label={`Password format ${recoveryPasswordFormat.percentage}% complete`}
                                    >
                                        <svg viewBox="0 0 64 64" aria-hidden="true">
                                            <circle className="auth-password-meter-track" cx="32" cy="32" r="25" />
                                            <circle className="auth-password-meter-progress" cx="32" cy="32" r="25" />
                                        </svg>
                                        <span>{recoveryPasswordFormat.percentage}%</span>
                                    </div>
                                    <ul className="auth-password-rules">
                                        {recoveryPasswordFormat.requirements.map((requirement) => (
                                            <li key={requirement.key} className={requirement.met ? 'is-met' : ''}>
                                                <span aria-hidden="true" />
                                                {requirement.label}
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <button type="submit" className="auth-submit" disabled={loading || !recoveryPasswordFormat.isComplete}>
                                    {loading ? <Loader2 className="animate-spin" size={18} /> : 'Change Password'}
                                </button>
                            </form>
                        </>
                    ) : isLogin ? (
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
                                    <button
                                        type="button"
                                        className="auth-text-link"
                                        onClick={() => {
                                            setForgotEmail(loginEmail);
                                            setForgotPasswordOpen((open) => !open);
                                            setError(null);
                                            setInfo(null);
                                        }}
                                    >
                                        Forgot Password?
                                    </button>
                                </div>

                                {forgotPasswordOpen && (
                                    <div className="auth-reset-card">
                                        <div className="auth-reset-form">
                                            <label className="auth-field">
                                                <span>Reset Email</span>
                                                <input
                                                    type="email"
                                                    required
                                                    placeholder="you@example.com"
                                                    value={forgotEmail}
                                                    onChange={(e) => setForgotEmail(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key !== 'Enter') return;
                                                        e.preventDefault();
                                                        void handleForgotPassword();
                                                    }}
                                                />
                                            </label>
                                            <div className="auth-reset-actions">
                                                <button
                                                    type="button"
                                                    className="auth-secondary-btn"
                                                    onClick={() => setForgotPasswordOpen(false)}
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    type="button"
                                                    className="auth-submit auth-submit--reset"
                                                    disabled={loading}
                                                    onClick={() => void handleForgotPassword()}
                                                >
                                                    {loading ? <Loader2 className="animate-spin" size={18} /> : 'Send Link'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <button type="submit" className="auth-submit" disabled={loading}>
                                    {loading ? (
                                        <Loader2 className="animate-spin" size={18} />
                                    ) : (
                                        <>
                                            <span>Log in</span>
                                            <CircleBottomUp size={18} />
                                        </>
                                    )}
                                </button>

                                <div className="auth-divider">or</div>

                                <div className="auth-social-row auth-social-row--single">
                                    <button
                                        type="button"
                                        className="auth-social-btn"
                                        disabled={googleLoading}
                                        onClick={() => void handleGoogleTouristAuth('login')}
                                    >
                                        {googleLoading ? (
                                            <Loader2 className="animate-spin" size={18} />
                                        ) : (
                                            <GoogleIcon />
                                        )}
                                        <span>{googleLoading ? 'Redirecting to Google…' : 'Continue with Google'}</span>
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
                                        <option value="tour_guide">Local Guide</option>
                                        <option value="tour_instructor">Activity Instructor</option>
                                    </select>
                                </div>
                            )}

                            <form onSubmit={handleSignup} className="auth-form auth-form--signup">
                                {isSignupWizard && currentSignupStep ? (
                                    <>
                                        <div className="auth-tourist-step-header">
                                            <p className="auth-tourist-step-kicker">
                                                {SIGNUP_ROLE_LABELS[activeRole]} signup
                                                <span>{signupStepIndex + 1} / {signupSteps.length}</span>
                                            </p>
                                            <div className="auth-tourist-progress" aria-hidden="true">
                                                <span style={{ width: `${((signupStepIndex + 1) / signupSteps.length) * 100}%` }} />
                                            </div>
                                        </div>

                                        {currentSignupStep.kind === 'final' ? (
                                            <div className="auth-tourist-card auth-tourist-card--final auth-field-full">
                                                <div className="auth-tourist-copy">
                                                    <h2>Review and create your {SIGNUP_ROLE_LABELS[activeRole].toLowerCase()} account</h2>
                                                    <p>
                                                        Your signup data stays the same. This only changes the front-end flow into
                                                        single-question screens.
                                                    </p>
                                                </div>

                                                <div className="auth-tourist-summary">
                                                    {summaryEntries.map((item) => (
                                                        <div key={item.label}>
                                                            <span>{item.label}</span>
                                                            <strong>{item.value}</strong>
                                                        </div>
                                                    ))}
                                                </div>

                                                <label className="auth-check-row auth-check-row-full auth-terms-check">
                                                    <input
                                                        type="checkbox"
                                                        checked={acceptTerms}
                                                        onChange={(e) => {
                                                            setAcceptTerms(e.target.checked);
                                                            setError(null);
                                                        }}
                                                    />
                                                    <span>I agree to the </span>
                                                    <button type="button" className="auth-text-link" onClick={() => navigate('/terms')}>
                                                        Terms &amp; Condition
                                                    </button>
                                                </label>

                                                <div className="auth-tourist-actions">
                                                    <button type="button" className="auth-secondary-btn" onClick={goToPreviousSignupStep}>
                                                        Back
                                                    </button>
                                                    <button type="submit" className="auth-submit" disabled={loading || !passwordFormat.isComplete}>
                                                        {loading ? <Loader2 className="animate-spin" size={18} /> : 'Create Account'}
                                                    </button>
                                                </div>

                                                {activeRole === 'tourist' && (
                                                    <div className="auth-signup-social">
                                                        <div className="auth-divider">or</div>
                                                        <button
                                                            type="button"
                                                            className="auth-social-btn"
                                                            disabled={googleLoading}
                                                            onClick={() => void handleGoogleTouristAuth('signup')}
                                                        >
                                                            {googleLoading ? (
                                                                <Loader2 className="animate-spin" size={18} />
                                                            ) : (
                                                                <GoogleIcon />
                                                            )}
                                                            <span>{googleLoading ? 'Redirecting to Google…' : 'Sign up with Google'}</span>
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            (() => {
                                                const meta = getSignupStepMeta(currentSignupStep);
                                                if (!meta) return null;
                                                const fieldKey = currentSignupStep.kind === 'base'
                                                    ? currentSignupStep.key
                                                    : currentSignupStep.kind === 'role'
                                                        ? currentSignupStep.field
                                                        : currentSignupStep.key;
                                                const toggleValue = currentSignupStep.kind === 'toggle'
                                                    ? Boolean(getSignupStepValue(currentSignupStep))
                                                    : false;
                                                const inputValue = currentSignupStep.kind === 'toggle'
                                                    ? ''
                                                    : String(getSignupStepValue(currentSignupStep) ?? '');
                                                const showSkip = currentSignupStep.kind === 'role' && !currentSignupStep.required;
                                                const isPasswordField = currentSignupStep.kind === 'base' && currentSignupStep.key === 'password';
                                                const isToggleField = currentSignupStep.kind === 'toggle';
                                                const isProviderIdentityStep = currentSignupStep.kind === 'base'
                                                    && currentSignupStep.key === 'fullName'
                                                    && isProviderSignup;
                                                const isCountryField = currentSignupStep.kind === 'role' && currentSignupStep.field === 'country';
                                                const companyNameRequired = activeRole === 'tour_company';
                                                const icon = currentSignupStep.kind === 'role' ? FIELD_ICONS[currentSignupStep.field] : null;
                                                const passwordNextDisabled = isPasswordField && !passwordFormat.isComplete;

                                                return (
                                                    <div className="auth-tourist-card auth-field-full">
                                                        <div className="auth-tourist-copy">
                                                            <h2>{meta.label}</h2>
                                                            <p>
                                                                {isToggleField
                                                                    ? meta.description
                                                                    : isProviderIdentityStep
                                                                    ? companyNameRequired
                                                                        ? `Your name and company name are required to create your ${SIGNUP_ROLE_LABELS[activeRole].toLowerCase()} account.`
                                                                        : 'Your name is required. Add a company name only if you want it attached to this profile.'
                                                                    : meta.required
                                                                    ? `This is required to create your ${SIGNUP_ROLE_LABELS[activeRole].toLowerCase()} account.`
                                                                    : 'Optional. You can skip this and add it later.'}
                                                            </p>
                                                        </div>

                                                        {isToggleField ? (
                                                            <label className="auth-check-card auth-field-full">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={toggleValue}
                                                                    onChange={(e) => updateField(fieldKey, e.target.checked as SignupFormValues[typeof fieldKey])}
                                                                />
                                                                <div>
                                                                    <strong>{meta.label}</strong>
                                                                    <span>{meta.description}</span>
                                                                </div>
                                                            </label>
                                                        ) : isProviderIdentityStep ? (
                                                            <div className="auth-provider-identity-grid auth-field-full">
                                                                <label className="auth-field">
                                                                    <span>Your name</span>
                                                                    <input
                                                                        type="text"
                                                                        required
                                                                        placeholder="Srijon Karmakar"
                                                                        value={formValues.fullName}
                                                                        onChange={(e) => updateField('fullName', e.target.value)}
                                                                    />
                                                                </label>
                                                                <label className="auth-field">
                                                                    <span>{companyNameRequired ? 'Company name' : 'Company name (optional)'}</span>
                                                                    <input
                                                                        type="text"
                                                                        required={companyNameRequired}
                                                                        placeholder="North Ridge Expeditions"
                                                                        value={formValues.companyName}
                                                                        onChange={(e) => updateField('companyName', e.target.value)}
                                                                    />
                                                                </label>
                                                            </div>
                                                        ) : isCountryField ? (
                                                            <div className="auth-field auth-field-full">
                                                                <span>{meta.label}</span>
                                                                <div className="auth-country-picker">
                                                                    <div className={`auth-country-selected${inputValue ? ' has-value' : ''}`}>
                                                                        {inputValue || 'Choose a country'}
                                                                    </div>
                                                                    <div className="auth-input-icon-wrap auth-country-search">
                                                                        {icon && <i>{icon}</i>}
                                                                        <input
                                                                            type="search"
                                                                            placeholder={inputValue ? 'Search to change country' : 'Search country'}
                                                                            value={countrySearch}
                                                                            onChange={(e) => setCountrySearch(e.target.value)}
                                                                            onKeyDown={(e) => {
                                                                                const firstCountry = filteredCountryOptions[0];
                                                                                if (e.key !== 'Enter' || !firstCountry) return;
                                                                                e.preventDefault();
                                                                                updateField('country', firstCountry);
                                                                                setCountrySearch('');
                                                                            }}
                                                                            aria-label="Search country"
                                                                        />
                                                                    </div>
                                                                    <div className="auth-country-options" role="listbox" aria-label="Country options">
                                                                        {filteredCountryOptions.length > 0 ? (
                                                                            filteredCountryOptions.map((country) => (
                                                                                <button
                                                                                    type="button"
                                                                                    key={country}
                                                                                    className={`auth-country-option${formValues.country === country ? ' is-selected' : ''}`}
                                                                                    onClick={() => {
                                                                                        updateField('country', country);
                                                                                        setCountrySearch('');
                                                                                    }}
                                                                                    role="option"
                                                                                    aria-selected={formValues.country === country}
                                                                                >
                                                                                    {country}
                                                                                </button>
                                                                            ))
                                                                        ) : (
                                                                            <div className="auth-country-empty">No countries found</div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <label className="auth-field auth-field-full">
                                                                <span>{meta.label}</span>
                                                                {isPasswordField ? (
                                                                    <div className="auth-password-wrap">
                                                                        <input
                                                                            type={meta.type}
                                                                            required={meta.required}
                                                                            minLength={8}
                                                                            pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{8,}"
                                                                            placeholder={meta.placeholder}
                                                                            value={inputValue}
                                                                            onChange={(e) => updateField(fieldKey, e.target.value as SignupFormValues[typeof fieldKey])}
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
                                                                ) : (
                                                                    <div className="auth-input-icon-wrap">
                                                                        {icon && <i>{icon}</i>}
                                                                        <input
                                                                            type={meta.type}
                                                                            required={meta.required}
                                                                            placeholder={meta.placeholder}
                                                                            value={inputValue}
                                                                            onChange={(e) => updateField(fieldKey, e.target.value as SignupFormValues[typeof fieldKey])}
                                                                        />
                                                                    </div>
                                                                )}
                                                            </label>
                                                        )}

                                                        {isPasswordField && (
                                                            <div
                                                                className={`auth-password-format${passwordFormat.isComplete ? ' is-complete' : ''}`}
                                                                aria-live="polite"
                                                            >
                                                                <div
                                                                    className="auth-password-meter"
                                                                    style={passwordProgressStyle}
                                                                    role="img"
                                                                    aria-label={`Password format ${passwordFormat.percentage}% complete`}
                                                                >
                                                                    <svg viewBox="0 0 64 64" aria-hidden="true">
                                                                        <circle className="auth-password-meter-track" cx="32" cy="32" r="25" />
                                                                        <circle className="auth-password-meter-progress" cx="32" cy="32" r="25" />
                                                                    </svg>
                                                                    <span>{passwordFormat.percentage}%</span>
                                                                </div>
                                                                <ul className="auth-password-rules">
                                                                    {passwordFormat.requirements.map((requirement) => (
                                                                        <li
                                                                            key={requirement.key}
                                                                            className={requirement.met ? 'is-met' : ''}
                                                                        >
                                                                            <span aria-hidden="true" />
                                                                            {requirement.label}
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        )}

                                                        <div className="auth-tourist-actions">
                                                            <button
                                                                type="button"
                                                                className="auth-secondary-btn"
                                                                onClick={goToPreviousSignupStep}
                                                                disabled={signupStepIndex === 0}
                                                            >
                                                                Back
                                                            </button>
                                                            <div className="auth-tourist-actions-group">
                                                                {showSkip && (
                                                                    <button type="button" className="auth-secondary-btn" onClick={skipSignupStep}>
                                                                        Skip
                                                                    </button>
                                                                )}
                                                                <button
                                                                    type="button"
                                                                    className="auth-submit auth-submit--step"
                                                                    onClick={goToNextSignupStep}
                                                                    disabled={passwordNextDisabled}
                                                                >
                                                                    Next
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <label className="auth-check-row auth-check-row-full auth-terms-check auth-terms-check--compact">
                                                            <input
                                                                type="checkbox"
                                                                checked={acceptTerms}
                                                                onChange={(e) => {
                                                                    setAcceptTerms(e.target.checked);
                                                                    setError(null);
                                                                }}
                                                            />
                                                            <span>I agree to the </span>
                                                            <button type="button" className="auth-text-link" onClick={() => navigate('/terms')}>
                                                                Terms &amp; Condition
                                                            </button>
                                                        </label>

                                                        {activeRole === 'tourist' && (
                                                            <div className="auth-signup-social auth-signup-social--compact">
                                                                <div className="auth-divider">or</div>
                                                                <button
                                                                    type="button"
                                                                    className="auth-social-btn"
                                                                    disabled={googleLoading}
                                                                    onClick={() => void handleGoogleTouristAuth('signup')}
                                                                >
                                                                    {googleLoading ? (
                                                                        <Loader2 className="animate-spin" size={18} />
                                                                    ) : (
                                                                        <GoogleIcon />
                                                                    )}
                                                                    <span>{googleLoading ? 'Redirecting to Google…' : 'Sign up with Google'}</span>
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })()
                                        )}
                                    </>
                                ) : null}

                                <p className="auth-role-note">Selected role: {SIGNUP_ROLE_LABELS[activeRole]}</p>
                            </form>
                        </>
                    )}
                </section>
            </div>
        </div>
    );
};
