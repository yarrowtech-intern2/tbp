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

The project includes an in-app assistant with two modes:

- `AI + Database` when an OpenAI key is present
- `Rule-Based Database` fallback when no key is available

Set these optional variables in your Vite environment file:

```bash
VITE_OPENAI_API_KEY=your_openai_key
VITE_OPENAI_MODEL=gpt-4.1-mini
```

If `VITE_OPENAI_API_KEY` is missing, the chatbot automatically switches to rule-based answers generated from current Supabase data.

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

Deploy:

```bash
supabase functions deploy create-razorpay-order
supabase functions deploy confirm-razorpay-booking
```

### 3) Configure Supabase function secrets

Use placeholders first if needed:

```bash
supabase secrets set RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
supabase secrets set RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxx
```

`SUPABASE_SERVICE_ROLE_KEY` is required by `confirm-razorpay-booking` and is normally available in Supabase function runtime.
