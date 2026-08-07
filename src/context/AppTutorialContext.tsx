import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { normalizeRoleValue } from '../lib/platform';
import { supabase } from '../lib/supabase';
import { AppTutorialContext } from './app-tutorial-context-value';
import './app-tutorial.css';

type TutorialRole = 'tourist' | 'provider' | 'admin' | 'marketing';
type TutorialRunMode = 'auto' | 'manual';

type TutorialStep = {
    id: string;
    route: string;
    selector: string;
    title: string;
    description: string;
};

const TUTORIAL_PENDING_KEY = 'tutorial_pending';
const TUTORIAL_COMPLETED_KEY = 'tutorial_completed';
const TUTORIAL_COMPLETED_AT_KEY = 'tutorial_completed_at';

const matchesRoute = (currentPath: string, currentSearch: string, expectedRoute: string) => {
    const current = `${currentPath}${currentSearch}`;
    return current === expectedRoute;
};

const resolveTutorialRole = (role?: string | null): TutorialRole => {
    const normalized = normalizeRoleValue(role);
    if (normalized === 'admin') return 'admin';
    if (normalized === 'marketing') return 'marketing';
    if (
        normalized === 'provider'
        || normalized === 'vendor'
        || normalized === 'tour_company'
        || normalized === 'tour_guide'
        || normalized === 'tour_instructor'
    ) {
        return 'provider';
    }
    return 'tourist';
};

