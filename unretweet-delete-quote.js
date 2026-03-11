// PurgeX timeline action script.
// Usage: open Twitter.com, sign in, go to timeline, then run this script in DevTools Console.

(async () => {
  const processed = new WeakSet();
  const myHandle = window.location.pathname.split('/')[1]?.toLowerCase() || '';

  const selectors = {
    tweet: 'article[data-testid="tweet"]',
    unretweet: '[data-testid="unretweet"]',
    unretweetConfirm: '[data-testid="unretweetConfirm"], [data-testid="confirmationSheetConfirm"]',
    caret: '[data-testid="caret"]',
    menuItem: '[role="menuitem"]',
    deleteConfirm: '[data-testid="confirmationSheetConfirm"]'
  };

  const delay = (ms) => new Promise((res) => setTimeout(res, ms));
  const visibleTweets = () => Array.from(document.querySelectorAll(selectors.tweet));

  const clickIfPresent = async (el, ms = 250) => {
    if (!el) return false;
    el.click();
    await delay(ms);
    return true;
  };

  const extractAuthorHandle = (tweet) => {
    const authorLink = tweet.querySelector('a[href^="/"][role="link"]');
    if (!authorLink) return null;
    const parts = authorLink.getAttribute('href').split('/');
    return parts[1]?.toLowerCase() || null;
  };

  const isOwnTweet = (tweet) => extractAuthorHandle(tweet) === myHandle;
  const isRetweet = (tweet) => !!tweet.querySelector(selectors.unretweet);
  const isQuoteOrAttached = (tweet) => {
    if (tweet.querySelector('article[data-testid="tweet"] article[data-testid="tweet"]')) return true;
    const text = (tweet.innerText || '').toLowerCase();
    return text.includes('quote tweet') || text.includes('quoted tweet') || text.includes('retweet');
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
    const deleteItem = menuItems.find((item) =>
      (item.textContent || '').trim().toLowerCase().includes('delete')
    );
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

  const processTweet = async (tweet) => {
    if (processed.has(tweet)) return false;
    processed.add(tweet);

    const own = isOwnTweet(tweet);
    const ret = isRetweet(tweet);
    const quoted = isQuoteOrAttached(tweet);

    if (ret) {
      console.log('unretweeting', tweet); // dry-run logging
      return await attemptUnretweet(tweet);
    }
    if (own && quoted) {
      console.log('deleting own quote/attached tweet', tweet);
      return await attemptDelete(tweet);
    }

    return false;
  };

  const scrollAndWait = async () => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    const before = visibleTweets().length;
    for (let i = 0; i < 10; i++) {
      await delay(400);
      if (visibleTweets().length > before) break;
    }
  };

  while (true) {
    const todos = visibleTweets().filter((t) => !processed.has(t));
    if (!todos.length) {
      await scrollAndWait();
      if (!visibleTweets().some((t) => !processed.has(t))) break;
      continue;
    }

    for (const t of todos) {
      await processTweet(t);
      await delay(220);
    }
    await scrollAndWait();
  }

  console.log('Done: unretweet + delete owned quotes pass finished.');
})();
