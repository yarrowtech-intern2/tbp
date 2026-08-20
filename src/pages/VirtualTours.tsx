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
import { supabase } from '../lib/supabase';
import { isVirtualTourRecord } from '../lib/virtualTours';
import './virtual-tours.css';

const FALLBACK_IMAGE = '/images/home4/forrest.jpg';
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

const isVirtualTourListing = (post: PostRecord): boolean => {
    return isVirtualTourRecord(post);
};

const isVirtualTourBooking = (booking: UnifiedBooking, listing?: PostRecord): boolean => (
    booking.is_virtual_tour === true
    || Boolean(listing && isVirtualTourListing(listing))
    || ['virtual', '360', 'vr', 'ar'].some((tag) => [booking.listing_title, booking.listing_type].map(getText).filter(Boolean).join(' ').toLowerCase().includes(tag))
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
                        userId={user.id}
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
    userId: string;
}> = ({ booking, providerAccount, userId }) => {
    const localVideoRef = useRef<HTMLVideoElement | null>(null);
    const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const remoteStreamRef = useRef<MediaStream | null>(null);
    const peerRef = useRef<RTCPeerConnection | null>(null);
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
    const [cameraReady, setCameraReady] = useState(false);
    const [remoteReady, setRemoteReady] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [roomStatus, setRoomStatus] = useState('Connecting room');
    const roomId = booking?.id || `instant-${userId}`;

    const sendSignal = useCallback((event: string, payload: Record<string, unknown> = {}) => {
        void channelRef.current?.send({
            type: 'broadcast',
            event,
            payload: {
                ...payload,
                senderId: userId,
                senderRole: providerAccount ? 'guide' : 'tourist',
                roomId,
            },
        });
    }, [providerAccount, roomId, userId]);

    const getPeer = useCallback(() => {
        if (peerRef.current) return peerRef.current;
        const peer = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        });
        peer.onicecandidate = (event) => {
            if (event.candidate) {
                sendSignal('ice-candidate', { candidate: event.candidate.toJSON() });
            }
        };
        peer.ontrack = (event) => {
            const [stream] = event.streams;
            const nextStream = stream || remoteStreamRef.current || new MediaStream();
            if (!stream) nextStream.addTrack(event.track);
            remoteStreamRef.current = nextStream;
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = nextStream;
            }
            setRemoteReady(true);
            setRoomStatus('Guide feed live');
        };
        peer.onconnectionstatechange = () => {
            const state = peer.connectionState;
            if (state === 'connected') setRoomStatus('Connected');
            if (state === 'disconnected') setRoomStatus('Reconnecting');
            if (state === 'failed') setRoomStatus('Connection failed. Rejoin the room.');
        };
        peerRef.current = peer;
        return peer;
    }, [sendSignal]);

    const makeOffer = useCallback(async () => {
        if (!providerAccount || !localStreamRef.current) return;
        const peer = getPeer();
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        sendSignal('offer', { sdp: offer });
        setRoomStatus('Live offer sent');
    }, [getPeer, providerAccount, sendSignal]);

    const stopCamera = useCallback(() => {
        localStreamRef.current?.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
        if (localVideoRef.current) localVideoRef.current.srcObject = null;
        setCameraReady(false);
        setRoomStatus(providerAccount ? 'Camera stopped' : 'Room connected');
        sendSignal('guide-stopped');
    }, [providerAccount, sendSignal]);

    const startCamera = useCallback(async () => {
        setCameraError(null);
        if (!providerAccount) return;
        if (!navigator.mediaDevices?.getUserMedia) {
            setCameraError('Camera access is unavailable in this browser.');
            return;
        }
        if (localStreamRef.current) {
            setCameraReady(true);
            await makeOffer();
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' },
                audio: true,
            });
            localStreamRef.current = stream;
            if (localVideoRef.current) localVideoRef.current.srcObject = stream;
            const peer = getPeer();
            for (const track of stream.getTracks()) {
                peer.addTrack(track, stream);
            }
            setCameraReady(true);
            setRoomStatus('Camera live. Waiting for tourist connection.');
            sendSignal('guide-ready');
            await makeOffer();
        } catch (error) {
            setCameraError(error instanceof Error ? error.message : 'Camera permission was blocked.');
        }
    }, [getPeer, makeOffer, providerAccount, sendSignal]);

    useEffect(() => {
        const channel = supabase.channel(`virtual-tour:${roomId}`);
        channelRef.current = channel;
        channel
            .on('broadcast', { event: 'viewer-ready' }, (message) => {
                const payload = message.payload as { senderId?: string } | null;
                if (payload?.senderId === userId) return;
                if (providerAccount && localStreamRef.current) void makeOffer();
            })
            .on('broadcast', { event: 'guide-ready' }, (message) => {
                const payload = message.payload as { senderId?: string } | null;
                if (payload?.senderId === userId) return;
                if (!providerAccount) setRoomStatus('Guide camera is live. Connecting feed.');
            })
            .on('broadcast', { event: 'guide-stopped' }, (message) => {
                const payload = message.payload as { senderId?: string } | null;
                if (payload?.senderId === userId) return;
                if (!providerAccount) {
                    setRemoteReady(false);
                    setRoomStatus('Guide paused the camera');
                }
            })
            .on('broadcast', { event: 'offer' }, (message) => {
                void (async () => {
                    const payload = message.payload as { senderId?: string; sdp?: RTCSessionDescriptionInit } | null;
                    if (providerAccount || payload?.senderId === userId || !payload?.sdp) return;
                    const peer = getPeer();
                    await peer.setRemoteDescription(new RTCSessionDescription(payload.sdp));
                    const answer = await peer.createAnswer();
                    await peer.setLocalDescription(answer);
                    sendSignal('answer', { sdp: answer });
                    setRoomStatus('Connecting guide feed');
                })();
            })
            .on('broadcast', { event: 'answer' }, (message) => {
                void (async () => {
                    const payload = message.payload as { senderId?: string; sdp?: RTCSessionDescriptionInit } | null;
                    if (!providerAccount || payload?.senderId === userId || !payload?.sdp) return;
                    const peer = getPeer();
                    if (!peer.currentRemoteDescription) {
                        await peer.setRemoteDescription(new RTCSessionDescription(payload.sdp));
                    }
                    setRoomStatus('Tourist connected');
                })();
            })
            .on('broadcast', { event: 'ice-candidate' }, (message) => {
                void (async () => {
                    const payload = message.payload as { senderId?: string; candidate?: RTCIceCandidateInit } | null;
                    if (payload?.senderId === userId || !payload?.candidate) return;
                    try {
                        await getPeer().addIceCandidate(new RTCIceCandidate(payload.candidate));
                    } catch {
                        // ICE can arrive before descriptions settle; the next candidate normally succeeds.
                    }
                })();
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    setRoomStatus(providerAccount ? 'Guide room ready' : 'Waiting for guide camera');
                    sendSignal(providerAccount ? 'guide-room-open' : 'viewer-ready');
                }
            });

        return () => {
            channel.unsubscribe();
            channelRef.current = null;
            peerRef.current?.close();
            peerRef.current = null;
            localStreamRef.current?.getTracks().forEach((track) => track.stop());
            localStreamRef.current = null;
            remoteStreamRef.current = null;
        };
    }, [getPeer, makeOffer, providerAccount, roomId, sendSignal, userId]);

    useEffect(() => {
        if (localVideoRef.current && localStreamRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
        }
        if (remoteVideoRef.current && remoteStreamRef.current) {
            remoteVideoRef.current.srcObject = remoteStreamRef.current;
        }
    }, [roomId]);

    return (
        <section className="vto-room" aria-label="Live virtual tour room">
            <div className="vto-room-video">
                {providerAccount ? (
                    <video
                        ref={localVideoRef}
                        autoPlay
                        muted
                        playsInline
                        className={cameraReady ? 'is-live' : ''}
                    />
                ) : (
                    <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        className={remoteReady ? 'is-live' : ''}
                    />
                )}
                {(providerAccount ? !cameraReady : !remoteReady) && (
                    <div className="vto-room-placeholder">
                        <RadioTower size={26} />
                        <strong>{providerAccount ? 'Camera standby' : 'Room unlocked'}</strong>
                        <span>{providerAccount ? 'Start the phone or 360 camera when the tourist joins.' : 'The guide feed appears here when live.'}</span>
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
                <div className="vto-room-status">
                    <span className={providerAccount && cameraReady || !providerAccount && remoteReady ? 'is-live' : ''} />
                    {roomStatus}
                </div>
                {providerAccount ? (
                    <div className="vto-room-actions">
                        <button type="button" className="vto-primary-btn" onClick={() => void startCamera()}>
                            <Video size={16} /> {cameraReady ? 'Restart Camera' : 'Start Camera'}
                        </button>
                        {cameraReady && (
                            <button type="button" className="vto-secondary-btn" onClick={stopCamera}>
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
};

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
