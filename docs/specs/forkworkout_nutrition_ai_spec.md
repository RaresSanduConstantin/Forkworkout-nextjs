# ForkWorkout — AI Food Photo Analysis

## Goal
Add an optional nutrition feature to ForkWorkout that lets a user take/upload a food photo and receive an estimated nutrition breakdown without requiring a ForkWorkout account or login.

The feature must protect the OpenAI API key and prevent uncontrolled API spending.

## Recommended Architecture

```text
ForkWorkout PWA
    |
    | photo + optional known weight
    v
POST /api/nutrition/analyze-photo
    |
    | server-side only
    v
OpenAI API
    |
    v
Structured nutrition JSON
    |
    v
ForkWorkout -> user confirms/edits -> IndexedDB
```

### Important security rule
Never expose the OpenAI API key in browser/PWA code.

Store `OPENAI_API_KEY` only as a server-side environment variable, for example in Vercel or the backend hosting provider. The browser must call ForkWorkout's own API endpoint, and that endpoint calls OpenAI.

## No-login abuse protection
Because ForkWorkout has no accounts, protect the endpoint with several layers:

1. Rate limit requests by IP.
2. Generate an anonymous installation/device ID and store it in IndexedDB; also rate limit by this ID.
3. Add bot protection such as Cloudflare Turnstile if practical.
4. Reject unsupported files and enforce a maximum image size.
5. Resize/compress images before upload where possible.
6. Use a dedicated OpenAI project/API key only for ForkWorkout.

Suggested initial limits:

```text
20 AI scans per anonymous device per day
20 AI scans per IP per hour
Maximum image size: 4 MB
```

These values should be configurable through environment variables.

## Spending protection
Create a dedicated OpenAI project named something like `ForkWorkout` and configure a monthly **hard spend limit** for it.

Suggested initial limit:

```text
$2-$5 per month
```

If the OpenAI project reaches its hard spend limit, further API requests should fail. ForkWorkout must catch this condition and gracefully disable only the AI photo-analysis feature.

The rest of the nutrition feature must continue to work:

- food search
- barcode scanning
- manual nutrition entry
- previously stored IndexedDB data

Example frontend state:

```json
{
  "aiFoodScannerEnabled": false,
  "reason": "monthly_budget_reached"
}
```

Display a message such as:

> AI food scanning has reached this month's usage limit. You can still search foods, scan barcodes, or add nutrition manually.

## Optional spend monitoring
OpenAI also provides an organization Costs API (`GET /organization/costs`).

Do not call the Costs API before every food scan. If proactive budget status is needed, check it server-side on a schedule or cache the result for roughly 30-60 minutes.

The Costs API requires organization/admin-level authorization, so its credential must also remain server-side and should be kept separate from the normal ForkWorkout inference key where possible.

The OpenAI hard spend limit should remain the final financial safety net even if application-level spend monitoring is implemented.

## Photo Analysis API

Create:

```text
POST /api/nutrition/analyze-photo
```

Input:

```text
image: required
weightGrams: optional
anonymousDeviceId: required
```

If the user knows the food weight, send it because this should improve portion and macro estimates.

Return structured JSON similar to:

```json
{
  "foods": [
    {
      "name": "Grilled chicken breast",
      "estimatedWeightGrams": 180,
      "calories": 297,
      "protein": 55.8,
      "carbs": 0,
      "fat": 6.4,
      "confidence": 0.88
    }
  ],
  "total": {
    "calories": 297,
    "protein": 55.8,
    "carbs": 0,
    "fat": 6.4
  },
  "confidence": "high"
}
```

The response should always be validated server-side before returning it to the PWA.

## UX

Nutrition should support multiple ways to add food:

```text
Add food

[ Take Photo ]   -> OpenAI photo analysis
[ Scan Barcode ] -> OpenFoodFacts / barcode database
[ Search Food ]  -> food database
[ Manual Entry ] -> local/manual values
```

After photo analysis, never automatically save the AI estimate as final nutrition data. Show the result to the user first and allow them to adjust:

- food name
- serving/weight
- calories
- protein
- carbohydrates
- fat

Then provide an `Add to today` action that saves the confirmed values to IndexedDB.

## Failure handling

The API endpoint should return predictable application errors, for example:

```json
{ "error": "RATE_LIMITED" }
{ "error": "MONTHLY_BUDGET_REACHED" }
{ "error": "INVALID_IMAGE" }
{ "error": "AI_ANALYSIS_FAILED" }
```

The UI should handle each case without breaking the Nutrition page.

## Environment Variables

Suggested configuration:

```env
OPENAI_API_KEY=
OPENAI_PROJECT_ID=
AI_SCAN_DAILY_DEVICE_LIMIT=20
AI_SCAN_HOURLY_IP_LIMIT=20
AI_MAX_IMAGE_SIZE_MB=4
AI_FOOD_SCANNER_ENABLED=true
```

If using the Costs API, use a separate server-side admin credential rather than exposing or reusing it in client code.

## Key implementation principle

ForkWorkout is local-first and does not require accounts. Keep it that way.

The server exists only as a secure proxy for AI operations and abuse/budget controls. Nutrition history and confirmed food entries should continue to live locally in IndexedDB unless the architecture is intentionally changed later.
