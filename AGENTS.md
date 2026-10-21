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
