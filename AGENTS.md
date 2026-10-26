<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- AI chat calls go through the server route `src/routes/api/chat.ts` using the admin-configured URL/key in `app_settings` (fallback secret `WORM_API_KEY`); the key never reaches the browser.
- Admin panel (`/Aobeida`) auth is a password hash in `app_settings` plus an HMAC token signed with `ADMIN_SESSION_SECRET`; every admin server function verifies that token.
- Credits/plan fields on `profiles` are only writable server-side (column-level grants), so users cannot raise their own credits.
- Images and live voice use authenticated server-owned Lovable AI Gateway calls independently of the existing custom text service; private keys never enter the browser.
- Live calls retain the bundled persistent relay and media hook lifecycle so Stop, heartbeat expiry, and navigation release billable sessions.
- Generated images belong to their authenticated owner; AI service denial state is stored server-only to prevent retrying blocked services across restarts.
- The external subscription sales API lives under /api/public/subscriptions, validates an independent server secret and the persisted enable switch before privileged code CRUD; it never returns user data.
- Use the shared LoadingScreen for initial hydration and router pending states so loading branding stays consistent.
- Keep message rendering and client-only chat tools separate from ChatView; local drafts never alter server history, and editing reuses text as a new message.
