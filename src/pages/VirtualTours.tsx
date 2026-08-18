import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
    ArrowUpRight,
    CalendarDays,
    CheckCircle2,
    ClipboardList,
    Headphones,
    Loader2,
    RadioTower,
    Video,
    XCircle,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getPrimaryListingImage } from '../lib/listingImages';
import { calculatePricingFromProviderUnit } from '../lib/pricing';
import {
    getBookings,
    getMyPosts,
    getProviderBookings,
    getPublicListingsByType,
    respondToBookingRequest,
    type PostRecord,
    type UnifiedBooking,
} from '../lib/destinations';
import { getRoleLabel, isProviderRole, resolveEffectiveAccountRole } from '../lib/platform';
import './virtual-tours.css';

const FALLBACK_IMAGE = '/images/home4/forrest.jpg';
const VIRTUAL_TAGS = ['virtual tour', 'live 360', '360', 'vr tour', 'ar tour', 'virtual', 'remote tour'];
const JOINABLE_STATUSES = new Set(['confirmed', 'completed', 'accepted']);

const getText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const titleForPost = (post: PostRecord): string => (
    getText(post.title) || getText(post.name) || getText(post.location) || 'Live virtual tour'
);

const titleForBooking = (booking: UnifiedBooking): string => (
    getText(booking.listing_title) || 'Live virtual tour'
);

const isPaidBooking = (booking: UnifiedBooking): boolean => (
    booking.payment_status === 'paid'
    || Boolean(booking.paid_at)
    || Boolean(booking.payment_id)
);

const canJoinBooking = (booking: UnifiedBooking): boolean => (
    isPaidBooking(booking) && JOINABLE_STATUSES.has(String(booking.status || '').toLowerCase())
);

const isVirtualText = (value: string): boolean => {
    const normalized = value.toLowerCase();
    return VIRTUAL_TAGS.some((tag) => normalized.includes(tag));
};

const isVirtualTourListing = (post: PostRecord): boolean => {
    const flagged = post.is_virtual_tour === true
        || post.virtual_tour === true
        || getText(post.experience_mode).toLowerCase() === 'virtual'
        || getText(post.delivery_mode).toLowerCase() === 'virtual';

    if (flagged) return true;

    return isVirtualText([
        post.sub_category,
        post.category,
        post.title,
        post.name,
        post.description,
    ].map(getText).filter(Boolean).join(' '));
};

const isVirtualTourBooking = (booking: UnifiedBooking, listing?: PostRecord): boolean => (
    Boolean(listing && isVirtualTourListing(listing))
    || isVirtualText([booking.listing_title, booking.listing_type].map(getText).filter(Boolean).join(' '))
);

const dedupePosts = (posts: PostRecord[]): PostRecord[] => {
    const seen = new Set<string>();
    return posts.filter((post) => {
        const id = String(post.id || '').trim();
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
    });
};

const formatMoney = (value?: number | null): string => {
    if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) return 'Custom';
    return `Rs. ${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value)}`;
};

const formatListingPrice = (post: PostRecord): string => {
    if (typeof post.price !== 'number' || Number.isNaN(post.price) || post.price <= 0) return 'Custom';
    return formatMoney(calculatePricingFromProviderUnit(post.price, 1).tourist_unit_price);
};

