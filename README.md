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

## Encrypted short workout links (optional)

Large programs can be shared through short, expiring links without adding user
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
