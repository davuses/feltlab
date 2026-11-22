import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  TRANSLATIONS,
  translateActionText,
  translateGrade,
  translateKey,
  translatePositionLabel,
  type TranslationKey,
} from './translations.ts';

describe('FeltLab i18n EN / zh-CN locale support', () => {
  it('maintains 100% key parity and non-empty values between en and zh-CN', () => {
    const enKeys = Object.keys(TRANSLATIONS.en).sort();
    const zhKeys = Object.keys(TRANSLATIONS['zh-CN']).sort();
    assert.deepEqual(zhKeys, enKeys);

    for (const key of enKeys as TranslationKey[]) {
      assert.ok(TRANSLATIONS.en[key].trim().length > 0, `Empty en value for ${key}`);
      assert.ok(TRANSLATIONS['zh-CN'][key].trim().length > 0, `Empty zh-CN value for ${key}`);
    }
  });

  it('translates poker grades, positions, and action text into Chinese', () => {
    assert.equal(translateGrade('zh-CN', 'Optimal'), '最优');
    assert.equal(translateGrade('zh-CN', 'Blunder'), '严重失误');
    assert.equal(translatePositionLabel('zh-CN', 'BTN'), 'BTN (按钮)');
    assert.equal(translateActionText('zh-CN', 'Raise to 7.5bb'), '加注至 7.5bb');
    assert.equal(translateActionText('zh-CN', '3-Bet'), '3-Bet');
    assert.equal(translateActionText('zh-CN', '4-Bet 21bb'), '4-Bet 21bb');
    assert.equal(translateActionText('zh-CN', 'Bet 33% Pot'), '下注 33% 底池');
    assert.equal(translateKey('zh-CN', 'nav.preflop'), '翻前范围');
    assert.equal(translateKey('en', 'nav.preflop'), 'Preflop');
  });
});
