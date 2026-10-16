# PhD Kickoff Meeting Scheduler

Deployment-ready static scheduling app for **Yassine, Barbara, Amir and Sadok**.

## Meeting window

- Monday 19 October 2026
- Tuesday 20 October 2026
- Wednesday 21 October 2026
- Thursday 22 October 2026
- 30-minute meetings
- Dubai start times: **10:00, 12:00, 13:00, 14:00, 15:00**
- Paris/Brussels time is calculated automatically in the browser.

## What participants do

1. Open one public web link.
2. Choose their own name.
3. Select every available time.
4. Click **Save my choices**.
5. The page shows the overlap across all four participants.

Participants do **not** need a GitHub, Dropbox, SharePoint or Supabase account.

## One-time owner setup

### 1) Create the Supabase project

Create a free Supabase project, then open **SQL Editor** and run `supabase_setup.sql`.

### 2) Copy the browser-safe Supabase credentials

From the Supabase project **Connect** dialog / API Keys settings, copy:

- Project URL
- **Publishable key** (`sb_publishable_...`)

Do **not** use a Supabase secret key in this app.

### 3) Edit `site/config.js`

Replace:

```js
supabaseUrl: "PASTE_SUPABASE_PROJECT_URL_HERE",
supabasePublishableKey: "PASTE_SUPABASE_PUBLISHABLE_KEY_HERE",
```

with your real Project URL and publishable key.

### 4) Enable GitHub Pages

In the repository open:

**Settings → Pages → Build and deployment → Source → GitHub Actions**

The included workflow deploys the site automatically after a push to `main`.

Expected public URL:

`https://ybenachour.github.io/phd-meeting-scheduler/`

## Files

- `site/index.html` — app shell
- `site/styles.css` — UI styles
- `site/app.js` — scheduling and synchronization logic
- `site/config.js` — dates, participants, slots and Supabase public configuration
- `supabase_setup.sql` — table, grants and Row Level Security policies
- `.github/workflows/deploy-pages.yml` — GitHub Pages deployment workflow
- `site/.nojekyll` — serve files as plain static content
- `site/robots.txt` — asks search engines not to index the scheduling page

## Security model

This is a lightweight invite-only scheduling poll. The Supabase publishable key is browser-safe, and Row Level Security limits the table to this poll and these four participant names.

Because the app intentionally uses one shared link without sign-in, anyone who obtains the link can technically choose any of the four names. Do not use this design for sensitive or confidential information.
