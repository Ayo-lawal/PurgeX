# PurgeX (Twitter/X Timeline Cleaner)

PurgeX is a personal browser script for targeted cleanup of your own account:
- Unretweets retweets in your timeline.
- Deletes your own quote/attached tweets (quote tweets or embedded retweets).
- Keeps your original tweets untouched.

> WARNING: This is an automation script for personal use only. You are responsible for running it and accepting the risk. Undo is not possible once action is confirmed.

## 🗂️ Repository layout
- `unretweet-delete-quote.js` — main script to execute in your browser console.
- `README.md` — usage guide and behavior notes.
- `.gitignore` — standard ignore file (safe to commit publicly).

## 🎯 Usage (recommended pages)
1. Sign in to Twitter/X in browser.
2. Open your profile page:
   - Posts & retweets: `https://x.com/YOUR_USERNAME`
   - Replies: `https://x.com/YOUR_USERNAME/with_replies`
   - Likes (if enabling unlike in script): `https://x.com/YOUR_USERNAME/likes`
3. Open DevTools console (F12 / Ctrl+Shift+I / Cmd+Option+I).
4. Paste `unretweet-delete-quote.js` content and press Enter.
5. If profile page has many tweets, let script auto-scroll and process until done.
6. Repeat manually for different profile sections if needed.

### 🔎 Important precautions
- Run a dry run first by observing console logs and verifying classification behavior.
- Make sure you are on your own profile page before running.
- Never use the script on someone else’s feed.

## 🛡️ Filtering behavior
- `isOwnTweet`: checks author handle matches your logged-in profile.
- `isRetweet`: checks for `unretweet` button presence.
- `isQuoteOrAttached`: checks for nested tweet cards or quote-text terms in tweet content.

### Action sequence
1. If tweet is retweeted by you → unretweet.
2. If the tweet is your own and quote/attached form → delete.
3. Else → skip.

## 📌 Why this is your own version
This repo is a refactor and feature-focused version based on similar workflow patterns seen in X bulk-clean scripts. It is designed to be:
- safer (avoid unliking everything by default),
- focused on your own quote-style posts,
- easy to verify with logging, and
- configurable for keyword/date range filters if you add those.

## 🔁 Limitations
- X markup can change anytime (selectors can break).
- No built-in undo.
- Requires an active browser session on your profile.
- Large timelines may need long runtime due to scrolling and delays.

## 🧩 Extension ideas
- Add keyword whitelist/blacklist.
- Add date range window (by reading `time[datetime]`).
- Add options in script root configuration variables.
- Add a second mode for “likes/unlike” with explicit opt-in.
