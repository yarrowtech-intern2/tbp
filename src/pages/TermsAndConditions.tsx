import { Link } from 'react-router-dom';
import './terms-and-conditions.css';

const sections = [
    {
        title: 'Using The Better Pass',
        body: 'The Better Pass helps tourists discover, save, and book travel listings while allowing verified providers to publish tours, activities, and events. You agree to use the platform only for lawful travel planning, bookings, and provider management.',
    },
    {
        title: 'Accounts',
        body: 'You are responsible for the accuracy of the information you provide during sign up and for keeping your login credentials secure. Provider accounts may require verification before listings can be published or promoted.',
    },
    {
        title: 'Bookings and Payments',
        body: 'Bookings depend on listing availability, provider acceptance where applicable, and successful payment processing. Prices, schedules, cancellation rules, and included services are controlled by the listing details shown before checkout.',
    },
    {
        title: 'Provider Content',
        body: 'Providers are responsible for keeping listing descriptions, images, prices, schedules, safety details, and contact information accurate. The Better Pass may review, reject, remove, or request edits for listings that appear incomplete, misleading, unsafe, or non-compliant.',
    },
    {
        title: 'Traveler Conduct',
        body: 'Travelers must provide accurate booking details, respect provider policies, and avoid abusive, fraudulent, or disruptive activity. Messaging is intended for trip coordination and support related to confirmed or relevant bookings.',
    },
    {
        title: 'Saved Data and Communications',
        body: 'We may store profile details, favorites, bookings, notifications, conversations, and moderation records needed to operate the platform. Account data is used to support discovery, booking management, verification, and customer communication.',
    },
    {
        title: 'Changes to These Terms',
        body: 'We may update these terms as the platform evolves. Continued use of The Better Pass after updates means you accept the revised terms.',
    },
];

export const TermsAndConditions: React.FC = () => (
    <main className="terms-page">
        <header className="terms-header">
            <Link to="/" className="terms-logo" aria-label="The Better Pass home">
                <img src="/logo/logo.png" alt="The Better Pass" />
            </Link>
        </header>

        <article className="terms-document">
            <p className="terms-kicker">The Better Pass</p>
            <h1>Terms and Conditions</h1>
            <p className="terms-updated">Last updated: May 8, 2026</p>

            <p className="terms-intro">
                These terms explain the basic rules for using The Better Pass. Please read them before creating an account,
                booking a travel experience, or publishing provider listings.
            </p>

            <div className="terms-list">
                {sections.map((section) => (
                    <section key={section.title} className="terms-section">
                        <h2>{section.title}</h2>
                        <p>{section.body}</p>
                    </section>
                ))}
            </div>

            <footer className="terms-footer">
                <Link to="/auth" className="terms-return-link">Return to login</Link>
            </footer>
        </article>
    </main>
);
