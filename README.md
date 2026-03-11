# PurgeX (Twitter/X Timeline Cleaner)

A small script to help you clean your Twitter/X timeline with a targeted approach:
- Unretweet tweets you have retweeted
- Delete your own quote/attached tweets (quote tweets or embedded retweets)
- Preserve original personal tweets

> WARNING: This is automation script for personal use only. Use carefully. You run it in your browser console at your own risk.

## 🗂️ Structure
- `unretweet-delete-quote.js` — main browser script
- `README.md` — this file
- `.gitignore` — ignored files

## 🚀 Usage
1. Sign in to Twitter/X and open your timeline.
2. Open DevTools (F12/Ctrl+Shift+I).
3. Paste the content of `unretweet-delete-quote.js` into the Console.
4. Press Enter.

### Dry run recommendation
Modify `processTweet` logging only:
- Keep `console.log` statements
- Run first to verify classification
- Ensure the script is not deleting anything you did not intend

## 🛡️ How it selects tweets
- `isOwnTweet`: If author handle equals your logged in handle.
- `isRetweet`: If the tweet has an “unretweet” button.
- `isQuoteOrAttached`: If tweet has nested `article[data-testid="tweet"]` or includes phrase "quote tweet"/"quoted tweet".

Action logic:
1. Retweets → unretweet
2. Own quote/attached → delete
3. All others → no action

## 🔁 Limitations
- Twitter/X may change markup; selectors may break.
- No retries for failed click actions.
- Only processes currently visible timeline tweets and loads more by scrolling.

## 🧩 Optional improvements
- Add keyword filters (e.g., only tweets containing certain words).
- Add date range filtering via `time` element parsing.
- Add batching or explicit pause config to reduce rate risk.
