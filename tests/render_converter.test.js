import test from 'node:test';
import assert from 'node:assert/strict';

import { GTRenderConverter, BLOCK_SIGNATURES } from '../public/render_converter.js';

test('GTRenderConverter: signatures integrity', () => {
  assert.ok(BLOCK_SIGNATURES.length >= 10, 'Should have at least 10 core block signatures');
  const bedrock = BLOCK_SIGNATURES.find(s => s.name === 'Bedrock');
  assert.ok(bedrock, 'Bedrock signature must exist');
  assert.equal(bedrock.id, 10, 'Bedrock ID must be 10');

  const castle = BLOCK_SIGNATURES.find(s => s.name === 'Castle Wall');
  assert.ok(castle, 'Castle Wall signature must exist');
  assert.equal(castle.id, 278, 'Castle Wall ID must be 278');

  assert.equal(typeof GTRenderConverter.convertRenderToWorldBlocks, 'function');
});