const getTutorialSteps = (role: TutorialRole): TutorialStep[] => {
    if (role === 'provider') {
        return [
            {
                id: 'provider-overview',
                route: '/dashboard/provider',
                selector: '[data-tutorial-id="dashboard-nav-overview"], [data-tutorial-id="dashboard-mobile-overview"]',
                title: 'Provider Dashboard',
                description: 'This is your provider home. Use it to monitor your activity and jump into the pages you use most.',
            },
            {
                id: 'provider-studio',
                route: '/dashboard/provider?section=studio',
                selector: '[data-tutorial-id="dashboard-nav-studio"], [data-tutorial-id="dashboard-mobile-studio"]',
                title: 'Studio',
                description: 'Open Studio to create and submit tours, activities, or guide listings for review.',
            },
            {
                id: 'provider-listings',
                route: '/dashboard/provider?section=listings',
                selector: '[data-tutorial-id="dashboard-nav-listings"], [data-tutorial-id="dashboard-mobile-listings"]',
                title: 'Listings',
                description: 'Listings shows the posts you have already submitted and their current status.',
            },
            {
                id: 'provider-bookings',
                route: '/dashboard/provider?section=bookings',
                selector: '[data-tutorial-id="dashboard-nav-bookings"], [data-tutorial-id="dashboard-mobile-bookings"]',
                title: 'Bookings',
                description: 'Check incoming bookings here and respond to requests from travelers.',
            },
            {
                id: 'provider-revenue',
                route: '/dashboard/provider?section=revenue',
                selector: '[data-tutorial-id="dashboard-nav-revenue"], [data-tutorial-id="dashboard-mobile-revenue"]',
                title: 'Revenue',
                description: 'Use Revenue to review earnings, payouts, and payment totals.',
            },
            {
                id: 'provider-profile',
                route: '/profile',
                selector: '[data-tutorial-id="profile-readiness"]',
                title: 'Profile',
                description: 'Keep your profile complete here, especially your provider details and verification readiness.',
            },
        ];
    }

    if (role === 'admin') {
        return [
            {
                id: 'admin-overview',
                route: '/dashboard/admin',
                selector: '[data-tutorial-id="dashboard-nav-overview"], [data-tutorial-id="dashboard-mobile-overview"]',
                title: 'Admin Dashboard',
                description: 'This is the admin overview for platform activity, queue health, and quick access to core controls.',
            },
            {
                id: 'admin-moderation',
                route: '/dashboard/admin?section=moderation',
                selector: '[data-tutorial-id="dashboard-nav-moderation"], [data-tutorial-id="dashboard-mobile-moderation"]',
                title: 'Moderation',
                description: 'Moderation is where you review submitted listings and decide what moves forward.',
            },
            {
                id: 'admin-accepted',
                route: '/dashboard/admin?section=accepted',
                selector: '[data-tutorial-id="dashboard-nav-accepted"], [data-tutorial-id="dashboard-mobile-accepted"]',
                title: 'Accepted And Rejected',
                description: 'Use Accepted and Rejected pages to review past decisions and their outcomes.',
            },
            {
                id: 'admin-bookings',
                route: '/dashboard/admin?section=bookings',
                selector: '[data-tutorial-id="dashboard-nav-bookings"], [data-tutorial-id="dashboard-mobile-bookings"]',
                title: 'Refunds',
                description: 'Open Refunds to track booking disputes, refund requests, and settlement actions.',
            },
            {
                id: 'admin-users',
                route: '/dashboard/admin?section=users',
                selector: '[data-tutorial-id="dashboard-nav-users"], [data-tutorial-id="dashboard-mobile-users"]',
                title: 'Users',
                description: 'Users helps you inspect platform accounts, while nearby sections cover map and audit visibility.',
            },
            {
                id: 'admin-messages',
                route: '/dashboard/admin?section=messages',
                selector: '[data-tutorial-id="dashboard-nav-messages"], [data-tutorial-id="dashboard-mobile-messages"]',
                title: 'Messages',
                description: 'Messages collects alerts and communication items that need admin attention.',
            },
        ];
    }

    if (role === 'marketing') {
        return [
            {
                id: 'marketing-overview',
                route: '/dashboard/marketing',
                selector: '[data-tutorial-id="dashboard-nav-overview"], [data-tutorial-id="dashboard-mobile-overview"]',
                title: 'Sales Dashboard',
                description: 'This is your sales and marketing home for editing customer-facing platform content.',
            },
            {
                id: 'marketing-greetings',
                route: '/dashboard/marketing?section=greetings',
                selector: '[data-tutorial-id="dashboard-nav-greetings"], [data-tutorial-id="dashboard-mobile-greetings"]',
                title: 'Edit Greetings',
                description: 'Use Edit Greetings to update key landing messages and short welcome copy.',
            },
            {
                id: 'marketing-about',
                route: '/dashboard/marketing?section=about',
                selector: '[data-tutorial-id="dashboard-nav-about"], [data-tutorial-id="dashboard-mobile-about"]',
                title: 'Edit About',
                description: 'Edit About controls the longer brand and company sections users read across the product.',
            },
            {
                id: 'marketing-contact',
                route: '/dashboard/marketing?section=contact',
                selector: '[data-tutorial-id="dashboard-nav-contact"], [data-tutorial-id="dashboard-mobile-contact"]',
                title: 'Edit Contact Info',
                description: 'Keep support and contact details current here so visitors see accurate business information.',
            },
            {
                id: 'marketing-inquiries',
                route: '/dashboard/marketing?section=inquiries',
                selector: '[data-tutorial-id="dashboard-nav-inquiries"], [data-tutorial-id="dashboard-mobile-inquiries"]',
                title: 'Contact Leads',
                description: 'Contact Leads is where you review incoming inquiries and handoff opportunities.',
            },
            {
                id: 'marketing-messages',
                route: '/dashboard/marketing?section=messages',
                selector: '[data-tutorial-id="dashboard-nav-messages"], [data-tutorial-id="dashboard-mobile-messages"]',
                title: 'Messages',
                description: 'Use Messages to keep up with notifications related to content and sales operations.',
            },
        ];
    }

    return [
        {
            id: 'tourist-explore',
            route: '/explore',
            selector: '[data-tutorial-id="tourist-explore-search"]',
            title: 'Explore',
            description: 'Start here to browse live tours, activities, and guides, or search for something specific.',
        },
        {
            id: 'tourist-filters',
            route: '/explore',
            selector: '[data-tutorial-id="tourist-explore-filters"]',
            title: 'Filters',
            description: 'Use these category filters to switch quickly between tours, activities, and guides.',
        },
        {
            id: 'tourist-dashboard',
            route: '/dashboard/tourist',
            selector: '[data-tutorial-id="dashboard-nav-overview"], [data-tutorial-id="dashboard-mobile-overview"]',
            title: 'Dashboard',
            description: 'Your dashboard summarizes bookings, spend, alerts, and the main account actions.',
        },
        {
            id: 'tourist-bookings',
            route: '/dashboard/tourist?section=bookings',
            selector: '[data-tutorial-id="dashboard-nav-bookings"], [data-tutorial-id="dashboard-mobile-bookings"]',
            title: 'Bookings',
            description: 'Open Bookings to track upcoming trips, past bookings, and refund-related actions.',
        },
        {
            id: 'tourist-profile',
            route: '/profile',
            selector: '[data-tutorial-id="profile-hero"]',
            title: 'Profile',
            description: 'Profile stores your account details, saved information, and personal travel context.',
        },
    ];
};

