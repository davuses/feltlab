import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  TRANSLATIONS,
  translateActionText,
  translateGrade,
  translateKey,
  translateMathCategory,
  translatePositionLabel,
  translateQuickPreset,
  type TranslationKey,
} from './translations.ts';
import {
  localizeArenaNote,
  localizeHandReadingSpot,
  localizeMathQuestion,
  localizePostflopSpot,
  localizePreflopTemplate,
  localizeSpotLabel,
  localizeWinnerSummary,
} from './drillContentZh.ts';
import { PREFLOP_TEMPLATES } from '../poker/preflopRanges.ts';
import { POSTFLOP_BLUEPRINTS, generatePostflopSpot } from '../poker/postflopSpots.ts';
import { HAND_READING_SPOTS, QUICK_RANGE_PRESETS } from '../poker/handReadingSpots.ts';
import { generateMathQuestion, type MathDrillCategory } from '../poker/mathDrills.ts';

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

  it('uses idiomatic Chinese poker terminology without stiff translationese', () => {
    const bannedTerms = ['求解器', '工作室', 'EV 审计', '重合度审计', '残存', '出牌速度', '连击', 'Firestore', '花色旋转'];
    for (const [key, val] of Object.entries(TRANSLATIONS['zh-CN'])) {
      for (const banned of bannedTerms) {
        assert.ok(
          !val.includes(banned),
          `Found awkward term "${banned}" in zh-CN key "${key}": ${val}`
        );
      }
    }
  });

  it('translates poker grades, positions, and action text into Chinese', () => {
    assert.equal(translateGrade('zh-CN', 'Optimal'), '最优');
    assert.equal(translateGrade('zh-CN', 'Acceptable'), '合理');
    assert.equal(translateGrade('zh-CN', 'Blunder'), '严重失误');
    assert.equal(translatePositionLabel('zh-CN', 'BTN'), 'BTN (按钮)');
    assert.equal(translateActionText('zh-CN', 'Raise to 7.5bb'), '加注至 7.5bb');
    assert.equal(translateActionText('zh-CN', '3-Bet'), '3-Bet');
    assert.equal(translateActionText('zh-CN', '4-Bet 21bb'), '4-Bet 21bb');
    assert.equal(translateActionText('zh-CN', 'Bet 33% Pot'), '下注 33% 底池');
    assert.equal(translateActionText('zh-CN', 'Check-Raise 6.5bb'), '过牌加注 6.5bb');
    assert.equal(translateActionText('zh-CN', 'Overbet 125% (13.1bb)'), '超池下注 125% (13.1bb)');
    assert.equal(translateActionText('zh-CN', 'Posts SB 0.5bb'), '下小盲 0.5bb');
    assert.equal(translateActionText('zh-CN', 'Raise All-In 62bb'), '加注全下 62bb');
    assert.equal(translateKey('zh-CN', 'nav.preflop'), '翻前范围');
    assert.equal(translateKey('en', 'nav.preflop'), 'Preflop');
  });

  it('translates every real QUICK_RANGE_PRESETS label and math category into Chinese', () => {
    for (const label of Object.keys(QUICK_RANGE_PRESETS)) {
      const zh = translateQuickPreset('zh-CN', label);
      assert.notEqual(zh, label, `Untranslated quick preset: ${label}`);
      assert.match(zh, /[\u4e00-\u9fff]/, `Expected Chinese chars for preset ${label}, got ${zh}`);
    }

    const mathLabels = [
      'Pot Odds & Required Equity',
      'Outs & Hand Equity',
      'Expected Value (EV in bb)',
      'Minimum Defense Frequency (MDF)',
      'Bluff Break-Even Frequency',
    ];
    for (const label of mathLabels) {
      const zh = translateMathCategory('zh-CN', label);
      assert.notEqual(zh, label, `Untranslated math category: ${label}`);
      assert.match(zh, /[\u4e00-\u9fff]/, `Expected Chinese chars for math category ${label}`);
    }
  });

  it('localizes 100% of preflop templates, postflop spots, hand reading spots, and math drills', () => {
    for (const tpl of PREFLOP_TEMPLATES) {
      const zh = localizePreflopTemplate('zh-CN', tpl);
      assert.notEqual(zh.title, tpl.title, `Missing zh preflop title for ${tpl.id}`);
      assert.notEqual(zh.strategyNote, tpl.strategyNote, `Missing zh preflop note for ${tpl.id}`);
      assert.match(zh.actionSummary, /[\u4e00-\u9fff]/);
    }

    for (const bp of POSTFLOP_BLUEPRINTS) {
      const spot = generatePostflopSpot(bp.street, bp.potType, bp.heroInPosition ? 'IP' : 'OOP');
      const zh = localizePostflopSpot('zh-CN', {
        ...spot,
        id: bp.id,
        title: bp.title,
        actionLog: bp.actionLog,
        takeaways: bp.takeaways,
      });
      assert.notEqual(zh.title, bp.title, `Missing zh postflop title for ${bp.id}`);
      assert.match(zh.takeaways.coreRule, /[\u4e00-\u9fff]/);
      for (const line of zh.actionLog) {
        assert.match(line, /[\u4e00-\u9fff]/, `Untranslated postflop actionLog line: ${line}`);
      }
    }

    for (const spot of HAND_READING_SPOTS) {
      const zh = localizeHandReadingSpot('zh-CN', spot);
      assert.notEqual(zh.promptQuestion, spot.promptQuestion, `Missing zh hand reading for ${spot.id}`);
      assert.equal(zh.timeline.length, spot.timeline.length);
      assert.match(zh.explanation, /[\u4e00-\u9fff]/);
    }

    const mathCats: MathDrillCategory[] = ['POT_ODDS', 'OUTS_EQUITY', 'CALL_EV', 'MDF_BLUFF'];
    for (const cat of mathCats) {
      const q = generateMathQuestion(cat, () => 0.25);
      const zh = localizeMathQuestion('zh-CN', q);
      assert.match(zh.prompt, /[\u4e00-\u9fff]/, `Untranslated math prompt for ${cat}`);
      assert.match(zh.takeaway, /[\u4e00-\u9fff]/, `Untranslated math takeaway for ${cat}`);
      assert.ok(zh.formulaSteps.every((s) => /[\u4e00-\u9fff]/.test(s)));
    }
  });

  it('localizes Bot Arena EV audit notes, winner summaries, and Leak Tracker spot labels', () => {
    const note =
      'Hand strength clears required pot odds (25%)—calling is +EV. Exploit vs Bot Luna (Calling Station): size up value bets—they call too wide.';
    const zhNote = localizeArenaNote('zh-CN', note);
    assert.ok(zhNote.includes('底池赔率门槛（25%）'));
    assert.ok(zhNote.includes('跟注站'));
    assert.ok(!zhNote.includes('Exploit vs'));

    const winUncontested = localizeWinnerSummary('zh-CN', 'Hero (BTN) wins 8.5bb uncontested.');
    assert.ok(winUncontested.includes('我方 (Hero)'));
    assert.ok(winUncontested.includes('8.5bb'));

    const winShowdown = localizeWinnerSummary('zh-CN', 'Bot Kai (BB) wins 24bb with Full House.');
    assert.ok(winShowdown.includes('葫芦'));
    assert.ok(winShowdown.includes('24bb'));

    assert.equal(
      localizeSpotLabel('zh-CN', 'BTN Open (RFI) (AKs)'),
      'BTN 率先开池 (RFI) (AKs)'
    );
    assert.equal(
      localizeSpotLabel('zh-CN', '6-Max Hand #4 (flop)'),
      '6人桌 第 4 手（翻牌圈）'
    );
  });
});
