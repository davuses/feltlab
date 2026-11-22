import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rulesPath = path.resolve(process.cwd(), 'DRAFT_firestore.rules');
const blueprintPath = path.resolve(process.cwd(), 'firebase-blueprint.json');

test('security rules enforce default deny, verified auth, validation blueprints, and secure list queries', () => {
  const rules = fs.readFileSync(rulesPath, 'utf8');
  const blueprint = JSON.parse(fs.readFileSync(blueprintPath, 'utf8'));

  assert.match(rules, /rules_version\s*=\s*'2';/);
  assert.match(rules, /match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;/);
  assert.match(rules, /request\.auth\.token\.email_verified == true/);
  assert.match(rules, /function isValidUserProfile\(data\)/);
  assert.match(rules, /function isValidDrillAttempt\(data\)/);
  assert.match(rules, /data\.keys\(\)\.hasAll\(/);
  assert.match(rules, /data\.keys\(\)\.hasOnly\(/);
  assert.match(rules, /incoming\(\)\.diff\(existing\(\)\)\.affectedKeys\(\)\.hasOnly\(/);
  assert.match(rules, /incoming\(\)\.createdAt == request\.time/);
  assert.match(rules, /incoming\(\)\.updatedAt == request\.time/);
  assert.match(rules, /incoming\(\)\.createdAt == existing\(\)\.createdAt/);
  assert.match(rules, /allow list:\s*if isOwner\(userId\)\s*&& resource\.data\.uid == request\.auth\.uid;/);

  // Verify every blueprint collection path has a corresponding match block
  const paths = Object.keys(blueprint.firestore);
  assert.ok(paths.includes('/users/{userId}'));
  assert.ok(paths.includes('/users/{userId}/attempts/{attemptId}'));
  assert.match(rules, /match \/users\/\{userId\}/);
  assert.match(rules, /match \/attempts\/\{attemptId\}/);

  // Verify Dirty Dozen boundaries match blueprint constants
  const maxSpotLabel = blueprint.entities.DrillAttempt.properties.spotLabel.maxLength;
  assert.equal(maxSpotLabel, 120);
  assert.match(rules, new RegExp(`data\\.spotLabel\\.size\\(\\) <= ${maxSpotLabel}`));
});
