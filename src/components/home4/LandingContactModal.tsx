import React, { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Mail, MapPin, Phone, X } from 'lucide-react';
import {
    getFooterContactDetails,
    type FooterContent,
} from '../../lib/appContent';
import { submitContactSubmission } from '../../lib/contactSubmissions';

type LandingContactModalProps = {
    footerContent: FooterContent;
    open: boolean;
    onClose: () => void;
};

type ContactFormState = {
    name: string;
    email: string;
    phone: string;
    location: string;
    message: string;
};

const INITIAL_FORM: ContactFormState = {
    name: '',
    email: '',
    phone: '',
    location: '',
    message: '',
};

export const LandingContactModal: React.FC<LandingContactModalProps> = ({ footerContent, open, onClose }) => {
    const [form, setForm] = useState<ContactFormState>(INITIAL_FORM);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [submitted, setSubmitted] = useState(false);
    const contactDetails = getFooterContactDetails(footerContent);

    useEffect(() => {
        if (!open) return;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };

        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [onClose, open]);

    useEffect(() => {
        if (!open) return;
        setSubmitError(null);
        setSubmitted(false);
    }, [open]);

    if (!open) return null;

    const updateField = (field: keyof ContactFormState, value: string) => {
        setForm((current) => ({ ...current, [field]: value }));
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setSubmitting(true);
        setSubmitError(null);
        try {
            await submitContactSubmission({
                ...form,
                sourcePage: 'landing_page',
            });
            setSubmitted(true);
            setForm(INITIAL_FORM);
        } catch (error) {
            setSubmitError(error instanceof Error ? error.message : 'Failed to submit contact form.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="h4-contact-modal-backdrop" onClick={onClose} role="presentation">
            <div
                className="h4-contact-modal"
                onClick={(event) => event.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="landing-contact-modal-title"
            >
                <button type="button" className="h4-contact-modal-close" onClick={onClose} aria-label="Close contact form">
                    <X size={18} />
                </button>

                <div className="h4-contact-modal-grid">
                    <div className="h4-contact-modal-copy">
                        <span className="h4-contact-modal-kicker">Contact</span>
                        <h2 id="landing-contact-modal-title">Tell us where you want to go next.</h2>
                        <p>
                            Send your details and the team can review your request from the dashboard.
                            The company contact details below are pulled from the marketing-managed footer settings.
                        </p>

                        <div className="h4-contact-details">
                            {contactDetails.email && (
                                <a className="h4-contact-detail-card" href={contactDetails.email.href || undefined}>
                                    <span className="h4-contact-detail-icon"><Mail size={16} /></span>
                                    <span className="h4-contact-detail-content">
                                        <span className="h4-contact-detail-label">Company Email</span>
                                        <span className="h4-contact-detail-value">{contactDetails.email.label}</span>
                                    </span>
                                </a>
                            )}
                            {contactDetails.phone && (
                                <a className="h4-contact-detail-card" href={contactDetails.phone.href || undefined}>
                                    <span className="h4-contact-detail-icon"><Phone size={16} /></span>
                                    <span className="h4-contact-detail-content">
                                        <span className="h4-contact-detail-label">Contact Number</span>
                                        <span className="h4-contact-detail-value">{contactDetails.phone.label}</span>
                                    </span>
                                </a>
                            )}
                        </div>
                    </div>

                    <div className="h4-contact-modal-form-wrap">
                        {submitted ? (
                            <div className="h4-contact-modal-success">
                                <CheckCircle2 size={28} />
                                <h3>Submission received</h3>
                                <p>Your contact request is now stored in Supabase for admin and marketing review.</p>
                                <button type="button" className="h4-form-submit" onClick={onClose}>
                                    Close
                                </button>
                            </div>
                        ) : (
                            <form className="h4-contact-form" onSubmit={(event) => void handleSubmit(event)}>
                                <div className="h4-form-row">
                                    <label className="h4-form-field">
                                        <span className="h4-form-label">Name</span>
                                        <input
                                            className="h4-form-input"
                                            type="text"
                                            value={form.name}
                                            onChange={(event) => updateField('name', event.target.value)}
                                            placeholder="Your full name"
                                            required
                                        />
                                    </label>
                                    <label className="h4-form-field">
                                        <span className="h4-form-label">Email</span>
                                        <input
                                            className="h4-form-input"
                                            type="email"
                                            value={form.email}
                                            onChange={(event) => updateField('email', event.target.value)}
                                            placeholder="you@example.com"
                                            required
                                        />
                                    </label>
                                </div>

                                <div className="h4-form-row">
                                    <label className="h4-form-field">
                                        <span className="h4-form-label">Phone</span>
                                        <input
                                            className="h4-form-input"
                                            type="tel"
                                            value={form.phone}
                                            onChange={(event) => updateField('phone', event.target.value)}
                                            placeholder="+91 98765 43210"
                                            required
                                        />
                                    </label>
                                    <label className="h4-form-field">
                                        <span className="h4-form-label">Location</span>
                                        <div className="h4-form-input-wrap">
                                            <span className="h4-form-input-icon"><MapPin size={16} /></span>
                                            <input
                                                className="h4-form-input h4-form-input-with-icon"
                                                type="text"
                                                value={form.location}
                                                onChange={(event) => updateField('location', event.target.value)}
                                                placeholder="City, state, or country"
                                                required
                                            />
                                        </div>
                                    </label>
                                </div>

                                <label className="h4-form-field">
                                    <span className="h4-form-label">Message</span>
                                    <textarea
                                        className="h4-form-input h4-form-textarea"
                                        value={form.message}
                                        onChange={(event) => updateField('message', event.target.value)}
                                        placeholder="Tell us what kind of trip or help you need"
                                        required
                                    />
                                </label>

                                {submitError && <p className="h4-form-error">{submitError}</p>}

                                <button type="submit" className="h4-form-submit" disabled={submitting}>
                                    {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
                                    {submitting ? 'Submitting...' : 'Send Request'}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
