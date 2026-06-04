import React, { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Loader2, Mail, Phone, X } from 'lucide-react';
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

const hasValidPhone = (value: string) => value.replace(/[^\d]/g, '').length >= 5;

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
        if (!hasValidPhone(form.phone)) {
            setSubmitError('Enter a valid phone number with at least 5 digits.');
            return;
        }
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
                className={`h4-contact-modal${submitted ? ' is-success' : ''}`}
                onClick={(event) => event.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="landing-contact-modal-title"
            >
                <button type="button" className="h4-contact-modal-close" onClick={onClose} aria-label="Close contact form">
                    <X size={18} />
                </button>

                <div className="h4-contact-modal-shell">
                    {submitted ? (
                        <div className="h4-contact-modal-success">
                            <span className="h4-contact-success-badge" aria-hidden="true">
                                <CheckCircle2 size={34} />
                            </span>
                            <h2 id="landing-contact-modal-title">thanks for messaging,</h2>
                            <p>we shall get back to you soon</p>
                            <button type="button" className="h4-contact-modal-close-cta" onClick={onClose}>
                                Close
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="h4-contact-modal-copy">
                                <h2 id="landing-contact-modal-title">
                                    <span>CONTACT</span>
                                    <span>US</span>
                                </h2>
                                <p>Tell us your agenda</p>
                            </div>

                            <form className="h4-contact-form" onSubmit={(event) => void handleSubmit(event)}>
                                <div className="h4-form-row">
                                    <label className="h4-form-field">
                                        <span className="h4-form-label sr-only">Name</span>
                                        <input
                                            className="h4-form-input"
                                            type="text"
                                            value={form.name}
                                            onChange={(event) => updateField('name', event.target.value)}
                                            placeholder="Name"
                                            required
                                        />
                                    </label>
                                    <label className="h4-form-field">
                                        <span className="h4-form-label sr-only">Location</span>
                                        <input
                                            className="h4-form-input"
                                            type="text"
                                            value={form.location}
                                            onChange={(event) => updateField('location', event.target.value)}
                                            placeholder="Location"
                                            required
                                        />
                                    </label>
                                </div>

                                <div className="h4-form-row">
                                    <label className="h4-form-field">
                                        <span className="h4-form-label sr-only">Phone</span>
                                        <input
                                            className="h4-form-input"
                                            type="tel"
                                            value={form.phone}
                                            onChange={(event) => updateField('phone', event.target.value)}
                                            placeholder="Phone"
                                            inputMode="tel"
                                            minLength={5}
                                            required
                                        />
                                    </label>
                                    <label className="h4-form-field">
                                        <span className="h4-form-label sr-only">Email</span>
                                        <input
                                            className="h4-form-input"
                                            type="email"
                                            value={form.email}
                                            onChange={(event) => updateField('email', event.target.value)}
                                            placeholder="Email"
                                            required
                                        />
                                    </label>
                                </div>

                                <div className="h4-form-submit-row">
                                    <label className="h4-form-field h4-form-field-message">
                                        <span className="h4-form-label sr-only">Message</span>
                                        <textarea
                                            className="h4-form-input h4-form-textarea h4-form-textarea-compact"
                                            value={form.message}
                                            onChange={(event) => updateField('message', event.target.value)}
                                            placeholder="Message"
                                            required
                                        />
                                    </label>

                                    <button type="submit" className="h4-form-submit h4-form-submit-icon" disabled={submitting} aria-label="Send request">
                                        {submitting ? <Loader2 size={20} className="animate-spin" /> : <ArrowRight size={24} />}
                                    </button>
                                </div>

                                {submitError && <p className="h4-form-error">{submitError}</p>}
                            </form>

                            <div className="h4-contact-modal-actions">
                                {contactDetails.email && (
                                    <a
                                        className="h4-contact-action"
                                        href={contactDetails.email.href || undefined}
                                        aria-label={`Email ${contactDetails.email.label}`}
                                        title={contactDetails.email.label}
                                    >
                                        <Mail size={18} />
                                    </a>
                                )}
                                {contactDetails.phone && (
                                    <a
                                        className="h4-contact-action"
                                        href={contactDetails.phone.href || undefined}
                                        aria-label={`Call ${contactDetails.phone.label}`}
                                        title={contactDetails.phone.label}
                                    >
                                        <Phone size={18} />
                                    </a>
                                )}
                            </div>

                            <div className="h4-contact-modal-meta" aria-hidden="true">
                                {contactDetails.email ? <span>{contactDetails.email.label}</span> : null}
                                {contactDetails.phone ? <span>{contactDetails.phone.label}</span> : null}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
