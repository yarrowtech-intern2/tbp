import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileText, ShieldCheck } from 'lucide-react';
import './provider-terms.css';

export const ProviderTerms: React.FC = () => (
    <main className="pt-page">
        <div className="container pt-shell">
            <Link to="/dashboard/provider?section=studio" className="pt-back">
                <ArrowLeft size={15} /> Back to Provider Studio
            </Link>

            <header className="pt-header">
                <span className="pt-badge">Provider Compliance</span>
                <h1>Terms & Agreement</h1>
                <p>Review and accept both sections before submitting new tours or packages.</p>
            </header>

            <section id="terms" className="pt-card">
                <h2><FileText size={18} /> Terms and Conditions</h2>
                <ol>
                    <li>You must publish accurate listing information, pricing, and schedule details.</li>
                    <li>All photos, videos, and content must be owned by you or properly licensed.</li>
                    <li>You must honor confirmed bookings except for documented force majeure cases.</li>
                    <li>Fraudulent, misleading, or prohibited activity can lead to suspension.</li>
                    <li>Refunds and cancellations must follow platform booking and payment policy.</li>
                </ol>
            </section>

            <section id="agreement" className="pt-card">
                <h2><ShieldCheck size={18} /> Provider Agreement</h2>
                <ol>
                    <li>You agree to comply with local tourism, safety, and business regulations.</li>
                    <li>You are responsible for licenses, permits, and certifications required for operations.</li>
                    <li>You accept moderation review outcomes and will revise rejected listings when required.</li>
                    <li>You confirm you will provide customer support for booking-related issues.</li>
                    <li>You authorize platform notifications and record-keeping for compliance and operations.</li>
                </ol>
            </section>
        </div>
    </main>
);
