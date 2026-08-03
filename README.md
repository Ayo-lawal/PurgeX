# PurgeX (Twitter/X Timeline Cleaner)

PurgeX is a personal browser-console script for targeted cleanup of your own account activity on X/Twitter.

It can be configured to:
- Unlike matched liked posts.
- Unretweet matched retweets.
- Delete matched tweets from your own account.
- Filter by exact day, date range, keyword, hashtag, author, and tweet type.

> WARNING: This script can perform irreversible actions when `dryRun` is set to `false`. Always run with `dryRun: true` first and inspect the console output before live execution.

## Repository layout

- `unretweet-delete-quote.js` - main browser-console script.
- `README.md` - usage guide and behavior notes.
- `.gitignore` - local ignore rules.

## Usage

1. Sign in to X/Twitter in your browser.
2. Open the timeline you want to process:
   - Own posts and retweets: `https://x.com/YOUR_USERNAME`
   - Own replies: `https://x.com/YOUR_USERNAME/with_replies`
   - Likes: `https://x.com/YOUR_USERNAME/likes`
3. Open DevTools Console.
4. Paste the script into the console and press Enter.
5. Use the PurgeX panel that appears in the top-right of the page.
6. Choose actions, filters, max actions, and account handle if deleting.
7. Click Preview visible to inspect currently loaded tweets without scrolling.
8. Click Run with Dry run enabled for the full scrolling pass, then review the console tables.
9. Only after the matches look correct, uncheck Dry run, type `PURGE` in Live confirm, and click Run again.

## Browser panel

Pasting the script into DevTools opens a PurgeX panel instead of immediately scanning the page. The panel includes:

- Preview control: scans only currently visible tweets, performs no clicks, and does not auto-scroll.
- Mode controls: dry run, live confirmation, max actions, account handle, and unfiltered-live override.
- Action controls: unlike, unretweet, and delete own tweets.
- Date controls: exact day or start/end date range.
- Text controls: keywords, excluded keywords, hashtags, and excluded hashtags.
- Author controls: include authors and exclude authors.
- Tweet type controls: originals, replies, quotes, and retweets.

The panel writes progress status on the page, while detailed matches and summaries are printed in the browser console. Use Preview visible before Run when tuning filters.

## Safety defaults

The script defaults to:

```js
dryRun: true
liveConfirm: ''
maxActions: 25
allowUnfilteredLiveRun: false
actions: {
  unlike: false,
  unretweet: true,
  deleteOwnTweets: false
}
```

Live mode refuses to run unless:
- `liveConfirm` is exactly `'PURGE'`.
- at least one action is enabled.
- at least one filter is active, unless `allowUnfilteredLiveRun` is explicitly set to `true`.
- `accountHandle` is explicitly set when live deleting own tweets.

## Filtering

The shared filter engine supports:

- `exactDay`: one UTC day, for example `2023-04-01`.
- `startDate` and `endDate`: date/time range, for example `2023-04-01T00:00:00Z`.
- `keywords`: include text matches.
- `excludeKeywords`: reject text matches.
- `hashtags`: include hashtag matches, with or without `#`.
- `excludeHashtags`: reject hashtag matches.
- `includeAuthors`: only match these handles.
- `excludeAuthors`: reject these handles.
- `requireAllKeywords`: require every keyword instead of any keyword.
- `requireAllHashtags`: require every hashtag instead of any hashtag.
- `tweetTypes`: include or exclude originals, replies, quotes, and retweets.

A tweet must pass all configured filters before any action is considered.

## Example configs

### Dry-run retweets containing a keyword in a date range

