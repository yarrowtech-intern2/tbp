# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

## Chatbot Configuration

The project includes an in-app assistant that answers from current Supabase data using rule-based logic.

Do not place OpenAI or other private API keys in `VITE_` variables. Vite exposes `VITE_` values to the browser bundle. If AI mode is added later, route it through a Supabase Edge Function or another server-side proxy.

## Razorpay Booking Setup

Payment is now required before booking for all listing types (tour, activity, event/guide).

### 1) Run database migration

Apply:

```sql
-- run in Supabase SQL editor
\i docs/razorpay-booking-migration.sql
```

If your SQL editor does not support `\i`, copy and run the content from `docs/razorpay-booking-migration.sql`.

### 2) Deploy Supabase Edge Functions

Functions added:

- `create-razorpay-order`
- `confirm-razorpay-booking`
- `process-provider-payout`

Deploy:

```bash
supabase functions deploy create-razorpay-order
supabase functions deploy confirm-razorpay-booking
supabase functions deploy process-provider-payout
```

### 3) Configure Supabase function secrets

Use placeholders first if needed:

```bash
supabase secrets set RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
supabase secrets set RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxx
supabase secrets set PAYOUT_PROCESSOR_SECRET=replace-with-a-long-random-secret
```

`SUPABASE_SERVICE_ROLE_KEY` is required by `confirm-razorpay-booking` and is normally available in Supabase function runtime.
`process-provider-payout` also requires Razorpay Route to be enabled and each provider to have a `provider_payout_onboarding.razorpay_account_id`.

## Email Setup

Registration email is handled by Supabase Auth. In the Supabase dashboard, enable email confirmations under **Authentication > Providers > Email**, then edit the confirmation template under **Authentication > Email Templates**. Keep the app using `supabase.auth.signUp`; the signup flow already stores the user role and profile metadata before Supabase sends the confirmation email.

Booking confirmation email is handled by the `confirm-razorpay-booking` Edge Function after Razorpay signature verification succeeds. The function sends:

- a booking/payment confirmation to the traveler
- a new booking notification to the provider, when the provider profile has an email

Signup welcome email is handled by the `send-signup-email` Edge Function after `supabase.auth.signUp` returns a user. It sends once per auth user and stores `signup_welcome_email_sent_at` in auth app metadata to avoid duplicate welcome emails.

Configure a sending domain in Resend, then set these Supabase function secrets:

```bash
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxxxxxxx
supabase secrets set "EMAIL_FROM=The Better Pass <bookings@your-domain.com>"
supabase secrets set EMAIL_REPLY_TO=support@your-domain.com
supabase secrets set PUBLIC_APP_URL=https://your-frontend-domain.com
```

Redeploy the booking function after setting secrets:

```bash
supabase functions deploy send-signup-email
supabase functions deploy confirm-razorpay-booking
```

Email delivery is non-blocking: if the email provider is not configured or temporarily fails, the booking still completes and the function logs the email failure.

## SEO and AEO Setup

The app includes route-aware SEO metadata in `src/components/SEO.tsx`, static fallback metadata in `index.html`, and crawler assets in `public/robots.txt`, `public/sitemap.xml`, `public/llms.txt`, and `public/site.webmanifest`.

Set the production frontend URL before building:

```env
VITE_PUBLIC_APP_URL=https://thebetterpass.com
```

If the production domain changes, update:

- `VITE_PUBLIC_APP_URL`
- `index.html` canonical/Open Graph URLs
- `public/robots.txt`
- `public/sitemap.xml`
- `public/llms.txt`

Private app surfaces such as auth, dashboards, profiles, messages, admin, and provider studio are marked or blocked as noindex. Public package detail pages receive dynamic title, description, Open Graph image, canonical URL, price/rating schema, and breadcrumb structured data after the listing loads.