const formatDateTime = (value?: string | null): string => {
    if (!value) return 'Slot pending';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Slot pending';
    return new Intl.DateTimeFormat('en-IN', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(date);
};

const listingHref = (post: PostRecord): string => {
    const type = post.type === 'tour' ? 'tour' : post.type === 'activity' ? 'activity' : 'event';
    return `/listings/${type}/${post.id}`;
};

const bookingRoomHref = (booking: UnifiedBooking): string => `/virtual-tours/live/${booking.id}`;

type LoadState = {
    publicListings: PostRecord[];
    providerListings: PostRecord[];
    touristBookings: UnifiedBooking[];
    providerBookings: UnifiedBooking[];
};

const EMPTY_LOAD_STATE: LoadState = {
    publicListings: [],
    providerListings: [],
    touristBookings: [],
    providerBookings: [],
};

export const VirtualTours: React.FC = () => {
    const { bookingId } = useParams();
    const { user, profile, loading, profileLoading, isProvider, roleLabel } = useAuth();
    const [data, setData] = useState<LoadState>(EMPTY_LOAD_STATE);
    const [dataLoading, setDataLoading] = useState(true);
    const [dataError, setDataError] = useState<string | null>(null);
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [activeLiveBookingId, setActiveLiveBookingId] = useState<string | null>(bookingId || null);
    const [cameraReady, setCameraReady] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const role = useMemo(() => {
        const profileRole = typeof profile?.role === 'string' ? profile.role : null;
        const metadataRole = typeof user?.user_metadata?.role === 'string' ? user.user_metadata.role : null;
        return resolveEffectiveAccountRole(profileRole, metadataRole);
    }, [profile?.role, user?.user_metadata?.role]);
    const providerAccount = Boolean(isProvider || isProviderRole(role) || role === 'provider' || role === 'vendor');
    const localGuideAccount = role === 'local_guide';
    const readableRole = getRoleLabel(role || roleLabel);
    const providerDashboardHref = localGuideAccount ? '/dashboard/provider?section=virtual-tours' : '/dashboard/provider?section=studio';
    const providerCreateHref = localGuideAccount ? '/dashboard/provider?section=virtual-tours&create=live-tour' : '/dashboard/provider?section=studio';

    useEffect(() => {
        setActiveLiveBookingId(bookingId || null);
    }, [bookingId]);

    const stopCamera = useCallback(() => {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setCameraReady(false);
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    }, []);

    const startCamera = useCallback(async () => {
        setCameraError(null);
        if (streamRef.current) {
            setCameraReady(true);
            return;
        }
        if (!navigator.mediaDevices?.getUserMedia) {
            setCameraError('Camera access is unavailable in this browser.');
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' },
                audio: true,
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
            setCameraReady(true);
        } catch (error) {
            setCameraError(error instanceof Error ? error.message : 'Camera permission was blocked.');
        }
    }, []);

    useEffect(() => {
        if (videoRef.current && streamRef.current) {
            videoRef.current.srcObject = streamRef.current;
        }
    }, [activeLiveBookingId]);

    useEffect(() => () => stopCamera(), [stopCamera]);

    const refreshData = useCallback(async () => {
        if (!user?.id) return;
        setDataLoading(true);
        setDataError(null);
        try {
            const [guides, tours, bookings] = await Promise.all([
                getPublicListingsByType('guide'),
                getPublicListingsByType('tour'),
                providerAccount ? getProviderBookings(user.id) : getBookings(user.id),
            ]);

            const providerListings = providerAccount ? await getMyPosts(user.id) : [];

            setData({
                publicListings: dedupePosts([...guides, ...tours]),
                providerListings,
                touristBookings: providerAccount ? [] : bookings,
                providerBookings: providerAccount ? bookings : [],
            });
        } catch (error) {
            setDataError(error instanceof Error ? error.message : 'Live tours could not be loaded.');
        } finally {
            setDataLoading(false);
        }
    }, [providerAccount, user?.id]);

    useEffect(() => {
        void refreshData();
    }, [refreshData]);

    const virtualListings = useMemo(
        () => data.publicListings.filter(isVirtualTourListing),
        [data.publicListings],
    );
    const providerVirtualListings = useMemo(
        () => data.providerListings.filter(isVirtualTourListing),
        [data.providerListings],
    );
    const providerListingMap = useMemo(() => {
        const map = new Map<string, PostRecord>();
        for (const post of data.providerListings) {
            if (post.id) map.set(post.id, post);
        }
        return map;
    }, [data.providerListings]);
    const providerVirtualListingIds = useMemo(
        () => new Set(providerVirtualListings.map((post) => post.id)),
        [providerVirtualListings],
    );
    const providerVirtualBookings = useMemo(
        () => data.providerBookings.filter((booking) => (
            providerVirtualListingIds.has(booking.listing_id)
            || isVirtualTourBooking(booking, providerListingMap.get(booking.listing_id))
        )),
        [data.providerBookings, providerListingMap, providerVirtualListingIds],
    );
    const touristVirtualBookings = useMemo(
        () => data.touristBookings.filter((booking) => isVirtualTourBooking(booking)),
        [data.touristBookings],
    );
    const allRoomBookings = providerAccount ? providerVirtualBookings : touristVirtualBookings;
    const activeBooking = useMemo(
        () => allRoomBookings.find((booking) => booking.id === activeLiveBookingId) || null,
        [activeLiveBookingId, allRoomBookings],
    );
    const paidProviderRequests = providerVirtualBookings.filter(isPaidBooking);
    const readyProviderRooms = paidProviderRequests.filter(canJoinBooking);
    const readyTouristRooms = touristVirtualBookings.filter(canJoinBooking);

    const acceptBooking = async (booking: UnifiedBooking) => {
        if (!user?.id) return;
        setActionLoadingId(booking.id);
        setActionError(null);
        try {
            const updated = await respondToBookingRequest({
                bookingId: booking.id,
                providerUserId: user.id,
                decision: 'accept',
            });
            setData((current) => ({
                ...current,
                providerBookings: current.providerBookings.map((item) => (
                    item.id === updated.id ? updated : item
                )),
            }));
        } catch (error) {
            setActionError(error instanceof Error ? error.message : 'The booking could not be accepted.');
        } finally {
            setActionLoadingId(null);
        }
    };

    const goLiveForBooking = (booking: UnifiedBooking | null) => {
        setActiveLiveBookingId(booking?.id || 'instant');
        if (providerAccount) void startCamera();
    };

    if (loading || profileLoading) return null;
    if (!user) return <Navigate to="/login" replace />;

    return (
        <main className="vto-page">
            <section className="vto-shell">
                <header className="vto-header">
                    <div>
                        <p className="vto-kicker">Live 360 Virtual Tours</p>
                        <h1>{providerAccount ? 'Guide live requests and rooms' : 'Book paid virtual tour slots'}</h1>
                    </div>
                    <div className="vto-header-actions">
                        <span className="vto-role-chip">{readableRole}</span>
                        {providerAccount ? (
                            <Link className="vto-ghost-btn" to={providerDashboardHref}>
                                {localGuideAccount ? 'Dashboard' : 'Studio'} <ArrowUpRight size={14} />
                            </Link>
                        ) : (
                            <Link className="vto-ghost-btn" to="/explore?tab=guides">
                                Book Slot <ArrowUpRight size={14} />
                            </Link>
                        )}
                    </div>
                </header>

                {dataError && <p className="vto-alert vto-alert--error">{dataError}</p>}
                {actionError && <p className="vto-alert vto-alert--error">{actionError}</p>}

                {activeLiveBookingId && (
                    <LiveRoom
                        booking={activeBooking}
                        providerAccount={providerAccount}
                        cameraReady={cameraReady}
                        cameraError={cameraError}
                        videoRef={videoRef}
                        onStartCamera={startCamera}
                        onStopCamera={stopCamera}
                    />
                )}

                {providerAccount ? (
                    <ProviderLiveTourHub
                        dataLoading={dataLoading}
                        localGuideAccount={localGuideAccount}
                        providerVirtualListings={providerVirtualListings}
                        providerVirtualBookings={providerVirtualBookings}
                        paidRequests={paidProviderRequests}
                        readyRooms={readyProviderRooms}
                        actionLoadingId={actionLoadingId}
                        createHref={providerCreateHref}
                        onAcceptBooking={acceptBooking}
                        onGoLive={goLiveForBooking}
                    />
                ) : (
                    <TouristLiveTourHub
                        dataLoading={dataLoading}
                        virtualListings={virtualListings}
                        touristVirtualBookings={touristVirtualBookings}
                        readyRooms={readyTouristRooms}
                    />
                )}
            </section>
        </main>
    );
};

const LiveRoom: React.FC<{
    booking: UnifiedBooking | null;
    providerAccount: boolean;
    cameraReady: boolean;
    cameraError: string | null;
    videoRef: React.RefObject<HTMLVideoElement | null>;
    onStartCamera: () => void;
    onStopCamera: () => void;
}> = ({ booking, providerAccount, cameraReady, cameraError, videoRef, onStartCamera, onStopCamera }) => (
    <section className="vto-room" aria-label="Live virtual tour room">
        <div className="vto-room-video">
            {providerAccount && (
                <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className={cameraReady ? 'is-live' : ''}
                />
            )}
            {(!providerAccount || !cameraReady) && (
                <div className="vto-room-placeholder">
                    <RadioTower size={26} />
                    <strong>{providerAccount ? 'Camera standby' : 'Room unlocked'}</strong>
                    <span>{providerAccount ? 'Start camera when the tourist joins.' : 'The guide feed appears here when live.'}</span>
                </div>
            )}
        </div>
        <div className="vto-room-panel">
            <p className="vto-panel-kicker">{booking ? formatDateTime(booking.booking_date || booking.created_at) : 'Instant live'}</p>
            <h2>{booking ? titleForBooking(booking) : 'Open virtual room'}</h2>
            {booking && (
                <div className="vto-room-facts">
                    <span>{formatMoney(booking.total_price)}</span>
                    <span>{booking.number_of_people || 1} guest{booking.number_of_people === 1 ? '' : 's'}</span>
                    <span>{booking.payment_status || 'payment pending'}</span>
                </div>
            )}
            {providerAccount ? (
                <div className="vto-room-actions">
                    <button type="button" className="vto-primary-btn" onClick={onStartCamera}>
                        <Video size={16} /> {cameraReady ? 'Camera Live' : 'Start Camera'}
                    </button>
                    {cameraReady && (
                        <button type="button" className="vto-secondary-btn" onClick={onStopCamera}>
                            <XCircle size={16} /> Stop
                        </button>
                    )}
                </div>
            ) : (
                <Link className="vto-primary-btn" to="/messages">
                    <Headphones size={16} /> Open Chat
                </Link>
            )}
            {cameraError && <p className="vto-camera-error">{cameraError}</p>}
        </div>
    </section>
);

const ProviderLiveTourHub: React.FC<{
    dataLoading: boolean;
    localGuideAccount: boolean;
    providerVirtualListings: PostRecord[];
    providerVirtualBookings: UnifiedBooking[];
    paidRequests: UnifiedBooking[];
    readyRooms: UnifiedBooking[];
    actionLoadingId: string | null;
    createHref: string;
    onAcceptBooking: (booking: UnifiedBooking) => void;
    onGoLive: (booking: UnifiedBooking | null) => void;
}> = ({
    dataLoading,
    localGuideAccount,
    providerVirtualListings,
    providerVirtualBookings,
    paidRequests,
    readyRooms,
    actionLoadingId,
    createHref,
    onAcceptBooking,
    onGoLive,
}) => (
    <>
        <section className="vto-metrics" aria-label="Live tour metrics">
            <Metric icon={RadioTower} label="Live listings" value={providerVirtualListings.length} />
            <Metric icon={ClipboardList} label="Paid requests" value={paidRequests.length} />
            <Metric icon={CheckCircle2} label="Ready rooms" value={readyRooms.length} />
        </section>

        <section className="vto-action-band">
            <div>
                <p className="vto-panel-kicker">{localGuideAccount ? 'Local guide console' : 'Provider live console'}</p>
                <h2>360 slots, requests, and camera handoff</h2>
            </div>
            <div className="vto-action-row">
                <button type="button" className="vto-primary-btn" onClick={() => onGoLive(null)}>
                    <RadioTower size={16} /> Instant Live
                </button>
                <Link className="vto-secondary-btn" to={createHref}>
                    <Video size={16} /> {localGuideAccount ? 'Create Live AR/VR Tour' : 'Create Listing'}
                </Link>
            </div>
        </section>

        <section className="vto-list-panel">
            <div className="vto-panel-heading">
                <h2>Paid tourist requests</h2>
                <span>{providerVirtualBookings.length} total</span>
            </div>
            {dataLoading ? (
                <div className="vto-loading"><Loader2 className="animate-spin" size={18} /> Loading requests</div>
            ) : providerVirtualBookings.length > 0 ? (
                <div className="vto-request-list">
                    {providerVirtualBookings.slice(0, 12).map((booking) => {
                        const paid = isPaidBooking(booking);
                        const pending = String(booking.status).toLowerCase() === 'pending';
                        const joinable = canJoinBooking(booking);
                        return (
                            <article key={booking.id} className="vto-request-row">
                                <img src={booking.listing_image || FALLBACK_IMAGE} alt="" />
                                <div>
                                    <strong>{titleForBooking(booking)}</strong>
                                    <span>{formatDateTime(booking.booking_date || booking.created_at)} | {formatMoney(booking.total_price)}</span>
                                </div>
                                <div className="vto-request-status">
                                    <span className={paid ? 'is-paid' : ''}>{paid ? 'Paid' : 'Unpaid'}</span>
                                    <span>{booking.status}</span>
                                </div>
                                <div className="vto-request-actions">
                                    {paid && pending && (
                                        <button
                                            type="button"
                                            className="vto-secondary-btn"
                                            disabled={actionLoadingId === booking.id}
                                            onClick={() => onAcceptBooking(booking)}
                                        >
                                            {actionLoadingId === booking.id ? <Loader2 className="animate-spin" size={15} /> : <CheckCircle2 size={15} />}
                                            Accept
                                        </button>
                                    )}
                                    {joinable && (
                                        <Link className="vto-primary-btn" to={bookingRoomHref(booking)} onClick={() => onGoLive(booking)}>
                                            <RadioTower size={15} /> Go Live
                                        </Link>
                                    )}
                                </div>
                            </article>
                        );
                    })}
                </div>
            ) : (
                <EmptyState
                    title="No virtual requests yet"
                    body={localGuideAccount
                        ? 'Create a Live AR/VR tour so tourists can book paid virtual slots.'
                        : 'Publish an event listing with Live 360 Virtual Tour as the subcategory.'}
                    action={<Link className="vto-primary-btn" to={createHref}>{localGuideAccount ? 'Create Live Tour' : 'Open Studio'}</Link>}
                />
            )}
        </section>
    </>
);

const TouristLiveTourHub: React.FC<{
    dataLoading: boolean;
    virtualListings: PostRecord[];
    touristVirtualBookings: UnifiedBooking[];
    readyRooms: UnifiedBooking[];
}> = ({ dataLoading, virtualListings, touristVirtualBookings, readyRooms }) => (
    <>
        <section className="vto-metrics" aria-label="Live tour metrics">
            <Metric icon={RadioTower} label="Available" value={virtualListings.length} />
            <Metric icon={ClipboardList} label="My slots" value={touristVirtualBookings.length} />
            <Metric icon={CheckCircle2} label="Ready" value={readyRooms.length} />
        </section>

        <section className="vto-list-panel">
            <div className="vto-panel-heading">
                <h2>Book a live slot</h2>
                <span>{virtualListings.length} listings</span>
            </div>
            {dataLoading ? (
                <div className="vto-loading"><Loader2 className="animate-spin" size={18} /> Loading tours</div>
            ) : virtualListings.length > 0 ? (
                <div className="vto-card-grid">
                    {virtualListings.slice(0, 9).map((post) => (
                        <article key={post.id} className="vto-listing-card">
                            <img src={getPrimaryListingImage(post, FALLBACK_IMAGE)} alt="" />
                            <div className="vto-card-body">
                                <div className="vto-card-topline">
                                    <span>Live 360</span>
                                    <strong>{formatListingPrice(post)}</strong>
                                </div>
                                <h3>{titleForPost(post)}</h3>
                                <p>{getText(post.location) || 'Location pending'}</p>
                                <Link className="vto-card-link" to={listingHref(post)}>
                                    Book Slot <ArrowUpRight size={14} />
                                </Link>
                            </div>
                        </article>
                    ))}
                </div>
            ) : (
                <EmptyState
                    title="No live 360 listings yet"
                    body="When local guides publish virtual slots, they will appear here."
                    action={<Link className="vto-primary-btn" to="/explore">Explore listings</Link>}
                />
            )}
        </section>

        <section className="vto-list-panel">
            <div className="vto-panel-heading">
                <h2>My virtual slots</h2>
                <span>{touristVirtualBookings.length} bookings</span>
            </div>
            {touristVirtualBookings.length > 0 ? (
                <div className="vto-request-list">
                    {touristVirtualBookings.slice(0, 8).map((booking) => {
                        const joinable = canJoinBooking(booking);
                        return (
                            <article key={booking.id} className="vto-request-row">
                                <img src={booking.listing_image || FALLBACK_IMAGE} alt="" />
                                <div>
                                    <strong>{titleForBooking(booking)}</strong>
                                    <span>{formatDateTime(booking.booking_date || booking.created_at)} | {formatMoney(booking.total_price)}</span>
                                </div>
                                <div className="vto-request-status">
                                    <span className={isPaidBooking(booking) ? 'is-paid' : ''}>{isPaidBooking(booking) ? 'Paid' : 'Payment due'}</span>
                                    <span>{booking.status}</span>
                                </div>
                                <div className="vto-request-actions">
                                    {joinable ? (
                                        <Link className="vto-primary-btn" to={bookingRoomHref(booking)}>
                                            <RadioTower size={15} /> Join
                                        </Link>
                                    ) : (
                                        <Link className="vto-secondary-btn" to={`/listings/${booking.listing_type === 'guide' ? 'event' : booking.listing_type}/${booking.listing_id}`}>
                                            Details
                                        </Link>
                                    )}
                                </div>
                            </article>
                        );
                    })}
                </div>
            ) : (
                <EmptyState
                    title="No virtual slots booked"
                    body="Book a paid virtual tour slot to unlock the live room."
                    action={<Link className="vto-primary-btn" to="/explore?tab=guides">Browse Events</Link>}
                />
            )}
        </section>
    </>
);

const Metric: React.FC<{
    icon: React.ComponentType<{ size?: number }>;
    label: string;
    value: number;
}> = ({ icon: Icon, label, value }) => (
    <article className="vto-metric">
        <Icon size={18} />
        <span>{label}</span>
        <strong>{value}</strong>
    </article>
);

const EmptyState: React.FC<{
    title: string;
    body: string;
    action: React.ReactNode;
}> = ({ title, body, action }) => (
    <div className="vto-empty">
        <CalendarDays size={24} />
        <strong>{title}</strong>
        <span>{body}</span>
        {action}
    </div>
);
