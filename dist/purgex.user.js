// ==UserScript==
// @name         PurgeX Timeline Cleaner
// @namespace    https://local.purgex
// @version      0.1.0
// @description  Open the PurgeX cleanup panel on X/Twitter timelines.
// @match        https://x.com/*
// @match        https://twitter.com/*
// @grant        none
// ==/UserScript==

// PurgeX timeline action script.
// Usage: open x.com/twitter.com, sign in, open the target timeline, edit CONFIG, then run in DevTools Console.

const PurgeXCore = (() => {
  const DEFAULT_CONFIG = {
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
      startDate: '',
      endDate: '',
      keywords: [],
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
  };

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const normalizeHandle = (value) => (value || '').replace(/^@/, '').trim().toLowerCase();
  const normalizeTextList = (items) => (items || []).map((item) => String(item).trim().toLowerCase()).filter(Boolean);
  const normalizeHashtags = (items) => normalizeTextList(items).map((tag) => tag.replace(/^#/, ''));
  const normalizeHandles = (items) => normalizeTextList(items).map((handle) => handle.replace(/^@/, ''));

  const mergeConfig = (config) => {
    const merged = clone(DEFAULT_CONFIG);
    const incoming = config || {};
    Object.assign(merged, incoming);
    merged.actions = Object.assign({}, DEFAULT_CONFIG.actions, incoming.actions || {});
    merged.filters = Object.assign({}, DEFAULT_CONFIG.filters, incoming.filters || {});
    merged.filters.tweetTypes = Object.assign(
      {},
      DEFAULT_CONFIG.filters.tweetTypes,
      (incoming.filters && incoming.filters.tweetTypes) || {}
    );
    return merged;
  };

  const parseDate = (value, label) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new Error(`CONFIG.filters.${label} is not a valid date.`);
    return date;
  };

  const normalizeConfig = (config, inferredHandle = '') => {
    const merged = mergeConfig(config);
    const exactDayStart = merged.filters.exactDay ? parseDate(`${merged.filters.exactDay}T00:00:00Z`, 'exactDay') : null;
    const exactDayEnd = merged.filters.exactDay ? parseDate(`${merged.filters.exactDay}T23:59:59.999Z`, 'exactDay') : null;

    return {
      raw: merged,
      accountHandle: normalizeHandle(merged.accountHandle) || normalizeHandle(inferredHandle),
      explicitAccountHandle: normalizeHandle(merged.accountHandle),
      startDate: exactDayStart || parseDate(merged.filters.startDate, 'startDate'),
      endDate: exactDayEnd || parseDate(merged.filters.endDate, 'endDate'),
      includeKeywords: normalizeTextList(merged.filters.keywords),
      excludeKeywords: normalizeTextList(merged.filters.excludeKeywords),
      includeHashtags: normalizeHashtags(merged.filters.hashtags),
      excludeHashtags: normalizeHashtags(merged.filters.excludeHashtags),
      includeAuthors: normalizeHandles(merged.filters.includeAuthors),
      excludeAuthors: normalizeHandles(merged.filters.excludeAuthors)
    };
  };

  const getHashtagsFromText = (text) =>
    new Set((text.match(/#[A-Za-z0-9_]+/g) || []).map((tag) => tag.slice(1).toLowerCase()));

  const includesAnyOrAll = (needles, text, requireAll) => {
    if (!needles.length) return true;
    const lowerText = String(text || '').toLowerCase();
    const matcher = (item) => lowerText.includes(item);
    return requireAll ? needles.every(matcher) : needles.some(matcher);
  };

  const excludesAll = (needles, text) => {
    if (!needles.length) return true;
    const lowerText = String(text || '').toLowerCase();
    return needles.every((item) => !lowerText.includes(item));
  };

  const matchesHashtags = (needles, found, requireAll) => {
    if (!needles.length) return true;
    const matcher = (tag) => found.has(tag);
    return requireAll ? needles.every(matcher) : needles.some(matcher);
  };

  const excludesHashtags = (needles, found) => {
    if (!needles.length) return true;
    return needles.every((tag) => !found.has(tag));
  };

  const matchesAuthors = (info, normalized) => {
    if (normalized.includeAuthors.length && !normalized.includeAuthors.includes(info.authorHandle)) return false;
    if (normalized.excludeAuthors.length && normalized.excludeAuthors.includes(info.authorHandle)) return false;
    return true;
  };

  const matchesDateRange = (date, normalized) => {
    if (!normalized.startDate && !normalized.endDate) return true;
    if (!date) return false;
    if (normalized.startDate && date < normalized.startDate) return false;
    if (normalized.endDate && date > normalized.endDate) return false;
    return true;
  };

  const matchesTweetType = (info, normalized) => {
    const types = normalized.raw.filters.tweetTypes;
    if (info.isRetweet) return !!types.retweets;
    if (info.isQuote) return !!types.quotes;
    if (info.isReply) return !!types.replies;
    return !!types.originals;
  };

  const hasActiveFilter = (normalized) => {
    const config = normalized.raw;
    if (config.filters.exactDay || config.filters.startDate || config.filters.endDate) return true;
    if (normalized.includeKeywords.length || normalized.excludeKeywords.length) return true;
    if (normalized.includeHashtags.length || normalized.excludeHashtags.length) return true;
    if (normalized.includeAuthors.length || normalized.excludeAuthors.length) return true;
    const types = config.filters.tweetTypes;
    return !types.originals || !types.replies || !types.quotes || !types.retweets;
  };

  const matchesFilters = (info, normalized) => {
    if (!matchesDateRange(info.date, normalized)) return false;
    if (!matchesAuthors(info, normalized)) return false;
    if (!includesAnyOrAll(normalized.includeKeywords, info.text, normalized.raw.filters.requireAllKeywords)) return false;
    if (!excludesAll(normalized.excludeKeywords, info.text)) return false;
    if (!matchesHashtags(normalized.includeHashtags, info.hashtags, normalized.raw.filters.requireAllHashtags)) return false;
    if (!excludesHashtags(normalized.excludeHashtags, info.hashtags)) return false;
    if (!matchesTweetType(info, normalized)) return false;
    return true;
  };

  const eligibleActions = (info, config) => {
    const actions = [];
    if (config.actions.unlike && info.isLiked) actions.push('unlike');
    if (config.actions.unretweet && info.isRetweet) actions.push('unretweet');
    if (config.actions.deleteOwnTweets && info.isOwn) actions.push('delete');
    return actions;
  };

  const validateConfig = (normalized) => {
    const config = normalized.raw;
    if (!config.actions.unlike && !config.actions.unretweet && !config.actions.deleteOwnTweets) {
      throw new Error('Enable at least one action in CONFIG.actions.');
    }
    if (!config.dryRun && config.liveConfirm !== 'PURGE') {
      throw new Error("Live mode requires CONFIG.liveConfirm = 'PURGE'. Run dryRun first.");
    }
    if (!config.dryRun && !config.allowUnfilteredLiveRun && !hasActiveFilter(normalized)) {
      throw new Error('Live mode requires at least one filter. Set CONFIG.allowUnfilteredLiveRun = true to override.');
    }
    if (
      !config.dryRun &&
      config.actions.deleteOwnTweets &&
      config.requireExplicitAccountHandleForDelete &&
      !normalized.explicitAccountHandle
    ) {
      throw new Error('Set CONFIG.accountHandle explicitly before live deleteOwnTweets runs.');
    }
  };

  const filterReasons = (info, normalized) => {
    const config = normalized.raw;
    const reasons = [];
    if (config.filters.exactDay) reasons.push(`exactDay:${config.filters.exactDay}`);
    if (config.filters.startDate || config.filters.endDate) reasons.push('dateRange');
    if (normalized.includeKeywords.length) reasons.push(`keywords:${normalized.includeKeywords.join('|')}`);
    if (normalized.includeHashtags.length) reasons.push(`hashtags:${normalized.includeHashtags.join('|')}`);
    if (normalized.includeAuthors.length) reasons.push(`authors:${normalized.includeAuthors.join('|')}`);
    if (info.isRetweet) reasons.push('retweet');
    if (info.isQuote) reasons.push('quote');
    if (info.isReply) reasons.push('reply');
    if (info.isOwn) reasons.push('own');
    if (info.isLiked) reasons.push('liked');
    return reasons;
  };

  return {
    DEFAULT_CONFIG,
    normalizeConfig,
    normalizeHandle,
    getHashtagsFromText,
    matchesFilters,
    eligibleActions,
    validateConfig,
    hasActiveFilter,
    filterReasons
  };
})();

async function runPurgeX(userConfig) {
  const CONFIG = PurgeXCore.normalizeConfig(userConfig, window.location.pathname.split('/')[1]);
  PurgeXCore.validateConfig(CONFIG);

  const selectors = {
    tweet: 'article[data-testid="tweet"]',
    unlike: '[data-testid="unlike"]',
    unlikeConfirm: '[data-testid="confirmationSheetConfirm"]',
    unretweet: '[data-testid="unretweet"]',
    unretweetConfirm: '[data-testid="unretweetConfirm"], [data-testid="confirmationSheetConfirm"]',
    caret: '[data-testid="caret"]',
    menuItem: '[role="menuitem"]',
    deleteConfirm: '[data-testid="confirmationSheetConfirm"]'
  };

  const processedElements = new WeakSet();
  const processedKeys = new Set();
  const delay = (ms) => new Promise((res) => setTimeout(res, ms));
  const visibleTweets = () => Array.from(document.querySelectorAll(selectors.tweet));
  let actionCount = 0;

  const stats = {
    scanned: 0,
    matchedTweets: 0,
    plannedActions: 0,
    completedActions: 0,
    failedActions: 0,
    skippedNoFilters: 0,
    skippedNoEligibleAction: 0
  };

  const clickIfPresent = async (el, ms = 250) => {
    if (!el) return false;
    el.click();
    await delay(ms);
    return true;
  };

  const getTweetText = (tweet) => tweet.innerText || '';

  const getTweetUrl = (tweet) => {
    const statusLink = Array.from(tweet.querySelectorAll('a[href*="/status/"]')).find((link) => {
      const href = link.getAttribute('href') || '';
      return /\/status\/\d+/.test(href);
    });
    if (!statusLink) return '';
    return new URL(statusLink.getAttribute('href'), window.location.origin).href;
  };

  const getTweetKey = (tweet) => getTweetUrl(tweet) || '';

  const wasProcessed = (tweet) => {
    const key = getTweetKey(tweet);
    if (key) return processedKeys.has(key);
    return processedElements.has(tweet);
  };

  const markProcessed = (tweet) => {
    const key = getTweetKey(tweet);
    if (key) processedKeys.add(key);
    processedElements.add(tweet);
  };

  const extractAuthorHandle = (tweet) => {
    const links = Array.from(tweet.querySelectorAll('a[href^="/"][role="link"]'));
    const authorLink = links.find((link) => {
      const href = link.getAttribute('href') || '';
      return /^\/[^/]+$/.test(href) && !href.includes('/status/');
    });
    return PurgeXCore.normalizeHandle(authorLink?.getAttribute('href')?.split('/')[1]);
  };

  const getTweetDate = (tweet) => {
    const timeEl = tweet.querySelector('time');
    if (!timeEl) return null;
    const date = new Date(timeEl.getAttribute('datetime'));
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const hasNestedTweet = (tweet) => !!tweet.querySelector('article[data-testid="tweet"] article[data-testid="tweet"]');

  const classifyTweet = (tweet) => {
    const text = getTweetText(tweet);
    const lowerText = text.toLowerCase();
    const authorHandle = extractAuthorHandle(tweet);
    return {
      authorHandle,
      date: getTweetDate(tweet),
      hashtags: PurgeXCore.getHashtagsFromText(text),
      isLiked: !!tweet.querySelector(selectors.unlike),
      isOwn: !!CONFIG.accountHandle && authorHandle === CONFIG.accountHandle,
      isQuote: hasNestedTweet(tweet) || lowerText.includes('quote tweet') || lowerText.includes('quoted tweet'),
      isReply: lowerText.includes('replying to') || lowerText.includes('replied to'),
      isRetweet: !!tweet.querySelector(selectors.unretweet),
      text,
      url: getTweetUrl(tweet)
    };
  };

  const attemptUnlike = async (tweet) => {
    const btn = tweet.querySelector(selectors.unlike);
    if (!btn) return false;
    await clickIfPresent(btn, 300);
    const confirm = document.querySelector(selectors.unlikeConfirm);
    if (confirm) await clickIfPresent(confirm, 300);
    await delay(700);
    return true;
  };

  const attemptUnretweet = async (tweet) => {
    const btn = tweet.querySelector(selectors.unretweet);
    if (!btn) return false;
    await clickIfPresent(btn, 300);
    const confirm = document.querySelector(selectors.unretweetConfirm);
    if (!confirm) return false;
    await clickIfPresent(confirm, 300);
    await delay(900);
    return true;
  };

  const attemptDelete = async (tweet) => {
    const caret = tweet.querySelector(selectors.caret);
    if (!caret) return false;
    await clickIfPresent(caret, 250);
    const menuItems = Array.from(document.querySelectorAll(selectors.menuItem));
    const deleteItem = menuItems.find((item) => (item.textContent || '').trim().toLowerCase().includes('delete'));
    if (!deleteItem) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      return false;
    }
    await clickIfPresent(deleteItem, 250);
    const confirm = document.querySelector(selectors.deleteConfirm);
    if (!confirm) return false;
    await clickIfPresent(confirm, 300);
    await delay(950);
    return true;
  };

  const runAction = async (action, tweet) => {
    if (CONFIG.raw.dryRun) return true;
    if (action === 'unlike') return await attemptUnlike(tweet);
    if (action === 'unretweet') return await attemptUnretweet(tweet);
    if (action === 'delete') return await attemptDelete(tweet);
    return false;
  };

  const processTweet = async (tweet) => {
    if (wasProcessed(tweet) || actionCount >= CONFIG.raw.maxActions) return false;
    markProcessed(tweet);
    stats.scanned++;

    const info = classifyTweet(tweet);
    if (!PurgeXCore.matchesFilters(info, CONFIG)) return false;

    const actions = PurgeXCore.eligibleActions(info, CONFIG.raw);
    if (!actions.length) {
      stats.skippedNoEligibleAction++;
      return false;
    }

    stats.matchedTweets++;
    stats.plannedActions += actions.length;
    console.table([{
      mode: CONFIG.raw.dryRun ? 'DRY_RUN' : 'LIVE',
      actions: actions.join(', '),
      author: info.authorHandle ? `@${info.authorHandle}` : '',
      date: info.date ? info.date.toISOString() : '',
      reasons: PurgeXCore.filterReasons(info, CONFIG).join(', '),
      url: info.url,
      preview: info.text.replace(/\s+/g, ' ').slice(0, 160)
    }]);

    for (const action of actions) {
      if (actionCount >= CONFIG.raw.maxActions) return true;
      const ok = await runAction(action, tweet);
      if (ok) {
        actionCount++;
        stats.completedActions++;
      } else {
        stats.failedActions++;
      }
      await delay(250);
    }

    return true;
  };

  const scrollToBottomAndWait = async () => {
    const before = visibleTweets().length;
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    for (let i = 0; i < 10; i++) {
      await delay(400);
      if (visibleTweets().length > before) break;
    }
  };

  const sortTweetsTopToBottom = (tweets) =>
    tweets.slice().sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);

  console.log('PurgeX starting', {
    mode: CONFIG.raw.dryRun ? 'DRY_RUN' : 'LIVE',
    accountHandle: CONFIG.accountHandle,
    maxActions: CONFIG.raw.maxActions,
    actions: CONFIG.raw.actions,
    filters: CONFIG.raw.filters
  });

  window.scrollTo({ top: 0, behavior: 'auto' });
  await delay(700);

  let emptyPasses = 0;
  while (actionCount < CONFIG.raw.maxActions) {
    const todos = sortTweetsTopToBottom(visibleTweets().filter((tweet) => !wasProcessed(tweet)));
    if (!todos.length) {
      emptyPasses++;
      if (emptyPasses >= CONFIG.raw.stopAfterNoNewTweets) break;
      await scrollToBottomAndWait();
      continue;
    }

    emptyPasses = 0;
    for (const tweet of todos) {
      await processTweet(tweet);
      await delay(220);
      if (actionCount >= CONFIG.raw.maxActions) break;
    }
    await scrollToBottomAndWait();
  }

  if (!PurgeXCore.hasActiveFilter(CONFIG)) stats.skippedNoFilters = stats.scanned;
  console.table([stats]);
  console.log(`PurgeX finished. ${CONFIG.raw.dryRun ? 'Matched/planned' : 'Completed'} actions: ${stats.completedActions}`);
}

async function previewVisiblePurgeX(userConfig) {
  const previewConfig = Object.assign({}, userConfig, { dryRun: true, liveConfirm: '' });
  const CONFIG = PurgeXCore.normalizeConfig(previewConfig, window.location.pathname.split('/')[1]);
  PurgeXCore.validateConfig(CONFIG);

  const selectors = {
    tweet: 'article[data-testid="tweet"]',
    unlike: '[data-testid="unlike"]',
    unretweet: '[data-testid="unretweet"]'
  };

  const getTweetText = (tweet) => tweet.innerText || '';
  const getTweetUrl = (tweet) => {
    const statusLink = Array.from(tweet.querySelectorAll('a[href*="/status/"]')).find((link) => {
      const href = link.getAttribute('href') || '';
      return /\/status\/\d+/.test(href);
    });
    if (!statusLink) return '';
    return new URL(statusLink.getAttribute('href'), window.location.origin).href;
  };
  const extractAuthorHandle = (tweet) => {
    const links = Array.from(tweet.querySelectorAll('a[href^="/"][role="link"]'));
    const authorLink = links.find((link) => {
      const href = link.getAttribute('href') || '';
      return /^\/[^/]+$/.test(href) && !href.includes('/status/');
    });
    return PurgeXCore.normalizeHandle(authorLink?.getAttribute('href')?.split('/')[1]);
  };
  const getTweetDate = (tweet) => {
    const timeEl = tweet.querySelector('time');
    if (!timeEl) return null;
    const date = new Date(timeEl.getAttribute('datetime'));
    return Number.isNaN(date.getTime()) ? null : date;
  };
  const hasNestedTweet = (tweet) => !!tweet.querySelector('article[data-testid="tweet"] article[data-testid="tweet"]');
  const classifyTweet = (tweet) => {
    const text = getTweetText(tweet);
    const lowerText = text.toLowerCase();
    const authorHandle = extractAuthorHandle(tweet);
    return {
      authorHandle,
      date: getTweetDate(tweet),
      hashtags: PurgeXCore.getHashtagsFromText(text),
      isLiked: !!tweet.querySelector(selectors.unlike),
      isOwn: !!CONFIG.accountHandle && authorHandle === CONFIG.accountHandle,
      isQuote: hasNestedTweet(tweet) || lowerText.includes('quote tweet') || lowerText.includes('quoted tweet'),
      isReply: lowerText.includes('replying to') || lowerText.includes('replied to'),
      isRetweet: !!tweet.querySelector(selectors.unretweet),
      text,
      url: getTweetUrl(tweet)
    };
  };

  const rows = [];
  const stats = {
    scanned: 0,
    matchedTweets: 0,
    plannedActions: 0,
    skippedNoEligibleAction: 0
  };

  for (const tweet of Array.from(document.querySelectorAll(selectors.tweet))) {
    stats.scanned++;
    const info = classifyTweet(tweet);
    if (!PurgeXCore.matchesFilters(info, CONFIG)) continue;
    const actions = PurgeXCore.eligibleActions(info, CONFIG.raw);
    if (!actions.length) {
      stats.skippedNoEligibleAction++;
      continue;
    }
    stats.matchedTweets++;
    stats.plannedActions += actions.length;
    rows.push({
      actions: actions.join(', '),
      author: info.authorHandle ? `@${info.authorHandle}` : '',
      date: info.date ? info.date.toISOString() : '',
      reasons: PurgeXCore.filterReasons(info, CONFIG).join(', '),
      url: info.url,
      preview: info.text.replace(/\s+/g, ' ').slice(0, 160)
    });
  }

  console.log('PurgeX visible preview. No scrolling and no actions performed.');
  if (rows.length) console.table(rows);
  console.table([stats]);
  return { rows, stats };
}
function mountPurgeXPanel(defaultConfig = PurgeXCore.DEFAULT_CONFIG) {
  const existing = document.getElementById('purgex-panel');
  if (existing) existing.remove();

  const parseList = (value) => String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
  const checked = (id) => document.getElementById(id).checked;
  const value = (id) => document.getElementById(id).value.trim();
  const numberValue = (id, fallback) => {
    const parsed = Number(value(id));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };

  const panel = document.createElement('section');
  panel.id = 'purgex-panel';
  panel.innerHTML = `
    <style>
      #purgex-panel { position: fixed; top: 16px; right: 16px; z-index: 2147483647; width: min(420px, calc(100vw - 32px)); max-height: calc(100vh - 32px); overflow: auto; background: #fff; color: #111827; border: 1px solid #d1d5db; box-shadow: 0 16px 40px rgba(0,0,0,.22); border-radius: 8px; font-family: Arial, sans-serif; font-size: 13px; line-height: 1.35; }
      #purgex-panel * { box-sizing: border-box; }
      #purgex-panel header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 14px; border-bottom: 1px solid #e5e7eb; background: #f9fafb; position: sticky; top: 0; }
      #purgex-panel h2 { margin: 0; font-size: 15px; font-weight: 700; }
      #purgex-panel form { padding: 12px 14px 14px; }
      #purgex-panel fieldset { border: 1px solid #e5e7eb; border-radius: 6px; margin: 0 0 10px; padding: 10px; }
      #purgex-panel legend { padding: 0 5px; font-weight: 700; }
      #purgex-panel label { display: block; margin: 7px 0; }
      #purgex-panel .row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      #purgex-panel input[type="text"], #purgex-panel input[type="date"], #purgex-panel input[type="number"] { width: 100%; padding: 7px 8px; border: 1px solid #cbd5e1; border-radius: 6px; font: inherit; }
      #purgex-panel .check-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 10px; }
      #purgex-panel .inline { display: flex; align-items: center; gap: 7px; }
      #purgex-panel .inline input { margin: 0; }
      #purgex-panel .actions-row { display: flex; gap: 8px; justify-content: flex-end; padding-top: 4px; }
      #purgex-panel button { border: 1px solid #cbd5e1; border-radius: 6px; background: #fff; color: #111827; padding: 7px 10px; font: inherit; cursor: pointer; }
      #purgex-panel button.primary { background: #111827; color: #fff; border-color: #111827; }
      #purgex-panel .note { color: #4b5563; font-size: 12px; margin: 7px 0 0; }
      #purgex-panel .status { margin-top: 10px; color: #374151; min-height: 18px; }
    </style>
    <header><h2>PurgeX</h2><button type="button" id="purgex-close" title="Close">x</button></header>
    <form id="purgex-form">
      <fieldset><legend>Mode</legend>
        <label class="inline"><input id="purgex-dry-run" type="checkbox" checked> Dry run</label>
        <label>Live confirm <input id="purgex-live-confirm" type="text" placeholder="PURGE"></label>
        <div class="row"><label>Max actions <input id="purgex-max-actions" type="number" min="1" value="25"></label><label>Account handle <input id="purgex-account" type="text" placeholder="your_handle"></label></div>
        <label class="inline"><input id="purgex-unfiltered" type="checkbox"> Allow unfiltered live run</label>
        <p class="note">Live mode requires PURGE and refuses delete without an explicit account handle.</p>
      </fieldset>
      <fieldset><legend>Actions</legend><div class="check-grid">
        <label class="inline"><input id="purgex-unlike" type="checkbox"> Unlike</label>
        <label class="inline"><input id="purgex-unretweet" type="checkbox" checked> Unretweet</label>
        <label class="inline"><input id="purgex-delete" type="checkbox"> Delete own tweets</label>
      </div></fieldset>
      <fieldset><legend>Date</legend>
        <label>Exact day <input id="purgex-exact-day" type="date"></label>
        <div class="row"><label>Start <input id="purgex-start-date" type="text" placeholder="2023-01-01T00:00:00Z"></label><label>End <input id="purgex-end-date" type="text" placeholder="2023-12-31T23:59:59Z"></label></div>
      </fieldset>
      <fieldset><legend>Text</legend>
        <label>Keywords <input id="purgex-keywords" type="text" placeholder="keyword, phrase"></label>
        <label class="inline"><input id="purgex-all-keywords" type="checkbox"> Require all keywords</label>
        <label>Exclude keywords <input id="purgex-exclude-keywords" type="text" placeholder="safe phrase"></label>
        <label>Hashtags <input id="purgex-hashtags" type="text" placeholder="oldtag, giveaway"></label>
        <label class="inline"><input id="purgex-all-hashtags" type="checkbox"> Require all hashtags</label>
        <label>Exclude hashtags <input id="purgex-exclude-hashtags" type="text" placeholder="keep"></label>
      </fieldset>
      <fieldset><legend>Authors and Types</legend>
        <label>Include authors <input id="purgex-include-authors" type="text" placeholder="handle1, handle2"></label>
        <label>Exclude authors <input id="purgex-exclude-authors" type="text" placeholder="handle3"></label>
        <div class="check-grid">
          <label class="inline"><input id="purgex-type-originals" type="checkbox" checked> Originals</label>
          <label class="inline"><input id="purgex-type-replies" type="checkbox" checked> Replies</label>
          <label class="inline"><input id="purgex-type-quotes" type="checkbox" checked> Quotes</label>
          <label class="inline"><input id="purgex-type-retweets" type="checkbox" checked> Retweets</label>
        </div>
      </fieldset>
      <div class="actions-row"><button type="button" id="purgex-reset">Reset</button><button type="button" id="purgex-preview">Preview visible</button><button type="submit" class="primary">Run</button></div>
      <div id="purgex-status" class="status"></div>
    </form>`;

  document.body.appendChild(panel);

  const toForm = (config) => {
    document.getElementById('purgex-dry-run').checked = !!config.dryRun;
    document.getElementById('purgex-live-confirm').value = config.liveConfirm || '';
    document.getElementById('purgex-max-actions').value = config.maxActions || 25;
    document.getElementById('purgex-account').value = config.accountHandle || '';
    document.getElementById('purgex-unfiltered').checked = !!config.allowUnfilteredLiveRun;
    document.getElementById('purgex-unlike').checked = !!config.actions.unlike;
    document.getElementById('purgex-unretweet').checked = !!config.actions.unretweet;
    document.getElementById('purgex-delete').checked = !!config.actions.deleteOwnTweets;
    document.getElementById('purgex-exact-day').value = config.filters.exactDay || '';
    document.getElementById('purgex-start-date').value = config.filters.startDate || '';
    document.getElementById('purgex-end-date').value = config.filters.endDate || '';
    document.getElementById('purgex-keywords').value = (config.filters.keywords || []).join(', ');
    document.getElementById('purgex-all-keywords').checked = !!config.filters.requireAllKeywords;
    document.getElementById('purgex-exclude-keywords').value = (config.filters.excludeKeywords || []).join(', ');
    document.getElementById('purgex-hashtags').value = (config.filters.hashtags || []).join(', ');
    document.getElementById('purgex-all-hashtags').checked = !!config.filters.requireAllHashtags;
    document.getElementById('purgex-exclude-hashtags').value = (config.filters.excludeHashtags || []).join(', ');
    document.getElementById('purgex-include-authors').value = (config.filters.includeAuthors || []).join(', ');
    document.getElementById('purgex-exclude-authors').value = (config.filters.excludeAuthors || []).join(', ');
    document.getElementById('purgex-type-originals').checked = !!config.filters.tweetTypes.originals;
    document.getElementById('purgex-type-replies').checked = !!config.filters.tweetTypes.replies;
    document.getElementById('purgex-type-quotes').checked = !!config.filters.tweetTypes.quotes;
    document.getElementById('purgex-type-retweets').checked = !!config.filters.tweetTypes.retweets;
  };

  const fromForm = () => ({
    dryRun: checked('purgex-dry-run'),
    liveConfirm: value('purgex-live-confirm'),
    maxActions: numberValue('purgex-max-actions', 25),
    stopAfterNoNewTweets: defaultConfig.stopAfterNoNewTweets,
    requireExplicitAccountHandleForDelete: true,
    allowUnfilteredLiveRun: checked('purgex-unfiltered'),
    accountHandle: value('purgex-account'),
    actions: { unlike: checked('purgex-unlike'), unretweet: checked('purgex-unretweet'), deleteOwnTweets: checked('purgex-delete') },
    filters: {
      exactDay: value('purgex-exact-day'), startDate: value('purgex-start-date'), endDate: value('purgex-end-date'),
      keywords: parseList(value('purgex-keywords')), requireAllKeywords: checked('purgex-all-keywords'), excludeKeywords: parseList(value('purgex-exclude-keywords')),
      hashtags: parseList(value('purgex-hashtags')), requireAllHashtags: checked('purgex-all-hashtags'), excludeHashtags: parseList(value('purgex-exclude-hashtags')),
      includeAuthors: parseList(value('purgex-include-authors')), excludeAuthors: parseList(value('purgex-exclude-authors')),
      tweetTypes: { originals: checked('purgex-type-originals'), replies: checked('purgex-type-replies'), quotes: checked('purgex-type-quotes'), retweets: checked('purgex-type-retweets') }
    }
  });

  toForm(defaultConfig);
  document.getElementById('purgex-close').addEventListener('click', () => panel.remove());
  document.getElementById('purgex-reset').addEventListener('click', () => toForm(PurgeXCore.DEFAULT_CONFIG));
  document.getElementById('purgex-preview').addEventListener('click', async () => {
    const status = document.getElementById('purgex-status');
    status.textContent = 'Previewing visible tweets. Watch the console.';
    try {
      const result = await previewVisiblePurgeX(fromForm());
      status.textContent = `Previewed ${result.stats.scanned} visible tweets; matched ${result.stats.matchedTweets}.`;
    } catch (error) {
      status.textContent = error.message;
      console.error('PurgeX preview failed:', error);
    }
  });  document.getElementById('purgex-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const status = document.getElementById('purgex-status');
    status.textContent = 'Running. Watch the console for matched tweets and summary.';
    try {
      await runPurgeX(fromForm());
      status.textContent = 'Finished. Review the console summary.';
    } catch (error) {
      status.textContent = error.message;
      console.error('PurgeX failed:', error);
    }
  });

  return panel;
}

const CONFIG = PurgeXCore.DEFAULT_CONFIG;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PurgeXCore, runPurgeX, previewVisiblePurgeX, mountPurgeXPanel };
} else if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.PurgeX = { core: PurgeXCore, run: runPurgeX, previewVisible: previewVisiblePurgeX, mountPanel: mountPurgeXPanel };
  mountPurgeXPanel(CONFIG);
}