const getTooltipStyle = (targetRect: DOMRect | null) => {
    const margin = 20;
    const width = Math.min(360, window.innerWidth - 24);

    if (!targetRect || window.innerWidth < 780) {
        return {
            left: Math.max(12, (window.innerWidth - width) / 2),
            top: Math.max(12, window.innerHeight - 240),
            width,
        };
    }

    const rightSpace = window.innerWidth - targetRect.right;
    const leftSpace = targetRect.left;
    const belowSpace = window.innerHeight - targetRect.bottom;
    if (rightSpace >= width + margin) {
        return {
            left: Math.min(window.innerWidth - width - 12, targetRect.right + margin),
            top: Math.min(window.innerHeight - 220, Math.max(12, targetRect.top)),
            width,
        };
    }

    if (leftSpace >= width + margin) {
        return {
            left: Math.max(12, targetRect.left - width - margin),
            top: Math.min(window.innerHeight - 220, Math.max(12, targetRect.top)),
            width,
        };
    }

    if (belowSpace >= 220) {
        return {
            left: Math.max(12, Math.min(window.innerWidth - width - 12, targetRect.left)),
            top: Math.min(window.innerHeight - 220, targetRect.bottom + margin),
            width,
        };
    }

    return {
        left: Math.max(12, Math.min(window.innerWidth - width - 12, targetRect.left)),
        top: Math.max(12, targetRect.top - 220 - margin),
        width,
    };
};

