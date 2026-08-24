import test from 'node:test';
import assert from 'node:assert/strict';

import { GTNewsStatus } from '../public/gt_news_status.js';
import { GTWorldRenderViewer, POPULAR_WORLDS } from '../public/world_render_viewer.js';

test('GTNewsStatus: news integrity and methods', () => {
  const news = new GTNewsStatus();
  assert.ok(Array.isArray(news.newsList), 'newsList should be an array');
  assert.ok(news.newsList.length >= 3, 'Should have at least 3 news articles');
  assert.ok(news.newsList[0].title, 'First news item must have title');
  assert.ok(news.newsList[0].badge, 'First news item must have badge');
  assert.equal(typeof news.fetchStatus, 'function', 'fetchStatus should be a function');
  assert.equal(typeof news.startLivePolling, 'function', 'startLivePolling should be a function');
});

test('GTWorldRenderViewer: world render urls and popular worlds', () => {
  assert.ok(POPULAR_WORLDS.includes('START'), 'POPULAR_WORLDS must include START');
  assert.ok(POPULAR_WORLDS.includes('SET'), 'POPULAR_WORLDS must include SET');

  const rv = new GTWorldRenderViewer();
  assert.equal(rv.currentWorld, 'START');
  assert.equal(typeof rv.loadWorld, 'function');
  assert.equal(typeof rv.importToWorldPlanner, 'function');

  // Test URL formation
  rv.loadWorld('buyghc');
  assert.equal(rv.currentWorld, 'BUYGHC');
  assert.equal(rv.imageUrl, 'https://s3.amazonaws.com/world.growtopiagame.com/buyghc.png');
});
