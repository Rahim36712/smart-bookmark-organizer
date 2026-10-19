import test from 'node:test';
import assert from 'node:assert';
import { BookmarkCategorizer } from '../core/categorizer.js';

test('BookmarkCategorizer - Core Required Categories', async (t) => {
  const categorizer = new BookmarkCategorizer();

  await t.test('categorizes Germany bookmarks accurately with real umlauts', () => {
    const daad = categorizer.categorize({
      title: 'DAAD Scholarship and Study in Germany Database',
      url: 'https://www2.daad.de/deutschland/stipendium/hinweise/en/21913-daad-scholarships/'
    });
    assert.strictEqual(daad.categoryId, 'germany');
    assert.strictEqual(daad.confidence, 'high');

    const wg = categorizer.categorize({
      title: 'WG Zimmer & Wohnungen mieten in München',
      url: 'https://www.wg-gesucht.de/wg-zimmer-in-Muenchen.90.0.1.0.html'
    });
    assert.strictEqual(wg.categoryId, 'germany');

    const auslaender = categorizer.categorize({
      title: 'Ausländerbehörde Termin buchen - Aufenthaltserlaubnis',
      url: 'https://service.berlin.de/dienstleistung/120926/'
    });
    assert.strictEqual(auslaender.categoryId, 'germany');

    const tum = categorizer.categorize({
      title: 'Technical University of Munich - Admissions',
      url: 'https://www.tum.de/en/studies/degree-programs'
    });
    assert.strictEqual(tum.categoryId, 'germany');
  });

  await t.test('categorizes Study Abroad bookmarks accurately', () => {
    const toefl = categorizer.categorize({
      title: 'ETS TOEFL iBT Official Registration and Test Dates',
      url: 'https://www.ets.org/toefl.html'
    });
    assert.strictEqual(toefl.categoryId, 'study_abroad');

    const qs = categorizer.categorize({
      title: 'QS World University Rankings 2026 - Top Global Universities',
      url: 'https://www.topuniversities.com/university-rankings/world-university-rankings'
    });
    assert.strictEqual(qs.categoryId, 'study_abroad');

    const mastersPortal = categorizer.categorize({
      title: 'Find Masters Degrees Abroad in Europe & North America',
      url: 'https://www.mastersportal.com/search/'
    });
    assert.strictEqual(mastersPortal.categoryId, 'study_abroad');
  });

  await t.test('categorizes Programming bookmarks accurately', () => {
    const github = categorizer.categorize({
      title: 'facebook/react: The library for web and native user interfaces',
      url: 'https://github.com/facebook/react'
    });
    assert.strictEqual(github.categoryId, 'programming');

    const leetcode = categorizer.categorize({
      title: 'LeetCode - Two Sum Algorithm Problem',
      url: 'https://leetcode.com/problems/two-sum/'
    });
    assert.strictEqual(leetcode.categoryId, 'programming');

    const mdn = categorizer.categorize({
      title: 'Array.prototype.map() - JavaScript | MDN',
      url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map'
    });
    assert.strictEqual(mdn.categoryId, 'programming');
  });

  await t.test('categorizes AI & Technology bookmarks accurately', () => {
    const chatgpt = categorizer.categorize({
      title: 'ChatGPT - OpenAI',
      url: 'https://chatgpt.com/'
    });
    assert.strictEqual(chatgpt.categoryId, 'ai_technology');

    const hf = categorizer.categorize({
      title: 'Hugging Face - The AI community building the future',
      url: 'https://huggingface.co/models'
    });
    assert.strictEqual(hf.categoryId, 'ai_technology');

    const hn = categorizer.categorize({
      title: 'Hacker News - Y Combinator',
      url: 'https://news.ycombinator.com/'
    });
    assert.strictEqual(hn.categoryId, 'ai_technology');
  });

  await t.test('categorizes Career & Jobs bookmarks accurately', () => {
    const indeed = categorizer.categorize({
      title: 'Senior Software Engineer Jobs, Employment | Indeed.com',
      url: 'https://www.indeed.com/jobs?q=senior+software+engineer'
    });
    assert.strictEqual(indeed.categoryId, 'career_jobs');

    const levels = categorizer.categorize({
      title: 'Levels.fyi | Salaries & Compensation for Engineers',
      url: 'https://www.levels.fyi/'
    });
    assert.strictEqual(levels.categoryId, 'career_jobs');
  });

  await t.test('categorizes Education bookmarks accurately', () => {
    const coursera = categorizer.categorize({
      title: 'Machine Learning Specialization - Andrew Ng | Coursera',
      url: 'https://www.coursera.org/specializations/machine-learning-introduction'
    });
    assert.ok(['education', 'ai_technology'].includes(coursera.categoryId));

    const khan = categorizer.categorize({
      title: 'Khan Academy | Free Online Courses, Lessons & Practice',
      url: 'https://www.khanacademy.org/'
    });
    assert.strictEqual(khan.categoryId, 'education');
  });

  await t.test('categorizes Research bookmarks accurately', () => {
    const arxiv = categorizer.categorize({
      title: '[1706.03762] Attention Is All You Need',
      url: 'https://arxiv.org/abs/1706.03762'
    });
    assert.strictEqual(arxiv.categoryId, 'research');

    const pubmed = categorizer.categorize({
      title: 'PubMed Central - PMC Articles',
      url: 'https://pubmed.ncbi.nlm.nih.gov/31978945/'
    });
    assert.strictEqual(pubmed.categoryId, 'research');
  });

  await t.test('categorizes Finance bookmarks accurately', () => {
    const yahooFinance = categorizer.categorize({
      title: 'S&P 500 Index (^GSPC) Stock Price & News - Yahoo Finance',
      url: 'https://finance.yahoo.com/quote/%5EGSPC/'
    });
    assert.strictEqual(yahooFinance.categoryId, 'finance');

    const cmc = categorizer.categorize({
      title: 'Cryptocurrency Prices, Charts And Market Capitalizations | CoinMarketCap',
      url: 'https://coinmarketcap.com/'
    });
    assert.strictEqual(cmc.categoryId, 'finance');
  });

  await t.test('categorizes Entertainment bookmarks accurately', () => {
    const yt = categorizer.categorize({
      title: 'Interstellar Official Movie Trailer',
      url: 'https://www.youtube.com/watch?v=zSWdZVtXT7E'
    });
    assert.strictEqual(yt.categoryId, 'entertainment');

    const spotify = categorizer.categorize({
      title: 'Spotify - Top 50 Global Songs Playlist',
      url: 'https://open.spotify.com/playlist/37i9dQZEVXbMDoHDwVN2tF'
    });
    assert.strictEqual(spotify.categoryId, 'entertainment');
  });

  await t.test('uses folder metadata context to boost classification', () => {
    const res = categorizer.categorize({
      title: 'Dashboard Portal',
      url: 'https://example.com/app',
      folderPath: ['Old Folders', 'Job Search', 'Applications']
    });
    assert.strictEqual(res.categoryId, 'career_jobs');
  });

  await t.test('handles invalid URLs and fallback safely', () => {
    const invalid = categorizer.categorize({
      title: 'Unknown Thing',
      url: 'not-a-valid-url'
    });
    assert.strictEqual(invalid.categoryId, 'other');
    assert.strictEqual(invalid.confidence, 'none');

    const empty = categorizer.categorize(null);
    assert.strictEqual(empty.categoryId, 'other');
  });
});
