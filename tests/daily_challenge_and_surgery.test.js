import test from 'node:test';
import assert from 'node:assert/strict';

import { GTDailyChallenge, CHALLENGE_POOL, CLASH_EVENTS } from '../public/daily_challenge.js';
import { GTSurgerySimulator, SURGERY_TOOLS, SURGERY_DIAGNOSES } from '../public/surgery_simulator.js';

test('GTDailyChallenge: calculations and pool integrity', () => {
  assert.ok(CHALLENGE_POOL.length >= 5, 'Challenge pool should have at least 5 challenges');
  assert.ok(CLASH_EVENTS.length >= 3, 'Clash events should have at least 3 events');

  const dc = new GTDailyChallenge();
  const gtTime = dc.getGrowtopiaTime();
  assert.ok(gtTime instanceof Date, 'Should return Date object');

  const { hours, minutes, seconds } = dc.getTimeUntilReset();
  assert.equal(hours.length, 2, 'Hours must be zero-padded');
  assert.equal(minutes.length, 2, 'Minutes must be zero-padded');
  assert.equal(seconds.length, 2, 'Seconds must be zero-padded');

  const { dateKey, challenges } = dc.getTodaysChallenges();
  assert.ok(dateKey, 'Must produce valid dateKey');
  assert.equal(challenges.length, 3, 'Should produce 3 daily challenges');
  assert.ok(challenges[0].title, 'Challenge must have title');
  assert.ok(challenges[0].targetAmount > 0, 'Target amount must be > 0');
});

test('GTSurgerySimulator: hospital operating state machine and tools', () => {
  assert.equal(SURGERY_TOOLS.length, 11, 'Should have 11 official surgical tools');
  assert.ok(SURGERY_DIAGNOSES.length >= 5, 'Should have at least 5 surgical diagnoses');

  const surge = new GTSurgerySimulator();
  surge.startNewSurgery();

  assert.equal(surge.active, true, 'Surgery should be active');
  assert.ok(surge.patient, 'Patient must exist');
  assert.ok(surge.patient.diagnosis, 'Patient diagnosis must exist');

  // Tool tests: Anesthetic
  surge.useTool('anesthetic');
  assert.equal(surge.patient.status, 'Anesthetized', 'Patient should be anesthetized');
  assert.ok(surge.patient.anesthesiaDuration > 0, 'Anesthesia duration must be positive');

  // Scalpel test
  const initialIncisions = surge.patient.incisions;
  surge.useTool('scalpel');
  assert.equal(surge.patient.incisions, initialIncisions + 1, 'Scalpel should increase incisions');

  // Sponge test
  surge.patient.bleeding = 2;
  surge.useTool('sponge');
  assert.equal(surge.patient.bleeding, 0, 'Sponge should clean bleeding');

  // Antibiotic test
  surge.patient.temp = 104;
  surge.useTool('antibiotic');
  assert.ok(surge.patient.temp < 104, 'Antibiotic should lower fever');

  // Stitches test
  const incBeforeStitch = surge.patient.incisions;
  surge.useTool('stitches');
  assert.equal(surge.patient.incisions, incBeforeStitch - 1, 'Stitches should close incision');
});
