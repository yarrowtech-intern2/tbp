-- Seeds editable About page content into the existing public.app_content table.
-- Apply after docs/marketing-content-role-migration.sql if the marketing content system already exists.

insert into public.app_content (key, value)
values
(
    'about_page',
    '{
        "eyebrow": "About The Better Pass",
        "title": "A smarter travel ecosystem in one living pass.",
        "subtitle": "TBP connects travelers, local partners, verified services, and curated destination stories through one calm discovery and booking layer.",
        "backgroundImages": [
            "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=2200&q=85",
            "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=2200&q=85",
            "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=2200&q=85",
            "https://images.unsplash.com/photo-1470770903676-69b98201ea1c?auto=format&fit=crop&w=2200&q=85"
        ],
        "cards": [
            {
                "id": "story",
                "label": "01",
                "title": "Our Story",
                "shortText": "Built to make travel discovery feel clear, local, and trustworthy.",
                "fullText": [
                    "The Better Pass started from a simple gap: travelers can find places everywhere, but understanding what is verified, nearby, bookable, and genuinely worth their time is still fragmented.",
                    "TBP brings destinations, restaurants, brands, services, and guided experiences into one curated layer so each journey starts with clarity instead of scattered tabs."
                ],
                "cta": { "label": "Start exploring", "href": "/auth" }
            },
            {
                "id": "mission",
                "label": "02",
                "title": "Mission",
                "shortText": "Turn local discovery into a smooth path from inspiration to action.",
                "fullText": [
                    "Our mission is to help travelers move from seeing a place to experiencing it with confidence.",
                    "We combine public content, verified partners, bookings, promotions, and profile-led discovery so travel decisions become faster and more dependable."
                ],
                "cta": { "label": "Explore the platform", "href": "/auth" }
            },
            {
                "id": "travelers",
                "label": "03",
                "title": "Travelers",
                "shortText": "A cleaner way to find places, services, stays, guides, and experiences.",
                "fullText": [
                    "For tourists, TBP is a discovery surface for nearby activities, routes, restaurants, trusted providers, and destination ideas.",
                    "The experience is designed around scanning, saving, booking, chatting, and returning to one profile instead of rebuilding every trip from scratch."
                ],
                "cta": { "label": "Join as traveler", "href": "/auth" }
            },
            {
                "id": "partners",
                "label": "04",
                "title": "Partners",
                "shortText": "A growth channel for guides, brands, restaurants, and service providers.",
                "fullText": [
                    "Partners can bring listings, posts, promotions, and verified services into the same environment where travelers are already planning.",
                    "The platform gives businesses a clearer path to visibility, trust, and conversion without relying only on social feeds or disconnected directories."
                ],
                "cta": { "label": "Become a partner", "href": "/auth" }
            },
            {
                "id": "trust",
                "label": "05",
                "title": "Trust Layer",
                "shortText": "Reviews, moderation, verification, and transparent listing flows.",
                "fullText": [
                    "TBP is built with admin review, provider approval, booking records, and content moderation as part of the product, not an afterthought.",
                    "That structure helps travelers understand what they are choosing and helps partners compete on quality instead of noise."
                ],
                "cta": { "label": "See verified listings", "href": "/auth" }
            },
            {
                "id": "platform",
                "label": "06",
                "title": "Platform",
                "shortText": "Discovery, content, ads, payments, profiles, bookings, and support.",
                "fullText": [
                    "The product is an operating system for travel discovery: public landing content, user dashboards, provider studios, promotions, bookings, messages, and admin controls.",
                    "Each part is designed to support the same loop: discover, trust, book, experience, and come back smarter."
                ],
                "cta": { "label": "Open dashboard", "href": "/auth" }
            },
            {
                "id": "impact",
                "label": "07",
                "title": "Impact",
                "shortText": "20+ restaurants, 12+ brands, 8+ services, and 22+ countries.",
                "fullText": [
                    "The goal is not just more listings. The goal is a better travel graph where local value becomes easier to find and easier to support.",
                    "As the partner network grows, TBP becomes a stronger bridge between destination demand and local businesses."
                ],
                "metric": "62+",
                "cta": { "label": "View ecosystem", "href": "/auth" }
            },
            {
                "id": "future",
                "label": "08",
                "title": "Future",
                "shortText": "Smarter recommendations, richer local networks, and better trip planning.",
                "fullText": [
                    "The next stage of TBP is more intelligent discovery: better location context, richer content, stronger partner tools, and smoother planning from mobile.",
                    "We are building toward a travel layer that feels personal without losing the reliability of a managed platform."
                ],
                "cta": { "label": "Follow the journey", "href": "/auth" }
            }
        ]
    }'::jsonb
)
on conflict (key) do update
set value = excluded.value,
    updated_at = now();
