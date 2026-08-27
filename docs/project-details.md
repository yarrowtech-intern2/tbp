# The Better Pass - Project Details

## Summary

The Better Pass is a travel marketplace and trip-planning platform built to connect travelers with tours, activities, events, tour companies, instructors, tour guides, and local guides. The application supports public discovery, authenticated tourist experiences, provider listing management, admin moderation, marketing content management, bookings, payments, refunds, payouts, route planning, messaging, notifications, and live virtual tour experiences.

The project is implemented as a React, TypeScript, and Vite frontend with Supabase for authentication, database, storage, row-level security, and Edge Functions. Razorpay is used for booking payments, promotional listing boosts, and provider payout workflows. Capacitor support is included for Android packaging.

## Purpose

The main purpose of The Better Pass is to reduce the friction and uncertainty of travel planning. It brings discovery, provider trust signals, booking, payment, communication, and post-booking management into one platform so travelers can make clearer decisions and providers can manage their services in a structured workflow.

## Key Features

- Public landing pages, about pages, terms pages, SEO metadata, sitemap generation, and crawler support.
- Role-based authentication for tourists, tour companies, tour instructors, tour guides, local guides, admins, and marketing users.
- Tourist dashboard for recommended packages, bookings, favorites, route history, spending/revenue view, messages, notifications, and virtual tours.
- Explore page with listing search, category filters, live-tour filters, favorites, listing cards, booking status indicators, and boosted listing visibility.
- Listing detail pages for tours, activities, guides/events, and live virtual tour experiences.
- Provider dashboard and Studio for creating, editing, submitting, and tracking tours, activities, events, and local-guide virtual tours.
- Admin dashboard for provider review, listing moderation, booking/refund monitoring, revenue inspection, audit logs, user/account visibility, and account map views.
- Marketing dashboard for editing public content, greetings, sales/contact settings, and viewing contact leads.
- Razorpay payment-first booking flow with server-side order creation and payment confirmation.
- Provider accept/reject booking workflow, refund request workflow, platform fee accounting, and provider payout support.
- Listing boost and advertisement purchase workflows for providers.
- Messaging, notifications, profile management, avatars, follows, reviews, favorites, and saved route history.
- Supabase RLS policies and audit documentation for role boundaries and production readiness.
- Android app packaging through Capacitor.

## Use Cases

- A tourist discovers trips, filters experiences, saves favorites, books a tour or activity, pays securely, chats with a provider, and tracks booking status.
- A traveler books a paid live AR/VR or 360 virtual tour hosted by a local guide and joins remotely after payment and confirmation.
- A provider creates listings with images, pricing, fee breakdowns, dates, descriptions, and required terms acceptance, then submits them for approval.
- A provider monitors bookings, accepts or rejects requests, tracks revenue, and purchases listing boosts for better visibility.
- An admin approves or rejects provider listings, reviews verification-related data, monitors bookings and refunds, checks platform revenue, and audits moderation activity.
- A marketing user updates public-facing content and contact/sales settings without receiving admin moderation permissions.
- Operations teams use smoke-test checklists, setup inventories, RLS audits, and production readiness notes to validate deployments.

## Target Users

- Tourists and travelers looking for tours, activities, guides, events, and virtual travel experiences.
- Tour companies that need a marketplace channel for curated travel packages.
- Independent tour instructors and tour guides who want to publish guided experiences.
- Local guides offering live virtual tours from real locations.
- Platform admins responsible for moderation, safety, payments, refunds, and revenue oversight.
- Marketing users responsible for public content and lead/contact management.

## Business Goals

- Create a trusted travel marketplace with clear provider and listing approval workflows.
- Increase traveler confidence through structured listings, transparent pricing, reviews, favorites, and messaging.
- Enable providers to monetize tours, activities, events, and live virtual sessions.
- Support platform revenue through booking fees, listing boosts, advertisements, and provider payouts.
- Maintain operational control through admin dashboards, audit logs, role-based access, and security boundaries.

## Technical Scope

- Frontend: React 19, TypeScript, Vite, React Router, CSS modules/pages, Framer Motion, GSAP, Three.js, Leaflet, ECharts, Lucide icons, and Lottie assets.
- Backend services: Supabase Auth, Postgres tables, storage bucket usage, RLS policies, SQL migrations, and Supabase Edge Functions.
- Payments: Razorpay checkout for bookings and promotions, payment confirmation Edge Functions, Route payout fields, and provider payout processing.
- Mobile: Capacitor Android project for native packaging.
- SEO/production: dynamic route metadata, sitemap generation, static SEO generation, robots file, web manifest, and deployment configuration.

## Main Modules

- `src/App.tsx`: Route definitions and role-protected page access.
- `src/pages/RoleDashboard.tsx`: Shared role-aware dashboard for tourist, provider, admin, and marketing users.
- `src/pages/TouristExplorePage.tsx`: Tourist listing discovery and filtering experience.
- `src/pages/ProviderStudio.tsx`: Provider listing creation, editing, image upload, fee breakdown, and virtual-tour submission flow.
- `src/pages/AdminConsole.tsx`: Admin moderation and operational controls.
- `src/lib/destinations.ts`: Core Supabase data access for listings, bookings, reviews, favorites, ads, moderation, and dashboards.
- `src/lib/payments.ts`: Razorpay checkout and payment helper logic.
- `src/lib/platform.ts`: User roles, listing types, statuses, labels, and role permissions.
- `supabase/functions/`: Edge Functions for payments, payouts, ads, account bookings, account deletion, and emails.
- `docs/`: Migration notes, audits, smoke tests, setup inventories, and operational documentation.

## Expected Impact

The Better Pass is intended to become a single operating layer for travel discovery and booking. For travelers, it simplifies planning and payment. For providers, it creates a structured publishing and revenue workflow. For platform operators, it adds moderation, role boundaries, auditability, and payment controls needed to run a marketplace safely.
