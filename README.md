This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Local data and recovery

ForkWorkout is account-free and local-first:

- **IndexedDB is the primary store** for workouts, programs, active sessions,
  history, body data, preferences, and settings.
- An in-memory cache keeps the existing application APIs synchronous after the
  startup hydration gate.
- **LocalStorage is a compatibility and crash-recovery copy.** A per-key
  revision journal lets startup replay only LocalStorage values that are proven
  newer than IndexedDB, such as a completed set saved immediately before the
  phone terminates the PWA.
- Existing LocalStorage installations migrate automatically on first launch.
  IndexedDB failures fall back to LocalStorage without blocking the app.
- **Dashboard → Your data → Storage & recovery** shows the active source, most
  recent durable save, last recorded backup, approximate size, and export or
  restore actions.
- A temporary **migration safety snapshot** may appear in that panel after a
  storage schema upgrade. It is a rollback aid, not a recurring backup, and is
  automatically removed after 30 days.

JSON export remains the portable backup format. Optional Google Drive backup is
described below. Neither local persistence mode requires a ForkWorkout account
or server.

## Google Drive backup (optional)

ForkWorkout is local-first and account-free. The **History → Cloud backup
(Google Drive)** feature lets users back up/restore their data to their own
Google Drive. Everything runs client-side — no ForkWorkout server, no client
secret.

There are two ways it can work:

- **App-wide (recommended, friendliest):** you register one Google OAuth client
  and set `NEXT_PUBLIC_GOOGLE_CLIENT_ID`. Users just click **Back up / Restore**
  and sign in — no per-user setup.
- **Bring-your-own (fallback):** if that env var is unset, power users can paste
  their own OAuth Client ID in the app.

### One-time Google Cloud setup (free — no billing required)

1. In the [Google Cloud Console](https://console.cloud.google.com/), create a
   project.
2. Enable the
   [**Google Drive API**](https://console.cloud.google.com/apis/library/drive.googleapis.com).
3. Open **APIs & Services → Google Auth Platform**:
   - **Branding:** set an app name, support email, your app homepage and a
     privacy policy URL.
   - **Audience:** while in **Testing**, add each Google account under
     **Test users** (up to 100). To open it to everyone, **Publish app** — with
     the `drive.file` scope this needs no paid review, just Google's standard
     (free) verification to drop the "unverified app" warning.
   - **Data access → Add scope:** `.../auth/drive.file`.
4. **Credentials → Create credentials → OAuth client ID → Web application**:
   - **Authorized JavaScript origins:** add your production URL (e.g.
     `https://your-app.vercel.app`) and `http://localhost:3000` for local dev.
   - Copy the generated **Client ID**.
5. Set the env var (locally in `.env.local`, and in Vercel → Project → Settings →
   Environment Variables):

   ```bash
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=1234567890-abc.apps.googleusercontent.com
   ```

   Redeploy. The Cloud backup card now offers one-tap sign-in.

> The Client ID is **public** (it ships in the client bundle) — that's expected
> and safe. Never put an OAuth *client secret* in the app; this flow doesn't use
> one. Costs: the Drive API and OAuth are free for this usage.

## Online food search

The bundled food catalog always works offline. The explicit Search online
action checks Open Food Facts and, when configured, USDA FoodData Central. To
include USDA generic-food results, create a FoodData Central API key and add it
to `.env.local` and your deployment environment:

```bash
USDA_FDC_API_KEY=your_server_side_key
```

Keep this variable server-only. Do not use a `NEXT_PUBLIC_` prefix and do not
commit the key. ForkWorkout sends explicit online food searches through
`/api/nutrition/search` to both providers, then caches only the food selected by
the user locally. Open Food Facts remains available when no USDA key is set.

## AI nutrition features (optional)

The Nutrition page can resize a food photo in the browser, send it through the
server-only `/api/nutrition/analyze-photo` route, and show editable calorie and
macro estimates. The estimate is never saved automatically: the user must
review it and choose **Add** before it becomes a local nutrition entry.
The Meal Ideas sheet can also combine known catalog foods, saved meals, and
recipes around the calories and macros remaining for the selected day. Its
nutrition totals are recalculated from the app's known food data rather than
accepted from model output. Users can tell the model which foods they have,
review ingredients, preparation steps, and time, then save an idea as a recipe
or reusable meal without adding it directly to the current diary.

1. Create a dedicated OpenAI project and API key, then configure a small hard
   monthly project spend limit in the OpenAI dashboard.
2. Connect an Upstash Redis database (the same one used by optional short share
   links is supported) and set its REST URL and token.
3. Copy the AI variables from `.env.example` into `.env.local` and Vercel.
4. Set `AI_FOOD_SCANNER_ENABLED=true` and redeploy. Meal ideas follow this
   setting unless `AI_MEAL_RECOMMENDATIONS_ENABLED` is configured separately.

The defaults allow 20 scans per anonymous installation per day and 20 per IP
per hour, accept prepared images up to 4 MB, and use `gpt-4.1-mini`. All values
are configurable. The OpenAI key and optional project ID are server-only; never
give either variable a `NEXT_PUBLIC_` prefix. Production fails closed when
Redis is unavailable so a serverless deployment cannot silently bypass the
application rate limits. Search, barcode, manual entry, and saved nutrition
continue working when AI scanning is disabled or its budget is exhausted.
Meal ideas default to five generated requests per installation per day and ten
per IP per hour. Locally calculated food and saved-meal matches do not consume
that allowance.

For an owner device, optionally set `AI_SCAN_UNLIMITED_KEY` to a unique random
value of at least 32 characters. Clicking the Nutrition heading reveals the
owner-key field. A successful entry is exchanged for a signed, installation-
bound HttpOnly cookie scoped to the nutrition API; the key is not embedded in
the client bundle or saved in persistent browser storage. Unlock attempts are
limited to five per IP per hour. This bypasses only ForkWorkout's photo-scan and
meal-idea device/IP limits—it never bypasses the OpenAI project billing or spend
limit. Rotate the environment value to invalidate every existing owner cookie.

## Encrypted short share links (optional)

Workouts, programs, and reusable meals can be shared through short, expiring links without adding user
accounts. The browser encrypts the existing compressed share payload, a Next.js
Route Handler stores only the ciphertext in Upstash Redis, and the decryption
key remains in the URL fragment.

1. Connect an **Upstash Redis** database from the Vercel Marketplace.
2. Copy the share variables from `.env.example` into `.env.local` and Vercel.
3. Create an Upstash Developer API key for the monthly usage guard and set the
   database id, account email, and API key variables.
4. Configure an Upstash provider-level monthly budget/free-tier alert.
5. Set `SHARE_SERVICE_ENABLED=true` and redeploy.

The default policy stores links for 30 days, caps compressed content at 256 KiB,
and pauses new links at 80% of the configured monthly command allowance. Reads
remain available so already-shared links have reserved capacity. Setting
`SHARE_SERVICE_ENABLED=false` is the emergency off switch; local workouts and
legacy self-contained links continue to work.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