```js
const CONFIG = {
  dryRun: true,
  liveConfirm: '',
  maxActions: 25,
  stopAfterNoNewTweets: 3,
  requireExplicitAccountHandleForDelete: true,
  allowUnfilteredLiveRun: false,
  accountHandle: '',
  actions: {
    unlike: false,
    unretweet: true,
    deleteOwnTweets: false
  },
  filters: {
    exactDay: '',
    startDate: '2023-04-01T00:00:00Z',
    endDate: '2023-12-31T23:59:59Z',
    keywords: ['giveaway'],
    requireAllKeywords: false,
    excludeKeywords: ['winner announced'],
    hashtags: [],
    requireAllHashtags: false,
    excludeHashtags: [],
    includeAuthors: [],
    excludeAuthors: [],
    tweetTypes: {
      originals: false,
      replies: false,
      quotes: false,
      retweets: true
    }
  }
};
```

### Unlike liked posts with a hashtag

Run this from your likes page.

```js
actions: {
  unlike: true,
  unretweet: false,
  deleteOwnTweets: false
},
filters: {
  exactDay: '',
  startDate: '',
  endDate: '',
  keywords: [],
  requireAllKeywords: false,
  excludeKeywords: [],
  hashtags: ['oldhashtag'],
  requireAllHashtags: false,
  excludeHashtags: [],
  includeAuthors: [],
  excludeAuthors: [],
  tweetTypes: {
    originals: true,
    replies: true,
    quotes: true,
    retweets: true
  }
}
```

### Delete your own tweets with a keyword

Set `accountHandle` explicitly before live delete runs. Live delete refuses to run without it by default.

```js
dryRun: true,
liveConfirm: '',
accountHandle: 'YOUR_USERNAME',
actions: {
  unlike: false,
  unretweet: false,
  deleteOwnTweets: true
},
filters: {
  exactDay: '',
  startDate: '2020-01-01T00:00:00Z',
  endDate: '2020-12-31T23:59:59Z',
  keywords: ['old phrase'],
  requireAllKeywords: false,
  excludeKeywords: [],
  hashtags: [],
  requireAllHashtags: false,
  excludeHashtags: [],
  includeAuthors: [],
  excludeAuthors: [],
  tweetTypes: {
    originals: true,
    replies: true,
    quotes: true,
    retweets: false
  }
}
```

### Exact-day cleanup

Use `exactDay` when you want one specific UTC day. Leave `startDate` and `endDate` blank.

```js
filters: {
  exactDay: '2021-06-15',
  startDate: '',
  endDate: '',
  keywords: ['campaign'],
  requireAllKeywords: false,
  excludeKeywords: [],
  hashtags: [],
  requireAllHashtags: false,
  excludeHashtags: [],
  includeAuthors: [],
  excludeAuthors: [],
  tweetTypes: {
    originals: true,
    replies: true,
    quotes: true,
    retweets: true
  }
}
```

## Action flow

Every visible tweet goes through this flow:

```text
classify -> filter -> determine eligible actions -> dry-run log -> execute only if live
```

The console output includes the planned action, author, date, match reasons, tweet URL, and a short text preview. A final summary table reports scanned tweets, matched tweets, planned actions, completed actions, and failed actions.

## Browser packages

Generate browser-friendly package files with:

```powershell
node tools\build-browser-packages.js
```

This creates:

- `dist/purgex-bookmarklet.txt`: bookmarklet text for quick panel mounting. This may be too large for some browsers.
- `dist/purgex.user.js`: userscript wrapper for script managers that support user scripts.

The console-paste and userscript workflows are more reliable than the bookmarklet for this script size. Regenerate these files after changing `unretweet-delete-quote.js`.

## Verification

Run the pure filter/action tests with. These tests cover the shared core used by both the browser panel and the cleanup runner:

```powershell
node tests\purgex-core.test.js
```

Build browser package artifacts with:

```powershell
node tools\build-browser-packages.js
```

Run a syntax check with:

```powershell
node --check unretweet-delete-quote.js
```
## Limitations

- X markup can change at any time, which can break selectors.
- Browser timelines are virtualized, so very old posts may require repeated runs or manual navigation.
- Deleted tweets, unlikes, and unretweets cannot be undone by this script.
- The script only sees tweets loaded in the browser as it scrolls.
- Hashtag matching currently targets standard ASCII hashtags.
