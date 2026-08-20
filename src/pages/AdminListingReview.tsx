import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, CheckSquare, Loader2, Square, XCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import {
    getLatestVerification,
    getListingById,
    getUserProfileById,
    reviewListing,
    type PostRecord,
    type Profile,
    type VerificationRecord,
} from '../lib/destinations';
import { getRoleLabel } from '../lib/platform';
import { CAMERA_TYPE_LABELS, getVirtualTourDetailsFromRecord, isVirtualTourRecord } from '../lib/virtualTours';
import { FeeBreakdownView } from '../components/FeeBreakdownView';
import './admin-listing-review.css';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizeUuid = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed || !UUID_REGEX.test(trimmed)) return null;
    return trimmed;
};

const toListingPathType = (type: unknown): 'tour' | 'activity' | 'event' => {
    if (type === 'tour') return 'tour';
    if (type === 'guide' || type === 'event') return 'event';
    return 'activity';
};

const formatDate = (value?: string | null) => {
    if (!value) return 'N/A';
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return 'N/A';
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatCurrency = (value?: number | null) => {
    if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) return 'N/A';
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(value);
};

const CHECKLIST = [
    'Title is clear and descriptive',
    'Photos are relevant and high quality',
    'Description has complete itinerary details',
    'Pricing and inclusions are clear',
    'Provider profile and role are verified',
    'License / certificate evidence checked',
    'Location and schedule information are valid',
];

type ReviewFeedback = {
    variant: 'approved' | 'declined' | 'error';
    title: string;
    message: string;
};