export const AppTutorialProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, profile, loading, profileLoading } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isOpen, setIsOpen] = useState(false);
    const [runMode, setRunMode] = useState<TutorialRunMode>('manual');
    const [activeIndex, setActiveIndex] = useState(0);
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
    const handledAutoUsersRef = useRef(new Set<string>());
    const completionInFlightRef = useRef(false);

    const role = useMemo(() => {
        const profileRole = typeof profile?.role === 'string' ? profile.role : null;
        const metadataRole = typeof user?.user_metadata?.role === 'string' ? user.user_metadata.role : null;
        return resolveTutorialRole(profileRole || metadataRole);
    }, [profile?.role, user?.user_metadata]);

    const steps = useMemo(() => getTutorialSteps(role), [role]);
    const currentStep = isOpen ? steps[activeIndex] : null;
    const tutorialPending = user?.user_metadata?.[TUTORIAL_PENDING_KEY] === true;
    const tutorialCompleted = user?.user_metadata?.[TUTORIAL_COMPLETED_KEY] === true;

    const persistTutorialCompletion = useCallback(async () => {
        if (!user || completionInFlightRef.current) return;
        completionInFlightRef.current = true;

        try {
            const { error } = await supabase.auth.updateUser({
                data: {
                    ...user.user_metadata,
                    [TUTORIAL_PENDING_KEY]: false,
                    [TUTORIAL_COMPLETED_KEY]: true,
                    [TUTORIAL_COMPLETED_AT_KEY]: new Date().toISOString(),
                },
            });

            if (error) {
                console.error('Failed to update tutorial metadata:', error);
            }
        } finally {
            completionInFlightRef.current = false;
        }
    }, [user]);

    const closeTutorial = useCallback(async () => {
        setIsOpen(false);
        setTargetRect(null);
        if (user?.id) {
            handledAutoUsersRef.current.add(user.id);
        }
        await persistTutorialCompletion();
    }, [persistTutorialCompletion, user?.id]);

    const goToStep = useCallback((index: number) => {
        const boundedIndex = Math.max(0, Math.min(index, steps.length - 1));
        const nextStep = steps[boundedIndex];
        setActiveIndex(boundedIndex);
        if (!nextStep) return;
        if (!matchesRoute(location.pathname, location.search, nextStep.route)) {
            navigate(nextStep.route);
        }
    }, [location.pathname, location.search, navigate, steps]);

    const openTutorial = useCallback(() => {
        if (!steps.length) return;
        setRunMode('manual');
        setActiveIndex(0);
        setIsOpen(true);
        if (!matchesRoute(location.pathname, location.search, steps[0].route)) {
            navigate(steps[0].route);
        }
    }, [location.pathname, location.search, navigate, steps]);

    useEffect(() => {
        if (!isOpen) return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [closeTutorial, isOpen]);

    useEffect(() => {
        if (!user || loading || profileLoading || isOpen) return;
        if (location.pathname === '/auth') return;
        if (!tutorialPending || tutorialCompleted) return;
        if (handledAutoUsersRef.current.has(user.id)) return;

        handledAutoUsersRef.current.add(user.id);
        setRunMode('auto');
        setActiveIndex(0);
        setIsOpen(true);

        if (steps[0] && !matchesRoute(location.pathname, location.search, steps[0].route)) {
            navigate(steps[0].route);
        }
    }, [
        isOpen,
        loading,
        location.pathname,
        location.search,
        navigate,
        profileLoading,
        steps,
        tutorialCompleted,
        tutorialPending,
        user,
    ]);

    useEffect(() => {
        if (!isOpen || !currentStep) return;

        let cancelled = false;
        let attempts = 0;

        const syncTarget = () => {
            if (cancelled) return;

            const nextTarget = document.querySelector(currentStep.selector) as HTMLElement | null;
            if (!nextTarget) {
                attempts += 1;
                if (attempts < 24) {
                    window.setTimeout(syncTarget, 120);
                } else {
                    setTargetRect(null);
                }
                return;
            }

            nextTarget.scrollIntoView({
                block: 'center',
                inline: 'center',
                behavior: attempts === 0 ? 'auto' : 'smooth',
            });

            window.requestAnimationFrame(() => {
                if (cancelled) return;
                const rect = nextTarget.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                    setTargetRect(rect);
                } else {
                    setTargetRect(null);
                }
            });
        };

        syncTarget();

        return () => {
            cancelled = true;
        };
    }, [currentStep, isOpen, location.pathname, location.search]);

    useEffect(() => {
        if (!isOpen || !currentStep) return;

        const refreshRect = () => {
            const target = document.querySelector(currentStep.selector) as HTMLElement | null;
            if (!target) {
                setTargetRect(null);
                return;
            }
            const rect = target.getBoundingClientRect();
            setTargetRect(rect.width > 0 && rect.height > 0 ? rect : null);
        };

        window.addEventListener('resize', refreshRect);
        window.addEventListener('scroll', refreshRect, true);

        refreshRect();

        return () => {
            window.removeEventListener('resize', refreshRect);
            window.removeEventListener('scroll', refreshRect, true);
        };
    }, [currentStep, isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                void closeTutorial();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [closeTutorial, isOpen]);

    const tooltipStyle = currentStep ? getTooltipStyle(targetRect) : null;

    return (
        <AppTutorialContext.Provider value={{ isOpen, openTutorial }}>
            {children}

            {isOpen && currentStep && tooltipStyle && (
                <div className="app-tutorial-layer" role="dialog" aria-modal="true" aria-labelledby="app-tutorial-title">
                    <div className="app-tutorial-backdrop" />
                    {targetRect && (
                        <div
                            className="app-tutorial-highlight"
                            style={{
                                top: Math.max(8, targetRect.top - 8),
                                left: Math.max(8, targetRect.left - 8),
                                width: Math.min(window.innerWidth - 16, targetRect.width + 16),
                                height: Math.min(window.innerHeight - 16, targetRect.height + 16),
                            }}
                        />
                    )}

                    <section
                        className="app-tutorial-card"
                        style={{
                            top: tooltipStyle.top,
                            left: tooltipStyle.left,
                            width: tooltipStyle.width,
                        }}
                    >
                        <div className="app-tutorial-step-count">
                            Step {activeIndex + 1} of {steps.length}
                            {runMode === 'auto' ? ' · first-time guide' : ''}
                        </div>
                        <h2 id="app-tutorial-title">{currentStep.title}</h2>
                        <p>{currentStep.description}</p>

                        <div className="app-tutorial-actions">
                            <button type="button" className="app-tutorial-btn app-tutorial-btn--ghost" onClick={() => void closeTutorial()}>
                                Skip
                            </button>
                            <div className="app-tutorial-nav">
                                <button
                                    type="button"
                                    className="app-tutorial-btn app-tutorial-btn--soft"
                                    disabled={activeIndex === 0}
                                    onClick={() => goToStep(activeIndex - 1)}
                                >
                                    Back
                                </button>
                                {activeIndex === steps.length - 1 ? (
                                    <button type="button" className="app-tutorial-btn app-tutorial-btn--primary" onClick={() => void closeTutorial()}>
                                        Done
                                    </button>
                                ) : (
                                    <button type="button" className="app-tutorial-btn app-tutorial-btn--primary" onClick={() => goToStep(activeIndex + 1)}>
                                        Next
                                    </button>
                                )}
                            </div>
                        </div>
                    </section>
                </div>
            )}
        </AppTutorialContext.Provider>
    );
};
