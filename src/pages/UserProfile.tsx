import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft, BadgeCheck, Building2, Globe, Languages, Loader2,
    MapPin, MessageCircle, Phone, Sparkles, UserCheck, UserPlus, Users,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import {
    followProvider,
    getConversationEligibility,
    getOrCreateConversation,
    getProfileFollowStats,
    getProviderListingsByUserId,
    getUserProfileById,
    isFollowingProvider,
    unfollowProvider,
    type PostRecord,
    type Profile,
} from '../lib/destinations';
import { getRoleLabel, getVerificationLabel, isProviderRole } from '../lib/platform';
import './user-profile.css';

const getAvatar = (profile: Profile) => (
    profile.profile_image_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.id}`
);

const getName = (profile: Profile) => profile.full_name || profile.email || 'Member';

const listingPathType = (type?: string | null) => (type === 'guide' ? 'event' : type || 'activity');

const formatLanguages = (value: string[] | string | null | undefined) => {
    if (Array.isArray(value)) return value.join(', ');
    return value || '';
};

export const UserProfile: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user, profile: viewerProfile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [messageLoading, setMessageLoading] = useState(false);
    const [followLoading, setFollowLoading] = useState(false);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [listings, setListings] = useState<PostRecord[]>([]);
    const [followerCount, setFollowerCount] = useState(0);
    const [followingCount, setFollowingCount] = useState(0);
    const [isFollowing, setIsFollowing] = useState(false);
    const [messageAllowed, setMessageAllowed] = useState(false);
    const [messageReason, setMessageReason] = useState<string | null>(null);

    useEffect(() => {
        if (!id || !user) return;
        if (user.id === id) {
            navigate('/profile', { replace: true });
            return;
        }

        const load = async () => {
            setLoading(true);
            try {
                const nextProfile = await getUserProfileById(id);
                setProfile(nextProfile);

                if (!nextProfile) {
                    setListings([]);
                    setFollowerCount(0);
                    setFollowingCount(0);
                    setIsFollowing(false);
                    setMessageAllowed(false);
                    setMessageReason(null);
                    return;
                }

                const providerAccount = isProviderRole(nextProfile.role);
                const [followStats, providerListings, followState, eligibility] = await Promise.all([
                    getProfileFollowStats(id),
                    providerAccount ? getProviderListingsByUserId(id) : Promise.resolve([]),
                    providerAccount ? isFollowingProvider(user.id, id) : Promise.resolve(false),
                    getConversationEligibility(user.id, id).catch((error) => ({
                        allowed: false,
                        reason: error instanceof Error ? error.message : 'Conversation is not available.',
                        currentRole: null,
                        otherRole: null,
                    })),
                ]);

                setListings(providerListings);
                setFollowerCount(followStats.followers);
                setFollowingCount(followStats.following);
                setIsFollowing(followState);
                setMessageAllowed(eligibility.allowed);
                setMessageReason(eligibility.reason);
            } finally {
                setLoading(false);
            }
        };

        void load();
    }, [id, navigate, user]);

    const providerAccount = isProviderRole(profile?.role);
    const viewerIsTourist = viewerProfile?.role === 'tourist';
    const canFollow = Boolean(user && id && providerAccount && viewerIsTourist);
    const displayName = profile ? getName(profile) : 'Member';
    const location = [profile?.city, profile?.country].filter(Boolean).join(', ');
    const socialLinks = useMemo(() => ([
        { label: 'Website', href: profile?.website || '' },
        { label: 'Facebook', href: profile?.facebook || '' },
        { label: 'Instagram', href: profile?.instagram || '' },
        { label: 'YouTube', href: profile?.youtube || '' },
    ]).filter((item) => item.href.trim().length > 0), [profile?.facebook, profile?.instagram, profile?.website, profile?.youtube]);
    const detailCards = useMemo(() => {
        if (!profile) return [];

        const cards = [
            { label: 'Location', value: location, icon: MapPin },
            { label: 'Phone', value: profile.phone || '', icon: Phone },
            { label: 'Website', value: profile.website || '', icon: Globe },
        ];

        if (profile.role === 'tour_company') {
            cards.push({ label: 'Company', value: profile.company_name || '', icon: Building2 });
        }
        if (profile.role === 'tour_instructor') {
            cards.push(
                { label: 'Specialties', value: profile.provider_specialties || '', icon: Sparkles },
                { label: 'Experience', value: profile.years_experience ? `${profile.years_experience} years` : '', icon: Users },
            );
        }
        if (profile.role === 'tour_guide') {
            cards.push(
                { label: 'Languages', value: formatLanguages(profile.languages), icon: Languages },
                { label: 'Experience', value: profile.years_experience ? `${profile.years_experience} years` : '', icon: Users },
            );
        }

        return cards.filter((item) => item.value.trim().length > 0);
    }, [location, profile]);

    const handleFollowToggle = async () => {
        if (!user || !id || !providerAccount) return;

        setFollowLoading(true);
        try {
            if (isFollowing) {
                await unfollowProvider(user.id, id);
                setIsFollowing(false);
                setFollowerCount((value) => Math.max(0, value - 1));
            } else {
                await followProvider(user.id, id);
                setIsFollowing(true);
                setFollowerCount((value) => value + 1);
            }
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Could not update follow state.');
        } finally {
            setFollowLoading(false);
        }
    };

    const handleMessage = async () => {
        if (!user || !id) return;
        if (!messageAllowed) {
            alert(messageReason || 'Messaging is not available for this account yet.');
            return;
        }

        setMessageLoading(true);
        try {
            const conversation = await getOrCreateConversation(user.id, id);
            navigate(`/messages?conversation=${conversation.id}`);
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Could not open conversation.');
        } finally {
            setMessageLoading(false);
        }
    };

    if (loading) {
        return (
            <main className="upr-page">
                <div className="container upr-shell upr-shell--loading">
                    <Loader2 className="animate-spin" size={34} />
                </div>
            </main>
        );
    }

    if (!profile) {
        return (
            <main className="upr-page">
                <div className="container upr-shell upr-shell--loading">
                    <div className="upr-empty">
                        <h2>User profile not found.</h2>
                        <Link to="/dashboard" className="upr-action upr-action--solid">Return to dashboard</Link>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="upr-page animate-fade">
            <div className="container upr-shell">
                <button type="button" onClick={() => navigate(-1)} className="upr-back">
                    <ArrowLeft size={16} /> Back
                </button>

                <section className="upr-hero">
                    <div
                        className="upr-cover"
                        style={profile.cover_image_url ? { backgroundImage: `url(${profile.cover_image_url})` } : undefined}
                    />

                    <div className="upr-head">
                        <div className="upr-avatar-ring">
                            <img src={getAvatar(profile)} alt={displayName} className="upr-avatar" />
                        </div>

                        <div className="upr-head-copy">
                            <div className="upr-badges">
                                <span className="upr-badge upr-badge--role">{getRoleLabel(profile.role)}</span>
                                <span className="upr-badge upr-badge--verify">
                                    {getVerificationLabel(profile.verification_status)}
                                    {profile.verification_status === 'approved' && <BadgeCheck size={14} />}
                                </span>
                            </div>
                            <h1>{displayName}</h1>
                            {location && (
                                <p className="upr-location">
                                    <MapPin size={14} /> {location}
                                </p>
                            )}
                            {profile.bio && <p className="upr-bio">{profile.bio}</p>}
                        </div>

                        <div className="upr-actions">
                            {canFollow && (
                                <button
                                    type="button"
                                    className={`upr-action${isFollowing ? ' upr-action--soft' : ' upr-action--solid'}`}
                                    onClick={handleFollowToggle}
                                    disabled={followLoading}
                                >
                                    {followLoading ? <Loader2 size={15} className="animate-spin" /> : isFollowing ? <UserCheck size={15} /> : <UserPlus size={15} />}
                                    {isFollowing ? 'Following' : 'Follow'}
                                </button>
                            )}

                            {user?.id !== profile.id && (
                                <button
                                    type="button"
                                    className="upr-action upr-action--soft"
                                    onClick={handleMessage}
                                    disabled={messageLoading || !messageAllowed}
                                    title={!messageAllowed ? (messageReason || 'Messaging unavailable') : 'Open message thread'}
                                >
                                    {messageLoading ? <Loader2 size={15} className="animate-spin" /> : <MessageCircle size={15} />}
                                    {messageAllowed ? 'Message' : 'Message Locked'}
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="upr-stats">
                        <div className="upr-stat">
                            <strong>{providerAccount ? listings.length : followingCount}</strong>
                            <span>{providerAccount ? 'Listings' : 'Following'}</span>
                        </div>
                        <div className="upr-stat">
                            <strong>{followerCount}</strong>
                            <span>{providerAccount ? 'Followers' : 'Followers'}</span>
                        </div>
                        <div className="upr-stat">
                            <strong>{socialLinks.length}</strong>
                            <span>Links</span>
                        </div>
                    </div>

                    {!messageAllowed && user?.id !== profile.id && (
                        <p className="upr-message-note">
                            {messageReason || 'Messaging unlocks after a confirmed booking.'}
                        </p>
                    )}
                </section>

                <section className="upr-card">
                    <div className="upr-card-head">
                        <div>
                            <h2>{providerAccount ? 'Professional Details' : 'Account Details'}</h2>
                            <p>{providerAccount ? 'Information travelers see before deciding to book.' : 'Public profile information available to other signed-in users.'}</p>
                        </div>
                    </div>

                    <div className="upr-detail-grid">
                        {detailCards.length > 0 ? detailCards.map((item) => {
                            const Icon = item.icon;
                            return (
                                <div key={item.label} className="upr-detail-card">
                                    <div className="upr-detail-icon"><Icon size={16} /></div>
                                    <div>
                                        <span>{item.label}</span>
                                        <strong>{item.value}</strong>
                                    </div>
                                </div>
                            );
                        }) : (
                            <p className="upr-empty-copy">This account has not added public details yet.</p>
                        )}
                    </div>

                    {socialLinks.length > 0 && (
                        <div className="upr-link-row">
                            {socialLinks.map((item) => (
                                <a
                                    key={item.label}
                                    href={item.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="upr-link-pill"
                                >
                                    {item.label}
                                </a>
                            ))}
                        </div>
                    )}
                </section>

                {providerAccount && (
                    <section className="upr-card">
                        <div className="upr-card-head">
                            <div>
                                <h2>Live Listings</h2>
                                <p>Packages and experiences currently visible to travelers.</p>
                            </div>
                            <span className="upr-count">{listings.length} live</span>
                        </div>

                        {listings.length === 0 ? (
                            <p className="upr-empty-copy">No live listings published yet.</p>
                        ) : (
                            <div className="upr-listing-grid">
                                {listings.slice(0, 6).map((item) => (
                                    <Link
                                        key={item.id}
                                        to={`/listings/${listingPathType(typeof item.type === 'string' ? item.type : 'activity')}/${item.id}`}
                                        className="upr-listing-card"
                                    >
                                        <div
                                            className="upr-listing-image"
                                            style={{ backgroundImage: `url(${item.image_url || item.cover_image_url || item.thumbnail_url || ''})` }}
                                        />
                                        <div className="upr-listing-copy">
                                            <strong>{item.title || item.name || 'Untitled listing'}</strong>
                                            <span>{item.location || 'Location shared after booking'}</span>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </section>
                )}
            </div>
        </main>
    );
};