export const AdminListingReview: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [feedback, setFeedback] = useState<ReviewFeedback | null>(null);
    const [listing, setListing] = useState<PostRecord | null>(null);
    const [providerProfile, setProviderProfile] = useState<Profile | null>(null);
    const [verification, setVerification] = useState<VerificationRecord | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [checklistState, setChecklistState] = useState<boolean[]>(() => CHECKLIST.map(() => false));

    useEffect(() => {
        if (!id) return;
        let cancelled = false;

        const load = async () => {
            setLoading(true);
            setFeedback(null);
            try {
                const listingRow = await getListingById(id);
                if (!listingRow) throw new Error('Listing not found.');
                if (cancelled) return;
                setListing(listingRow);

                const providerId = normalizeUuid(listingRow.provider_user_id) || normalizeUuid(listingRow.user_id);
                if (!providerId) {
                    setProviderProfile(null);
                    setVerification(null);
                    return;
                }

                const [profileRow, verificationRow] = await Promise.all([
                    getUserProfileById(providerId),
                    getLatestVerification(providerId),
                ]);
                if (cancelled) return;
                setProviderProfile(profileRow);
                setVerification(verificationRow);
            } catch (err: unknown) {
                if (cancelled) return;
                setFeedback({
                    variant: 'error',
                    title: 'Could not load listing',
                    message: err instanceof Error ? err.message : 'Could not load listing review details.',
                });
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        void load();
        return () => {
            cancelled = true;
        };
    }, [id]);

    const listingTitle = listing?.title || listing?.name || 'Untitled listing';
    const listingType = String(listing?.type || 'listing');
    const listingTypePath = toListingPathType(listing?.type);
    const listingImage = listing?.image_url || listing?.cover_image_url || listing?.thumbnail_url || '';
    const isVirtualTour = isVirtualTourRecord(listing as Record<string, unknown> | null);
    const virtualDetails = getVirtualTourDetailsFromRecord(listing as Record<string, unknown> | null);

    const providerAccountType = useMemo(() => {
        const role = verification?.role || providerProfile?.role;
        return role ? getRoleLabel(role) : 'Unknown';
    }, [providerProfile?.role, verification?.role]);

    const providerName = providerProfile?.full_name || verification?.profiles?.full_name || 'Unknown provider';
    const providerEmail = providerProfile?.email || 'N/A';
    const providerPhone = providerProfile?.phone || 'N/A';
    const companyName = verification?.company_name || providerProfile?.company_name || 'Independent';
    const worksUnderCompany = verification?.works_under_company ?? providerProfile?.works_under_company;
    const licenseNumber = verification?.license_number || providerProfile?.guide_license_number || 'Not provided';
    const certificateId = verification?.certificate_id || providerProfile?.certificate_id || 'Not provided';
    const governmentId = verification?.government_id_ref || providerProfile?.government_id_ref || 'Not provided';
    const yearsExperience = verification?.years_experience ?? providerProfile?.years_experience;
    const website = verification?.website || providerProfile?.website || 'N/A';

    const toggleChecklist = (index: number) => {
        setChecklistState((current) => current.map((item, idx) => (idx === index ? !item : item)));
    };

    const handleReviewDecision = async (decision: 'live' | 'rejected') => {
        if (!listing?.id || !user?.id || saving) return;

        setSaving(true);
        setFeedback(null);
        try {
            const updated = await reviewListing(listing.id, decision, {
                reviewerId: user.id,
                reason: decision === 'rejected' ? rejectReason.trim() || undefined : undefined,
            });
            if (updated) setListing(updated);
            setFeedback({
                variant: decision === 'live' ? 'approved' : 'declined',
                title: decision === 'live' ? 'Listing approved' : 'Listing declined',
                message: decision === 'live'
                    ? 'The listing was approved and published.'
                    : 'The listing was rejected and the provider can revise it.',
            });
        } catch (err: unknown) {
            setFeedback({
                variant: 'error',
                title: decision === 'live' ? 'Approval failed' : 'Decline failed',
                message: err instanceof Error ? err.message : 'Review action failed.',
            });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <main className="alr-page">
                <div className="container alr-shell alr-loading">
                    <Loader2 className="animate-spin" size={32} />
                </div>
            </main>
        );
    }

    if (!listing) {
        return (
            <main className="alr-page">
                <div className="container alr-shell">
                    <p>Listing not found.</p>
                </div>
            </main>
        );
    }

    return (
        <main className="alr-page">
            <div className="container alr-shell">
                <button type="button" className="alr-back" onClick={() => navigate('/dashboard/admin?section=moderation')}>
                    <ArrowLeft size={16} /> Back to Moderation
                </button>

                {feedback && (
                    <div className="alr-feedback-backdrop" role="presentation">
                        <section
                            className={`alr-feedback-card alr-feedback-card--${feedback.variant}`}
                            role="status"
                            aria-live="polite"
                        >
                            <div className="alr-feedback-icon" aria-hidden="true">
                                {feedback.variant === 'approved' ? <CheckCircle2 size={38} /> : <XCircle size={38} />}
                            </div>
                            <div className="alr-feedback-copy">
                                <h2>{feedback.title}</h2>
                                <p>{feedback.message}</p>
                            </div>
                            <button type="button" className="alr-feedback-close" onClick={() => setFeedback(null)}>
                                Close
                            </button>
                        </section>
                    </div>
                )}

                <section className="alr-layout">
                    <aside className="alr-checklist">
                        <h2>Checklist</h2>
                        <div className="alr-checklist-list">
                            {CHECKLIST.map((item, index) => (
                                <button key={item} type="button" className="alr-check-item" onClick={() => toggleChecklist(index)}>
                                    {checklistState[index] ? <CheckSquare size={16} /> : <Square size={16} />}
                                    <span>{item}</span>
                                </button>
                            ))}
                        </div>
                    </aside>

                    <article className="alr-detail">
                        <h2>{isVirtualTour ? 'Live virtual tour details' : 'Tour package details'}</h2>

                        <div className="alr-hero">
                            <div className="alr-image" style={listingImage ? { backgroundImage: `url(${listingImage})` } : undefined} />
                            <div className="alr-hero-copy">
                                <h3>{listingTitle}</h3>
                                <p>{listing.description || 'No description provided.'}</p>
                                <div className="alr-quick-meta">
                                    <span>Status: <strong>{listing.status || 'pending'}</strong></span>
                                    <span>Type: <strong>{listingType}</strong></span>
                                    <span>Location: <strong>{listing.location || 'N/A'}</strong></span>
                                    <span>Price: <strong>{formatCurrency(listing.price)}</strong></span>
                                    <span>Start: <strong>{formatDate(listing.starts_at)}</strong></span>
                                    <span>Created: <strong>{formatDate(listing.created_at)}</strong></span>
                                </div>
                                <Link to={`/listings/${listingTypePath}/${listing.id}`} className="alr-view-link">
                                    Open Public Listing
                                </Link>
                            </div>
                        </div>

                        <div className="alr-provider-grid">
                            <div><span>Provider Name</span><strong>{providerName}</strong></div>
                            <div><span>Account Type</span><strong>{providerAccountType}</strong></div>
                            <div><span>Company Name</span><strong>{companyName}</strong></div>
                            <div><span>Works Under Company</span><strong>{worksUnderCompany ? 'Yes' : 'No'}</strong></div>
                            <div><span>Email</span><strong>{providerEmail}</strong></div>
                            <div><span>Phone</span><strong>{providerPhone}</strong></div>
                            <div><span>Website</span><strong>{website}</strong></div>
                            <div><span>Years Experience</span><strong>{typeof yearsExperience === 'number' ? yearsExperience : 'N/A'}</strong></div>
                            <div><span>License Number</span><strong>{licenseNumber}</strong></div>
                            <div><span>Certificate ID</span><strong>{certificateId}</strong></div>
                            <div><span>Government ID Ref</span><strong>{governmentId}</strong></div>
                            <div><span>Verification Status</span><strong>{verification?.status || providerProfile?.verification_status || 'N/A'}</strong></div>
                        </div>

                        {isVirtualTour && virtualDetails && (
                            <section className="alr-virtual-panel">
                                <div className="alr-virtual-head">
                                    <div>
                                        <span>Local guide live proof</span>
                                        <h3>{virtualDetails.duration_minutes} min virtual slot</h3>
                                    </div>
                                    <strong>{CAMERA_TYPE_LABELS[virtualDetails.camera_type]}</strong>
                                </div>
                                <div className="alr-provider-grid">
                                    <div><span>Live Spot</span><strong>{virtualDetails.spot_location || listing.location || 'N/A'}</strong></div>
                                    <div><span>Meeting Point</span><strong>{virtualDetails.meeting_point || 'N/A'}</strong></div>
                                    <div><span>Max Guests</span><strong>{virtualDetails.max_guests}</strong></div>
                                    <div><span>Languages</span><strong>{virtualDetails.languages.join(', ') || 'N/A'}</strong></div>
                                    <div><span>Timing Windows</span><strong>{virtualDetails.available_windows.join(', ') || 'N/A'}</strong></div>
                                    <div><span>Network Plan</span><strong>{virtualDetails.network_plan || 'N/A'}</strong></div>
                                </div>
                                <div className="alr-virtual-list-grid">
                                    <div>
                                        <span>Places shown</span>
                                        <p>{virtualDetails.places_shown.join(', ') || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <span>Included</span>
                                        <p>{virtualDetails.included_items.join(', ') || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <span>Camera setup</span>
                                        <p>{virtualDetails.camera_notes || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <span>Tourist requirements</span>
                                        <p>{virtualDetails.tourist_requirements || 'N/A'}</p>
                                    </div>
                                </div>
                                {virtualDetails.verification_photo_urls.length > 0 && (
                                    <div className="alr-proof-grid">
                                        {virtualDetails.verification_photo_urls.map((url) => (
                                            <a key={url} href={url} target="_blank" rel="noreferrer">
                                                <img src={url} alt="Virtual tour proof" />
                                            </a>
                                        ))}
                                    </div>
                                )}
                                {virtualDetails.verification_video_url && (
                                    <video className="alr-proof-video" src={virtualDetails.verification_video_url} controls />
                                )}
                                {virtualDetails.proof_notes && (
                                    <p className="alr-proof-note">{virtualDetails.proof_notes}</p>
                                )}
                            </section>
                        )}

                        <FeeBreakdownView
                            feeBreakdown={listing.fee_breakdown}
                            title="Fee breakdown"
                            className="alr-fee-breakdown"
                        />

                        <label className="alr-reject-reason">
                            <span>Reject Reason</span>
                            <textarea
                                value={rejectReason}
                                onChange={(event) => setRejectReason(event.target.value)}
                                placeholder="Explain what should be fixed before approval."
                                rows={3}
                            />
                        </label>

                        <div className="alr-actions">
                            <button type="button" className="alr-btn alr-btn-approve" disabled={saving} onClick={() => void handleReviewDecision('live')}>
                                {saving ? 'Updating...' : 'Approve'}
                            </button>
                            <button type="button" className="alr-btn alr-btn-reject" disabled={saving} onClick={() => void handleReviewDecision('rejected')}>
                                {saving ? 'Updating...' : 'Reject'}
                            </button>
                        </div>
                    </article>
                </section>
            </div>
        </main>
    );
};
