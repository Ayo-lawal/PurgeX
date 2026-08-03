const assert = require('assert');
const { PurgeXCore, previewVisiblePurgeX, mountPurgeXPanel } = require('../unretweet-delete-quote.js');

const normalize = (overrides, inferredHandle = 'owner') => PurgeXCore.normalizeConfig(overrides, inferredHandle);

const tweet = (overrides = {}) => ({
  authorHandle: 'owner',
  date: new Date('2023-06-15T12:00:00Z'),
  hashtags: PurgeXCore.getHashtagsFromText('launching #OldTag #Keep'),
  isLiked: false,
  isOwn: true,
  isQuote: false,
  isReply: false,
  isRetweet: false,
  text: 'Launching the old campaign #OldTag #Keep',
  url: 'https://x.com/owner/status/1',
  ...overrides
});

const test = (name, fn) => {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
};

test('matches keyword and date range', () => {
  const config = normalize({
    filters: {
      startDate: '2023-01-01T00:00:00Z',
      endDate: '2023-12-31T23:59:59Z',
      keywords: ['old campaign']
    }
  });

  assert.strictEqual(PurgeXCore.matchesFilters(tweet(), config), true);
});

test('rejects tweet outside date range', () => {
  const config = normalize({
    filters: {
      startDate: '2024-01-01T00:00:00Z',
      endDate: '2024-12-31T23:59:59Z',
      keywords: ['old campaign']
    }
  });

  assert.strictEqual(PurgeXCore.matchesFilters(tweet(), config), false);
});

test('exactDay matches only that UTC day', () => {
  const config = normalize({ filters: { exactDay: '2023-06-15' } });

  assert.strictEqual(PurgeXCore.matchesFilters(tweet(), config), true);
  assert.strictEqual(
    PurgeXCore.matchesFilters(tweet({ date: new Date('2023-06-16T00:00:00Z') }), config),
    false
  );
});

test('excludeKeywords veto matched tweets', () => {
  const config = normalize({
    filters: {
      keywords: ['campaign'],
      excludeKeywords: ['old']
    }
  });

  assert.strictEqual(PurgeXCore.matchesFilters(tweet(), config), false);
});

test('hashtag include and exclude filters work', () => {
  const includeConfig = normalize({ filters: { hashtags: ['oldtag'] } });
  const excludeConfig = normalize({ filters: { hashtags: ['oldtag'], excludeHashtags: ['keep'] } });

  assert.strictEqual(PurgeXCore.matchesFilters(tweet(), includeConfig), true);
  assert.strictEqual(PurgeXCore.matchesFilters(tweet(), excludeConfig), false);
});

test('author include and exclude filters work', () => {
  const includeConfig = normalize({ filters: { includeAuthors: ['@owner'] } });
  const excludeConfig = normalize({ filters: { excludeAuthors: ['owner'] } });

  assert.strictEqual(PurgeXCore.matchesFilters(tweet(), includeConfig), true);
  assert.strictEqual(PurgeXCore.matchesFilters(tweet(), excludeConfig), false);
});

test('tweet type filters reject originals when disabled', () => {
  const config = normalize({
    filters: {
      tweetTypes: {
        originals: false,
        replies: true,
        quotes: true,
        retweets: true
      }
    }
  });

  assert.strictEqual(PurgeXCore.matchesFilters(tweet(), config), false);
  assert.strictEqual(PurgeXCore.matchesFilters(tweet({ isReply: true }), config), true);
});

test('eligible actions only return actions available on tweet', () => {
  const config = PurgeXCore.DEFAULT_CONFIG;
  const actions = PurgeXCore.eligibleActions(tweet({ isLiked: true, isRetweet: true }), {
    ...config,
    actions: {
      unlike: true,
      unretweet: true,
      deleteOwnTweets: true
    }
  });

  assert.deepStrictEqual(actions, ['unlike', 'unretweet', 'delete']);
});

test('live mode requires confirmation', () => {
  const config = normalize({ dryRun: false, filters: { keywords: ['campaign'] } });

  assert.throws(() => PurgeXCore.validateConfig(config), /liveConfirm/);
});

test('live delete requires explicit account handle', () => {
  const config = normalize({
    dryRun: false,
    liveConfirm: 'PURGE',
    actions: {
      unlike: false,
      unretweet: false,
      deleteOwnTweets: true
    },
    filters: { keywords: ['campaign'] }
  });

  assert.throws(() => PurgeXCore.validateConfig(config), /accountHandle/);
});

test('live mode rejects unfiltered broad runs', () => {
  const config = normalize({ dryRun: false, liveConfirm: 'PURGE' });

  assert.throws(() => PurgeXCore.validateConfig(config), /at least one filter/);
});

test('browser panel factory is exported for browser mounting', () => {
  assert.strictEqual(typeof mountPurgeXPanel, 'function');
});
test('visible preview function is exported for browser preview', () => {
  assert.strictEqual(typeof previewVisiblePurgeX, 'function');
});
test('builds old tweet search URL from handle dates keywords and hashtags', () => {
  const url = PurgeXCore.buildSearchUrl({
    accountHandle: '@owner',
    since: '2020-01-01',
    until: '2020-04-01',
    keywords: ['old phrase', 'promo'],
    hashtags: ['giveaway'],
    mode: 'live'
  }, 'https://x.com');

  const parsed = new URL(url);
  const query = parsed.searchParams.get('q');
  assert.strictEqual(parsed.pathname, '/search');
  assert.strictEqual(parsed.searchParams.get('f'), 'live');
  assert.ok(query.includes('from:owner'));
  assert.ok(query.includes('since:2020-01-01'));
  assert.ok(query.includes('until:2020-04-01'));
  assert.ok(query.includes('"old phrase"'));
  assert.ok(query.includes('promo'));
  assert.ok(query.includes('#giveaway'));
});

test('search URL builder requires at least one term', () => {
  assert.throws(() => PurgeXCore.buildSearchUrl({}, 'https://x.com'), /at least one search term/);
});