import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, Moon, Sun, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { normalizeRoleValue } from '../lib/platform';

type NavTab = 'home' | 'explore' | 'dashboard' | 'bookings' | 'profile';

export const Navbar: React.FC = () => {
    const { user, profile, profileLoading, signOut, isAdmin, isProvider, roleLabel } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const [showMenu, setShowMenu] = useState(false);
    const mobileNavRef = useRef<HTMLDivElement | null>(null);
    const location = useLocation();

    const isDark = theme === 'dark';
    const homePath = '/';
    const logoSrc = isDark ? '/logo/logo-white.png' : '/logo/logo.png';
    const navSurface = isDark ? 'rgba(0,0,0,0.74)' : 'rgba(242,138,36,0.46)';
    const navSurfaceSoft = isDark ? 'rgba(10,10,10,0.80)' : 'rgba(242,138,36,0.58)';
    const navBorder = isDark ? 'rgba(255,255,255,0.16)' : 'rgba(138,73,8,0.28)';
    const navInset = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,242,224,0.30)';
    const navText = isDark ? 'rgba(248,250,252,0.82)' : 'rgba(31,18,7,0.86)';
    const navTextStrong = isDark ? '#f8fafc' : '#1f1308';
    const navHover = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)';
    const navDivider = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(63,34,8,0.28)';
    const navActiveBg = isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.86)';
    const navActiveText = '#ffffff';
    const resolvedRole = typeof profile?.role === 'string' && profile.role.trim()
        ? normalizeRoleValue(profile.role)
        : typeof user?.user_metadata?.role === 'string' && user.user_metadata.role.trim()
            ? normalizeRoleValue(user.user_metadata.role)
            : null;
    const normalizedRoleLabel = roleLabel.trim().toLowerCase();
    const providerByLabel = normalizedRoleLabel === 'tour company'
        || normalizedRoleLabel === 'tour instructor'
        || normalizedRoleLabel === 'tour guide'
        || normalizedRoleLabel === 'provider'
        || normalizedRoleLabel === 'vendor';
    const adminByLabel = normalizedRoleLabel === 'admin';
    const roleReady = !user || !profileLoading;
    const providerAccount = isProvider
        || providerByLabel
        || resolvedRole === 'tour_company'
        || resolvedRole === 'tour_instructor'
        || resolvedRole === 'tour_guide'
        || resolvedRole === 'provider'
        || resolvedRole === 'vendor'
        || location.pathname.startsWith('/dashboard/provider')
        || location.pathname.startsWith('/provider/studio');
    const adminAccount = isAdmin || adminByLabel || resolvedRole === 'admin' || location.pathname.startsWith('/dashboard/admin') || location.pathname.startsWith('/admin');
    const isTourist = roleReady && !providerAccount && !adminAccount && (resolvedRole === 'tourist' || normalizedRoleLabel === 'tourist');
    const dashboardPath = providerAccount ? '/dashboard/provider' : adminAccount ? '/dashboard/admin' : '/dashboard';
    const touristDashboardPath = '/dashboard/tourist';
    const touristExplorePath = '/explore';
    const touristBookingsPath = '/dashboard/tourist?section=bookings';

    const activeTab: NavTab | null = (() => {
        const tab = new URLSearchParams(location.search).get('tab');
        if (location.pathname === '/profile') return 'profile';
        if (!isTourist) return null;
        if (location.pathname === '/') return 'home';
        if (location.pathname === '/explore') return 'explore';
        if (location.pathname.startsWith('/dashboard')) {
            const section = new URLSearchParams(location.search).get('section');
            if (section === 'bookings') return 'bookings';
            return 'dashboard';
        }
        if (
            location.pathname === '/events'
            || location.pathname === '/guides'
            || location.pathname === '/tours'
            || location.pathname === '/activities'
            || tab === 'tours'
            || tab === 'activities'
            || tab === 'events'
            || tab === 'guides'
        ) {
            return 'explore';
        }
        return null;
    })();

    const navLinks: Array<{ key: NavTab; label: string; to: string }> = [
        ...(!roleReady
            ? []
            : isTourist
            ? [
                { key: 'home' as NavTab, label: 'Home', to: '/' },
                { key: 'explore' as NavTab, label: 'Explore', to: touristExplorePath },
                { key: 'dashboard' as NavTab, label: 'Dashboard', to: touristDashboardPath },
                { key: 'bookings' as NavTab, label: 'Bookings', to: touristBookingsPath },
                { key: 'profile' as NavTab, label: 'Profile', to: '/profile' },
              ]
            : [
                { key: 'dashboard' as NavTab, label: 'Dashboard', to: dashboardPath },
                { key: 'profile' as NavTab, label: 'Profile', to: '/profile' },
              ]),
    ];

    const shortName = (() => {
        const name = profile?.full_name?.trim();
        if (!name || name.includes('@')) {
            const local = user?.email?.split('@')[0] || 'User';
            return local.charAt(0).toUpperCase() + local.slice(1);
        }
        const parts = name.split(' ').filter(Boolean);
        if (parts.length <= 1) return parts[0];
        return `${parts[0]} ${parts[parts.length - 1][0]}`;
    })();

    const avatarSrc = profile?.profile_image_url
        || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.id}`;

    useEffect(() => {
        if (!showMenu) return;

        const onPointerDown = (event: MouseEvent | TouchEvent) => {
            const target = event.target as Node | null;
            if (!target) return;
            if (mobileNavRef.current?.contains(target)) return;
            setShowMenu(false);
        };

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setShowMenu(false);
        };

        document.addEventListener('mousedown', onPointerDown);
        document.addEventListener('touchstart', onPointerDown, { passive: true });
        document.addEventListener('keydown', onKeyDown);

        return () => {
            document.removeEventListener('mousedown', onPointerDown);
            document.removeEventListener('touchstart', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [showMenu]);

    return (
        <>
            {/* ── Desktop nav bar ─────────────────────────────── */}
            <div className="nbr-bar nbr-desktop">
                {/* Centered glass pill */}
                <div className="nbr-pill">
                    <Link to={homePath} aria-label="Home" className="nbr-logo-wrap">
                        <img src={logoSrc} alt="The Better Pass" className="nbr-logo" />
                    </Link>

                    {user && (
                        <>
                            <div className="nbr-sep" />
                            {navLinks.map((item) => (
                                <Link
                                    key={item.key}
                                    to={item.to}
                                    className={`nbr-link${activeTab === item.key ? ' nbr-link--active' : ''}`}
                                >
                                    <span className="nbr-link-inner">{item.label}</span>
                                </Link>
                            ))}
                            {adminAccount && (
                                <Link to="/admin" className={`nbr-link${location.pathname === '/admin' ? ' nbr-link--active' : ''}`}>
                                    Admin
                                </Link>
                            )}
                            {providerAccount && (
                                <Link to="/provider/studio" className={`nbr-link${location.pathname === '/provider/studio' ? ' nbr-link--active' : ''}`}>
                                    Studio
                                </Link>
                            )}
                        </>
                    )}

                    {!user && (
                        <Link to="/auth" className="nbr-join">Join</Link>
                    )}
                </div>

                {/* Right: user chip (outside the pill) */}
                {user && (
                    <Link to={dashboardPath} className="nbr-user-chip">
                        <div className="nbr-user-text">
                            <span className="nbr-user-name">{shortName}</span>
                            <span className="nbr-user-role">{roleLabel}</span>
                        </div>
                        <img src={avatarSrc} alt={shortName} className="nbr-avatar" />
                    </Link>
                )}
            </div>

            {/* ── Mobile nav bar ──────────────────────────────── */}
            <div className="nbr-bar nbr-mobile" ref={mobileNavRef}>
                <div className="nbr-pill nbr-mobile-pill">
                    <Link to={homePath} aria-label="Home" className="nbr-logo-wrap">
                        <img src={logoSrc} alt="The Better Pass" className="nbr-logo nbr-logo--sm" />
                    </Link>
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {user && (
                            <Link to={dashboardPath} className="nbr-avatar-sm-wrap">
                                <img src={avatarSrc} alt={shortName} className="nbr-avatar-sm" />
                            </Link>
                        )}
                        <button
                            type="button"
                            onClick={() => setShowMenu(!showMenu)}
                            className="nbr-hamburger"
                            aria-label={showMenu ? 'Close' : 'Menu'}
                        >
                            {showMenu ? <X size={18} /> : <Menu size={18} />}
                        </button>
                    </div>
                </div>

                {/* Mobile dropdown */}
                {showMenu && (
                    <div className="nbr-dropdown">
                        {user && navLinks.map((item) => (
                            <Link key={item.key} to={item.to} className="nbr-drop-item" onClick={() => setShowMenu(false)}>
                                {item.label}
                            </Link>
                        ))}
                        {user && adminAccount && (
                            <Link to="/admin" className="nbr-drop-item" onClick={() => setShowMenu(false)}>Admin</Link>
                        )}
                        {user && providerAccount && (
                            <Link to="/provider/studio" className="nbr-drop-item" onClick={() => setShowMenu(false)}>Studio</Link>
                        )}
                        {!user && (
                            <Link to="/auth" className="nbr-drop-item nbr-drop-item--accent" onClick={() => setShowMenu(false)}>
                                Join Membership
                            </Link>
                        )}
                        <div className="nbr-drop-sep" />
                        <button type="button" className="nbr-drop-item nbr-drop-item--btn" onClick={toggleTheme}>
                            {isDark ? <Sun size={14} /> : <Moon size={14} />}
                            {isDark ? 'Light Mode' : 'Dark Mode'}
                        </button>
                        {user && (
                            <button
                                type="button"
                                className="nbr-drop-item nbr-drop-item--btn nbr-drop-item--danger"
                                onClick={() => { void signOut(); setShowMenu(false); }}
                            >
                                Sign Out
                            </button>
                        )}
                    </div>
                )}
            </div>

            <style>{`
                /* ── Fixed bar ──────────────────────────────────────── */
                .nbr-bar {
                    align-items: center;
                    display: flex;
                    justify-content: center;
                    left: 0;
                    padding: 0 32px;
                    position: fixed;
                    right: 0;
                    top: 28px;
                    z-index: 1000;
                    pointer-events: none;
                }

                .nbr-bar > * { pointer-events: all; }

                /* ── Glass pill ─────────────────────────────────────── */
                .nbr-pill {
                    align-items: center;
                    animation: fadeInDown 0.5s cubic-bezier(0.23,1,0.32,1) both;
                    backdrop-filter: blur(20px) saturate(200%);
                    -webkit-backdrop-filter: blur(20px) saturate(200%);
                    background: ${navSurface};
                    border: 1px solid ${navBorder};
                    border-radius: 999px;
                    box-shadow:
                        0 4px 24px rgba(15,23,42,0.10),
                        inset 0 1px 0 ${navInset};
                    display: inline-flex;
                    gap: 2px;
                    padding: 7px 10px;
                }

                @keyframes fadeInDown {
                    from { opacity: 0; transform: translateY(-12px); }
                    to   { opacity: 1; transform: translateY(0); }
                }

                /* Logo */
                .nbr-logo-wrap {
                    align-items: center;
                    display: inline-flex;
                    flex-shrink: 0;
                    margin-right: 4px;
                    text-decoration: none;
                }
                .nbr-logo     { display: block; height: 34px; max-width: 150px; object-fit: contain; width: auto; }
                .nbr-logo--sm { height: 28px; max-width: 130px; }

                /* Divider between logo and links */
                .nbr-sep {
                    background: ${navDivider};
                    border-radius: 1px;
                    flex-shrink: 0;
                    height: 20px;
                    margin: 0 6px;
                    width: 1px;
                }

                /* Nav links */
                .nbr-link {
                    border-radius: 999px;
                    color: ${navText};
                    font-family: 'Outfit', sans-serif;
                    font-size: 0.875rem;
                    font-weight: 600;
                    padding: 6px 14px;
                    text-decoration: none;
                    transition: color 0.18s, background 0.18s;
                    white-space: nowrap;
                }
                .nbr-link-inner {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                }
                .nbr-link:hover { color: ${navTextStrong}; }
                .nbr-link--active {
                    background: ${navActiveBg};
                    color: ${navActiveText};
                }

                /* Join (guest) */
                .nbr-join {
                    border-radius: 999px;
                    color: var(--accent);
                    font-size: 0.875rem;
                    font-weight: 700;
                    margin-left: 4px;
                    padding: 6px 16px;
                    text-decoration: none;
                }

                /* ── User chip (right, outside pill) ────────────────── */
                .nbr-user-chip {
                    align-items: center;
                    animation: fadeInDown 0.5s cubic-bezier(0.23,1,0.32,1) both;
                    animation-delay: 0.06s;
                    backdrop-filter: blur(20px) saturate(200%);
                    -webkit-backdrop-filter: blur(20px) saturate(200%);
                    background: ${navSurface};
                    border: 1px solid ${navBorder};
                    border-radius: 999px;
                    box-shadow: 0 4px 24px rgba(15,23,42,0.10), inset 0 1px 0 ${navInset};
                    display: inline-flex;
                    gap: 8px;
                    padding: 5px 5px 5px 12px;
                    position: absolute;
                    right: 32px;
                    text-decoration: none;
                    transition: box-shadow 0.2s, transform 0.2s;
                }
                .nbr-user-chip:hover {
                    box-shadow: 0 6px 20px rgba(15,23,42,0.15);
                    transform: translateY(-1px);
                }

                .nbr-user-text {
                    display: flex;
                    flex-direction: column;
                    line-height: 1.25;
                }
                .nbr-user-name {
                    color: ${isDark ? '#f8fafc' : '#1d1207'};
                    font-size: 0.82rem;
                    font-weight: 700;
                }
                .nbr-user-role {
                    color: ${navText};
                    font-size: 0.68rem;
                    font-weight: 500;
                }

                .nbr-avatar {
                    border-radius: 50%;
                    flex-shrink: 0;
                    height: 30px;
                    object-fit: cover;
                    width: 30px;
                }

                /* ── Mobile ─────────────────────────────────────────── */
                .nbr-desktop { display: flex !important; }
                .nbr-mobile  { display: none !important; }

                .nbr-mobile-pill {
                    flex: 1;
                    max-width: 100%;
                    width: 100%;
                }

                .nbr-avatar-sm-wrap {
                    border: 1.5px solid var(--border-light);
                    border-radius: 50%;
                    display: block;
                    flex-shrink: 0;
                    height: 28px;
                    overflow: hidden;
                    width: 28px;
                }
                .nbr-avatar-sm { height: 100%; object-fit: cover; width: 100%; }

                .nbr-hamburger {
                    align-items: center;
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    background: ${navHover};
                    border: 1px solid var(--border-light);
                    border-radius: 999px;
                    color: var(--text-main);
                    cursor: pointer;
                    display: inline-flex;
                    height: 32px;
                    justify-content: center;
                    padding: 0;
                    transition: background 0.18s;
                    width: 32px;
                }
                .nbr-hamburger:hover { background: ${isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.16)'}; }

                /* ── Dropdown ───────────────────────────────────────── */
                .nbr-dropdown {
                    animation: fadeInDown 0.18s ease-out;
                    backdrop-filter: blur(22px) saturate(190%);
                    -webkit-backdrop-filter: blur(22px) saturate(190%);
                    background: ${navSurfaceSoft};
                    border: 1px solid ${navBorder};
                    border-radius: 20px;
                    box-shadow: 0 16px 48px rgba(15,23,42,0.18);
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                    margin-top: 10px;
                    padding: 8px;
                    pointer-events: all;
                    width: 100%;
                }

                .nbr-drop-item {
                    border-radius: 12px;
                    color: ${navTextStrong};
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    font-size: 0.9rem;
                    font-weight: 600;
                    padding: 10px 14px;
                    text-decoration: none;
                    transition: background 0.14s;
                }
                .nbr-drop-item:hover { background: ${navHover}; }
                .nbr-drop-item--accent { color: var(--accent); font-weight: 800; }
                .nbr-drop-item--danger { color: var(--danger-text, #e53e3e); }

                .nbr-drop-item--btn {
                    align-items: center;
                    background: none;
                    border: none;
                    cursor: pointer;
                    display: flex;
                    font-family: inherit;
                    gap: 10px;
                    text-align: left;
                    width: 100%;
                }

                .nbr-drop-sep {
                    background: var(--border-light);
                    height: 1px;
                    margin: 4px 2px;
                }

                @media (max-width: 768px) {
                    .nbr-desktop { display: none !important; }
                    .nbr-mobile  { display: flex !important; flex-direction: column; align-items: stretch; padding: 0 16px; top: 16px; }

                    .nbr-mobile-pill {
                        backdrop-filter: blur(20px) saturate(200%) !important;
                        -webkit-backdrop-filter: blur(20px) saturate(200%) !important;
                        background: ${navSurface} !important;
                        border: 1px solid ${navBorder} !important;
                        border-radius: 999px !important;
                        box-shadow:
                            0 4px 24px rgba(15,23,42,0.10),
                            inset 0 1px 0 ${navInset} !important;
                        padding: 7px 10px !important;
                    }

                    .nbr-avatar-sm-wrap { display: none !important; }
                }
            `}</style>
        </>
    );
};
