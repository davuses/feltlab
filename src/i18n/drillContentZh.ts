import type { Locale } from './translations';
import { translateActionText, translateArchetype, translateMathCategory, translateStreetLabel } from './translations';
import type { PreflopSpotTemplate } from '../poker/preflopRanges';
import type { PostflopDrillSpot } from '../poker/postflopSpots';
import type { HandReadingSpot } from '../poker/handReadingSpots';
import type { MathDrillQuestion } from '../poker/mathDrills';

interface PreflopZhCopy {
  title: string;
  subtitle: string;
  actionSummary: string;
  strategyNote: string;
}

const PREFLOP_ZH: Record<string, PreflopZhCopy> = {
  'rfi-utg': {
    title: 'UTG 率先开池 (RFI)',
    subtitle: '6人桌 · 100bb · 枪口位率先行动',
    actionSummary: '轮到你在 UTG (枪口位) 率先行动。',
    strategyNote:
      '身后还有 5 位玩家待行动，UTG 开池范围需保持紧凑（约 17% 组合），优先保留强口袋对、同花大牌与高张牌力，果断弃掉容易被压制的杂色小 A 和弱同花连张。',
  },
  'rfi-hj': {
    title: 'HJ 率先开池 (RFI)',
    subtitle: '6人桌 · 100bb · 劫持位率先行动',
    actionSummary: 'UTG 弃牌，轮到你在 HJ (劫持位) 行动。',
    strategyNote:
      '在劫持位（约 22% 开池率）可进一步放宽范围，加入所有同花小 A（A2s+）、K9s、Q9s、J9s 以及中等同花连张，并补充 ATo 与 KJo 以增强各牌面覆盖率。',
  },
  'rfi-co': {
    title: 'CO 率先开池 (RFI)',
    subtitle: '6人桌 · 100bb · 关煞位率先行动',
    actionSummary: 'UTG 与 HJ 均弃牌，轮到你在 CO (关煞位) 行动。',
    strategyNote:
      '关煞位开池率约 29%。身后仅剩按钮位与大小盲，所有口袋对（22+）、低至 K6s 的同花 K、同花隔张（J8s、T8s、97s）以及 A9o/KTo 均成为正 EV 偷盲组合。',
  },
  'rfi-btn': {
    title: 'BTN 率先开池 (RFI)',
    subtitle: '6人桌 · 100bb · 按钮位率先行动',
    actionSummary: '前面全员弃牌，轮到你在 BTN (按钮位) 行动。',
    strategyNote:
      '按钮位拥有翻后绝对位置优势，开池率高达约 45%——几乎所有口袋对、全部同花 A 与同花 K、低至 Q3s 的同花 Q、同花连张以及低至 A5o 的杂色 A 都值得率先加注。',
  },
  'rfi-sb': {
    title: 'SB 率先开池 (RFI)',
    subtitle: '6人桌 · 100bb · 盲注对决（加注或弃牌策略）',
    actionSummary: '前面全员弃牌，小盲位直接对阵大盲位。',
    strategyNote:
      '在 100bb 简化的纯加注/弃牌策略中，小盲位用约 42% 的范围加注至 3.0bb，既能压制大盲位的免费看牌权益，也能在面对大盲 3-Bet 时维持足够强韧的不利位置范围。',
  },
  'vs-open-btn-co': {
    title: 'BTN 面对 CO 开池',
    subtitle: '6人桌 · 100bb · 面对关煞位 2.5bb 开池加注',
    actionSummary: 'CO 开池 2.5bb，轮到你在 BTN (按钮位) 行动。',
    strategyNote:
      '在按钮位面对 CO 开池，应构建“线性强牌 + 同花阻挡牌”的 3-Bet 范围（QQ+、AK、AQs、A5s–A4s、KQs），同时用中等口袋对、同花连张与可玩性高的大牌平跟入池。',
  },
  'vs-open-bb-btn': {
    title: 'BB 防守 BTN 开池',
    subtitle: '6人桌 · 100bb · 大盲位面对按钮位 2.5bb 开池',
    actionSummary: 'BTN 开池 2.5bb，SB 弃牌，轮到你在 BB (大盲位) 行动。',
    strategyNote:
      '大盲位关闭行动且享有极佳底池赔率（跟注 1.5bb 赢取 5.5bb 底池，仅需约 27% 胜率），防守率高达约 55%：用两极化强价值牌（TT+、AQs+、AKo、KQs）搭配同花小 A / 同花 K 阻挡牌进行 3-Bet，其余宽广的同花与连张牌型直接平跟防守。',
  },
  'vs-open-sb-btn': {
    title: 'SB 面对 BTN 开池（高频率 3-Bet）',
    subtitle: '6人桌 · 100bb · 小盲位面对按钮位 2.5bb 开池',
    actionSummary: 'BTN 开池 2.5bb，轮到你在 SB (小盲位) 行动，身后大盲尚未表态。',
    strategyNote:
      '小盲位翻后处于不利位置且身后大盲随时可能挤压加注，因此几乎采用纯 3-Bet 或弃牌策略（约 16% 3-Bet），以 88+、A9s+、KTs+、QTs+、JTs、AJo+、KQo 和 A5s 线性反击按钮位的宽开池。',
  },
  'vs-3bet-btn-bb': {
    title: 'BTN 面对 BB 3-Bet',
    subtitle: '6人桌 · 100bb · 我方开池 2.5bb，大盲 3-Bet 至 10bb',
    actionSummary: '你在 BTN 开池 2.5bb，大盲位 3-Bet 至 10bb。',
    strategyNote:
      '在有利位置面对大盲 10bb 的 3-Bet，按钮位约防守开池范围的 46%：用 KK+、AK 与带阻挡牌的两极化诈唬（A5s、A4s、KQo）进行 4-Bet，用高可玩性的口袋对、同花大牌与同花连张跟注打翻后。',
  },
  'vs-3bet-co-btn': {
    title: 'CO 面对 BTN 3-Bet',
    subtitle: '6人桌 · 100bb · 我方开池 2.5bb，按钮位 3-Bet 至 7.5bb',
    actionSummary: '你在 CO 开池 2.5bb，按钮位 3-Bet 至 7.5bb。',
    strategyNote:
      '不利位置面对紧实的按钮位 3-Bet 时，CO 需收紧防守范围：用 QQ+、AK 搭配 A5s/KJs 作为 4-Bet 组合，避免在无位置的大底池中处于封顶劣势，同时平跟 TT–77 与强同花大牌。',
  },
};

export function localizePreflopTemplate(
  locale: Locale,
  template: PreflopSpotTemplate
): PreflopSpotTemplate {
  if (locale === 'en') return template;
  const zh = PREFLOP_ZH[template.id];
  if (!zh) return template;
  return {
    ...template,
    title: zh.title,
    subtitle: zh.subtitle,
    actionSummary: zh.actionSummary,
    strategyNote: zh.strategyNote,
  };
}

interface PostflopZhCopy {
  title: string;
  takeaways: {
    boardTexture: string;
    rangeAdvantage: string;
    blockerNote: string;
    coreRule: string;
  };
}

const POSTFLOP_ZH: Record<string, PostflopZhCopy> = {
  'pf-srp-btn-bb-a72r': {
    title: 'BTN 在干燥 A 高彩虹面持续下注',
    takeaways: {
      boardTexture: '极度干燥、分散的 A 高彩虹牌面，几乎不存在顺子或同花听牌。',
      rangeAdvantage: 'BTN 持有全部 AA、AK、AQ、AJ，面对翻前平跟封顶的大盲范围拥有压倒性的范围与坚果优势。',
      blockerNote: 'KQo 阻挡了大盲的后门大牌组合，同时小尺度下注能极高效率地打弃大盲的 6x–5x 边缘底牌，榨取大量弃牌率。',
      coreRule: '在干燥牌面拥有绝对范围优势时，应高频使用 25%–33% 底池的小尺度进行全范围持续下注。',
    },
  },
  'pf-srp-co-bb-765tt': {
    title: 'CO 在低连张湿润面过牌控池',
    takeaways: {
      boardTexture: '高度连接的低张双花牌面，两对、暗三条与顺子组合极其密集。',
      rangeAdvantage: '大盲位完美击中 7-6-5 结构（98s、84s、76s、75s、65s 及 55–77），CO 完全没有坚果优势。',
      blockerNote: 'AKo 带有后门坚果同花潜质与两张高张，直接随后过牌既能安全实现胜率，又能避免遭遇大盲凶狠的过牌加注。',
      coreRule: '在低连张湿润面上切忌机械化持续下注，大盲握有坚果优势时要大幅提高过牌频率。',
    },
  },
  'pf-srp-bb-btn-xr-984': {
    title: 'BB 面对小尺度 C-Bet 过牌加注半诈唬',
    takeaways: {
      boardTexture: '动态 9 高彩虹牌面，按钮位高频小尺度下注范围较宽，抗压能力偏弱。',
      rangeAdvantage: '大盲范围保留了大量 98s、94s、84s、44 和 88 等超强牌型，支撑两极化的过牌加注策略。',
      blockerNote: 'JTs 拥有 8 张干净的两头顺补牌、两张高张以及后门同花听牌，是顶级的半诈唬加注牌型。',
      coreRule: '持有高胜率两头顺听牌搭配高张时，积极过牌加注可同步扩大价值底池并打弃对手的空气牌。',
    },
  },
  'pf-3bp-btn-co-k94r': {
    title: '3-Bet 底池有利位置在干燥 K 高面范围下注',
    takeaways: {
      boardTexture: '低筹码底池比（SPR 5.6）的静态 K 高彩虹面，牌面变化极小。',
      rangeAdvantage: 'BTN 完整保留 AA、KK、AK 和 KQs，而 CO 翻前未 4-Bet 导致几乎不含 KK 与 AK。',
      blockerNote: 'QJs 拥有卡顺听牌与后门同花听牌，小尺度持续下注能直接迫使对手的 AQo、AJo 及 66–88 陷入两难甚至弃牌。',
      coreRule: '在有利位置的 3-Bet 底池干燥 A/K 高牌面上，全范围 25%–33% 小额持续下注是最稳健的高 EV 打法。',
    },
  },
  'pf-3bp-sb-btn-qjt-oop': {
    title: '3-Bet 底池不利位置在单花大牌面保守过牌',
    takeaways: {
      boardTexture: '单花 Q-J-T 大牌连接面，双方范围内都充斥着同花、顺子与两对等超强坚果。',
      rangeAdvantage: '在没有关键花色 A 阻挡牌的情况下，口袋 AA 面对成手同花、顺子与两对已退化为脆弱的抓诈唬牌。',
      blockerNote: '手中两张 AA 均不带牌面同花，也未阻挡 K9s/98s 顺子；选择过牌能有效保护不利位置的过牌范围。',
      coreRule: '在单花强连接翻牌面上，不含同花阻挡牌的超对优先过牌控池，避免把大底池打成逆风局。',
    },
  },
  'pf-srp-utg-bb-turn-overcard': {
    title: '转牌发出高张干净牌后的大尺度开火',
    takeaways: {
      boardTexture: '转牌发出的高张 K 极大提升了 UTG 的整体胜率，且牌面同花听牌仍未成型。',
      rangeAdvantage: 'UTG 坐拥 KK、AK、KQ、KT 等强 K 组合，而大盲翻牌跟注范围主要集中在 Tx、6x 等抓诈唬牌型。',
      blockerNote: '顶对顶踢脚在转牌必须两极化加大尺度，向对手的 Tx、6x 以及卡顺听牌收取高额跟注代价。',
      coreRule: '当转牌高张强烈偏向翻前加注者范围时，果断放大下注尺度（75%–125% 底池）施压。',
    },
  },
  'pf-srp-bb-co-turn-call-fd': {
    title: 'BB 持强组合听牌在转牌防守 75% 续枪',
    takeaways: {
      boardTexture: '转牌发出的 6 让我方构成两头顺 + 同花超级组合听牌（共 15 张有效补牌，河牌胜率约 34%）。',
      rangeAdvantage: 'CO 的 75% 转牌续枪呈现 Kx+ 强价值与诈唬的两极结构；跟注所需底池赔率仅为 29.9%。',
      blockerNote: '单凭直接底池赔率已属正 EV 跟注，加上河牌击中隐蔽非同花顺子时还有丰厚的隐含赔率。',
      coreRule: '在转牌决定是否弃掉听牌前，务必把直接补牌胜率与隐含赔率同所需底池赔率逐一比对。',
    },
  },
  'pf-3bp-btn-bb-turn-checkback': {
    title: '3-Bet 底池转牌有利位置中等摊牌价值控池',
    takeaways: {
      boardTexture: '大盲翻牌持续下注后，转牌发出无关空白张并选择过牌。',
      rangeAdvantage: '口袋 JJ 正处于按钮位范围的中段——大幅领先大盲的空气牌、TT、99，但明显落后于 Qx 与慢打的 AA/KK 陷阱。',
      blockerNote: '此时下注只会打跑我们领先的弱牌，并在面对慢打 Qx 或过牌加注陷阱时平白把底池做大。',
      coreRule: '有利位置的中等摊牌牌力在转牌应优先随后过牌控池，留待河牌抓诈唬或打薄价值。',
    },
  },
  'pf-srp-btn-bb-river-thin-value': {
    title: '河牌空白张上有利位置打薄价值',
    takeaways: {
      boardTexture: '河牌发出干净低张白板，所有听牌均告落空，大盲范围里堆满较弱的 Jx 与 8x。',
      rangeAdvantage: 'BTN 范围未封顶，仍包含暗三条与超对；AJ 顶对顶踢脚明显领先大盲绝大多数抓诈唬牌。',
      blockerNote: '在河牌直接随后过牌会白白错失巨额期望值，50% 底池的中等尺度能精准吸引更差的 Jx 与 8x 支付。',
      coreRule: '当对手行动线明显封顶且听牌全数落空时，敢于在河牌用强顶对打出精准薄价值。',
    },
  },
  'pf-srp-bb-btn-river-bluffcatch-blockers': {
    title: '河牌持坚果同花阻挡牌精准抓诈唬',
    takeaways: {
      boardTexture: '翻牌听花在河牌正式成花，BTN 打出两极化的 70% 底池重注。',
      rangeAdvantage: '跟注需要 29.2% 的胜率；大盲位必须挑选带有关键阻挡牌的顶端抓诈唬牌型完成防守。',
      blockerNote: '手中单张成花花色 A 精准阻挡了 BTN 最高频的坚果同花价值组合，同时完全不阻挡其错失的顺子诈唬牌。',
      coreRule: '河牌抓诈唬的核心标准：优先保留能阻挡对手坚果价值牌、且不阻挡对手诈唬范围的手牌。',
    },
  },
  'pf-srp-co-bb-river-bluff-blockers': {
    title: '河牌利用顺子阻挡牌实施两极化诈唬',
    takeaways: {
      boardTexture: 'Q-T-9 牌面上的卡顺 + 高张听牌在河牌全部落空，KJ 毫无摊牌价值。',
      rangeAdvantage: 'CO 范围能完整代表 KJ/J8 顺子、QQ、TT 及 QT 两对，而大盲多半封顶在单对 Qx/Tx。',
      blockerNote: '手握 K 与 J 同时阻挡了大盲最强的坚果顺子抓诈唬组合（KJ、J8），却未阻挡那些被迫弃牌的错失听牌与弱对子。',
      coreRule: '挑选河牌诈唬牌时，优先使用零摊牌价值且强力阻挡对手核心跟注范围的组合。',
    },
  },
  'pf-3bp-bb-btn-river-fold-overbet': {
    title: '面对河牌两极化超池全下纪律弃牌',
    takeaways: {
      boardTexture: '最糟糕的河牌——高张 A 既完成了同花听牌，也让对手翻牌跟注的 Ax 浮牌全部反超。',
      rangeAdvantage: 'BTN 转牌主动下注接河牌全下，范围极度两极化，核心集中在同花、AK、A8 与暗三条。',
      blockerNote: '口袋 TT 不带同花阻挡牌，几乎打不过对手任何价值牌，反而阻挡了对手错失的 JT/T9 诈唬组合。',
      coreRule: '切忌用“阻挡对手诈唬、又缺少价值阻挡牌”的边缘抓诈唬牌去支付河牌超池全下。',
    },
  },
};

function localizePostflopLogLine(locale: Locale, line: string): string {
  if (locale === 'en') return line;
  return translateActionText(locale, line)
    .replace(/,/g, '，')
    .replace(/:/g, '：')
    .replace(/\(/g, '（')
    .replace(/\)/g, '）')
    .replace(/轮到\s*([A-Z]{2,3})/g, '轮到 $1 行动');
}

export function localizePostflopSpot(
  locale: Locale,
  spot: PostflopDrillSpot
): PostflopDrillSpot {
  if (locale === 'en') return spot;
  const zh = POSTFLOP_ZH[spot.id];
  if (!zh) return spot;
  return {
    ...spot,
    title: zh.title,
    actionLog: spot.actionLog.map((line) => localizePostflopLogLine(locale, line)),
    takeaways: zh.takeaways,
  };
}

interface HandReadingZhCopy {
  title: string;
  streetLabel: string;
  timeline: {
    street: string;
    detail: string;
    narrowingHint: string;
  }[];
  promptQuestion: string;
  explanation: string;
  keyCombosNote: string;
}

const HAND_READING_ZH: Record<string, HandReadingZhCopy> = {
  'hr-utg-cbet-check-turn': {
    title: 'UTG 转牌随后过牌后的封顶范围',
    streetLabel: '转牌圈 · 单次加注底池 · 100bb',
    timeline: [
      {
        street: '翻前',
        detail: 'UTG 开池 2.5bb，BB 跟注防守。',
        narrowingHint: 'UTG 起手范围较紧（约 17%）：66+、A9s+、KTs+、QTs+、JTs、T9s、AJo+、KQo。',
      },
      {
        street: '翻牌 K♠ 8♦ 3♣',
        detail: 'BB 过牌，UTG 持续下注 3.5bb，BB 跟注。',
        narrowingHint: 'UTG 在干燥 K 高面几乎全范围持续下注，保留口袋对、Kx 以及大牌高张。',
      },
      {
        street: '转牌 2♥',
        detail: 'BB 过牌，UTG 随后过牌。',
        narrowingHint: 'AA、KK、AK、KQ、88 通常会在转牌继续开火拿价值；随后过牌使 UTG 范围封顶在中等对子、弱 Kx 与 A 高摊牌牌。',
      },
    ],
    promptQuestion: '请框选 UTG 在 K♠ 8♦ 3♣ 2♥ 转牌随后过牌后的保留范围。',
    explanation:
      '当 UTG 在 K-8-3 翻牌持续下注、并在空白 2♥ 转牌选择随后过牌时，其最强的价值组合（AA、KK、88、AK、KQ）大概率会继续下注。因此 UTG 的过牌范围明显封顶在中等口袋对（QQ–99、77–66）、偏弱的 Kx（KJs、KTs）以及带摊牌价值的 A 高组合。',
    keyCombosNote: '实战要点：若河牌继续发白板，由于 UTG 几乎缺乏 AA/KK/AK 等顶端坚果，面对我方大尺度两极探针下注将承受巨大压力。',
  },
  'hr-bb-xr-low-board': {
    title: 'BB 在 8♠ 7♠ 3♦ 低连张面的两极化过牌加注范围',
    streetLabel: '翻牌圈 · 单次加注底池 · 100bb',
    timeline: [
      {
        street: '翻前',
        detail: 'CO 开池 2.5bb，BB 跟注防守。',
        narrowingHint: 'BB 翻前平跟范围排除了通常会 3-Bet 的 JJ+、AK、AQs，保留了中低口袋对、同花连张与同花隔张。',
      },
      {
        street: '翻牌 8♠ 7♠ 3♦',
        detail: 'BB 过牌，CO 持续下注 2.0bb（33%），BB 过牌加注至 7.0bb。',
        narrowingHint: '过牌加注将 BB 范围两极化：强价值（两对与暗三条）搭配高胜率的顺子/同花半诈唬。',
      },
    ],
    promptQuestion: '请选出 BB 在翻牌圈的两极化过牌加注范围（强价值 + 半诈唬）。',
    explanation:
      'BB 在 8♠ 7♠ 3♦ 牌面的过牌加注围绕坚果价值牌（88、77、33、87）展开，并用强两头顺听牌（T9s、65s、96s）、带后门听牌的卡顺（J9s、64s、54s）及坚果同花听牌（A5s、A4s）做平衡。A8 或 K7 这类中等单对更倾向平跟。',
    keyCombosNote: '注意：AA–JJ 不会出现在这里，因为 BB 翻前就会用它们进行 3-Bet。',
  },
  'hr-btn-3bet-double-barrel': {
    title: 'BTN 在 3-Bet 底池 Q♦ 9♣ 4♦ 2♠ 转牌连开第二枪范围',
    streetLabel: '转牌圈 · 3-Bet 底池 · 100bb',
    timeline: [
      {
        street: '翻前',
        detail: 'CO 开池 2.5bb，BTN 3-Bet 至 7.5bb，CO 跟注。',
        narrowingHint: 'BTN 的 3-Bet 范围由线性强价值（JJ+、AK、AQs、KQs）和同花小 A / 同花大牌诈唬（A5s–A4s、KJs、QJs、JTs）构成。',
      },
      {
        street: '翻牌 Q♦ 9♣ 4♦',
        detail: 'CO 过牌，BTN 持续下注 5.5bb，CO 跟注。',
        narrowingHint: 'BTN 高频小尺度范围下注，翻牌圈仍混杂不少未击中的空气与听牌。',
      },
      {
        street: '转牌 2♠',
        detail: 'CO 过牌，BTN 连开第二枪 14.5bb（55% 底池）。',
        narrowingHint: '在白板转牌上，BTN 会用中等摊牌对子（JJ/TT）过牌控池，转而用强 Qx+、超对、暗三条以及方块同花/顺子听牌继续施压。',
      },
    ],
    promptQuestion: '请还原 BTN 在 Q♦ 9♣ 4♦ 2♠ 转牌连开第二枪的保留范围。',
    explanation:
      '在 3-Bet 底池的 2♠ 空白转牌上，BTN 的第二枪趋于两极化：厚价值组合（AA、KK、QQ、99、AQ、KQ、QJs）搭配高胜率方块同花听牌与顺子听牌（AKs、AJs、A5s、A4s、KJs、JTs）；而 JJ、TT 等中等牌力则选择随后过牌控制底池。',
    keyCombosNote: 'BTN 此处价值约占 55%、半诈唬约占 45%，CO 必须用强 Qx 与优质听牌继续防守。',
  },
  'hr-co-river-overbet': {
    title: 'CO 在 A♥ J♠ 6♣ 3♠ 2♦ 河牌两极化超池重注范围',
    streetLabel: '河牌圈 · 单次加注底池 · 100bb',
    timeline: [
      {
        street: '翻前',
        detail: 'CO 开池 2.5bb，BB 跟注防守。',
        narrowingHint: '标准约 29% 的 CO 开池范围。',
      },
      {
        street: '翻牌 A♥ J♠ 6♣ → 转牌 3♠',
        detail: 'CO 翻牌下注 33%、转牌下注 75%，BB 两条街均跟注。',
        narrowingHint: '转牌 75% 大尺度筛掉了弱 Jx 与小对子；CO 保留强 Ax+、暗三条、两对以及黑桃/顺子听牌。',
      },
      {
        street: '河牌 2♦',
        detail: 'BB 过牌，CO 打出 120% 底池超池重注。',
        narrowingHint: '错失的黑桃听牌与 KQ/KT 卡顺转为诈唬；薄单对 AT–A8 随后过牌摊牌，只有两对以上、暗三条、AK 与错失听牌会超池下注。',
      },
    ],
    promptQuestion: '请框选 CO 在河牌 120% 超池下注的两极化范围（坚果价值 + 错失听牌）。',
    explanation:
      '河牌 120% 底池超池下注要求高度两极化：CO 会用中等顶对（AT、A9、A8）过牌摊牌，用两对以上、暗三条与 AK 拿超额价值，并以错失的 KQ/KT/QT 顺子听牌和黑桃听牌（T9s、98s、87s、75s）作为平衡诈唬。',
    keyCombosNote: '观察矩阵中段（QQ、KK、Jx、弱 Ax）在两极化河牌超池下注中几乎完全清空的特征。',
  },
};

export function localizeHandReadingSpot(
  locale: Locale,
  spot: HandReadingSpot
): HandReadingSpot {
  if (locale === 'en') return spot;
  const zh = HAND_READING_ZH[spot.id];
  if (!zh) return spot;
  return {
    ...spot,
    title: zh.title,
    streetLabel: zh.streetLabel,
    timeline: zh.timeline,
    promptQuestion: zh.promptQuestion,
    explanation: zh.explanation,
    keyCombosNote: zh.keyCombosNote,
  };
}

const DRAW_SCENARIO_ZH: Record<string, string> = {
  'Nut Flush Draw on Flop': '翻牌圈坚果同花听牌',
  'Open-Ended Straight Draw on Turn': '转牌圈两头顺听牌',
  'Monster Combo Draw (OESD + Flush) on Flop': '翻牌圈两头顺 + 同花超级组合听牌',
  'Flush Draw + Overcard on Turn': '转牌圈同花听牌 + 高张',
};

export function localizeMathQuestion(
  locale: Locale,
  q: MathDrillQuestion
): MathDrillQuestion {
  if (locale === 'en') return q;

  const multPct = Math.round((q.betBb / Math.max(0.1, q.potBb)) * 100);
  const potBeforeCall = Number((q.potBb + q.betBb).toFixed(1));
  const finalPot = Number((potBeforeCall + q.betBb).toFixed(1));

  if (q.category === 'POT_ODDS') {
    return {
      ...q,
      categoryLabel: translateMathCategory(locale, q.categoryLabel),
      prompt: `底池为 ${q.potBb}bb，对手下注 ${q.betBb}bb（${multPct}% 底池）。你的跟注至少需要多少胜率（%）才能达到盈亏平衡？`,
      contextLine: `6人桌 · 100bb · 下注前底池：${q.potBb}bb · 面对下注 ${q.betBb}bb`,
      formulaSteps: [
        `跟注后的最终总底池 = ${q.potBb} + ${q.betBb} + ${q.betBb} = ${finalPot.toFixed(1)}bb`,
        `最低所需胜率 = 跟注额 / 最终总底池 = ${q.betBb} / ${finalPot.toFixed(1)} = ${q.exactAnswer}%`,
      ],
      takeaway:
        '牢记四个核心尺度锚点：33% 底池需 20% 胜率，50% 底池需 25%，75% 底池需 30%，满池（100%）需 33.3%。',
    };
  }

  if (q.category === 'OUTS_EQUITY') {
    const streetZh = q.board?.length === 3 ? '翻牌圈' : '转牌圈';
    const scenarioEn =
      Object.keys(DRAW_SCENARIO_ZH).find((k) => q.prompt.includes(k)) ?? '';
    const scenarioZh = DRAW_SCENARIO_ZH[scenarioEn] ?? '听牌对抗';
    const outsMatch = q.contextLine.match(/(\d+)\s+direct outs/);
    const cleanOuts = outsMatch ? Number(outsMatch[1]) : 9;
    const reqEq = q.breakEvenPct ?? 0;
    const heroEq = q.heroEquityPct ?? q.exactAnswer;

    return {
      ...q,
      categoryLabel: translateMathCategory(locale, q.categoryLabel),
      prompt: `当前处于${streetZh}（${scenarioZh}），对抗对手亮出的底牌，请估算你的精确全下胜率（%）。`,
      contextLine: `6人桌 · ${streetZh} · 检测到 ${cleanOuts} 张干净补牌 · 面对 ${q.betBb}bb 下注需 ${reqEq}% 胜率`,
      formulaSteps: [
        `下一张牌直接反超的干净补牌数：${cleanOuts} 张 Outs`,
        q.board?.length === 3
          ? `4倍速算法：${cleanOuts} × 4 ≈ ${Math.min(72, cleanOuts * 4)}%（精确组合/蒙特卡洛胜率：${heroEq}%）`
          : `转牌到河牌精确算法：${cleanOuts} / 44 = ${heroEq}%`,
        `对比底池赔率（${reqEq}%）：${heroEq >= reqEq ? '直接跟注即为正 EV（+EV）' : '直接胜率不足，需要隐含赔率支撑跟注'}`,
      ],
      takeaway:
        '翻牌“乘以 4”、转牌“乘以 2”是极速心算基准；当补牌达到 12 张以上时，因存在重复计数需略微下调 2%–4%。',
    };
  }

  if (q.category === 'CALL_EV') {
    const equityPct = q.heroEquityPct ?? 30;
    const reqEq = q.breakEvenPct ?? 0;
    const winPart = ((equityPct / 100) * potBeforeCall).toFixed(2);
    const losePart = (((100 - equityPct) / 100) * q.betBb).toFixed(2);

    return {
      ...q,
      categoryLabel: translateMathCategory(locale, q.categoryLabel),
      prompt: `当前底池 ${q.potBb}bb，对手在河牌下注 ${q.betBb}bb。你的抓诈唬牌对抗对手范围有 ${equityPct}% 胜率，此时跟注的期望值 EV 是多少（单位：bb）？`,
      contextLine: `6人桌 · 河牌圈 · 跟注前底池：${potBeforeCall}bb · 需跟注：${q.betBb}bb · 胜率：${equityPct}%`,
      formulaSteps: [
        'EV(跟注) = (胜率 × 赢得的底池) − (败率 × 跟注成本)',
        `EV(跟注) = (${(equityPct / 100).toFixed(2)} × ${potBeforeCall}bb) − (${((100 - equityPct) / 100).toFixed(2)} × ${q.betBb}bb)`,
        `EV(跟注) = ${winPart}bb − ${losePart}bb = ${q.exactAnswer >= 0 ? '+' : ''}${q.exactAnswer}bb`,
      ],
      takeaway: `只要实际胜率高于底池赔率阈值（${reqEq}%），跟注就严格优于弃牌（0.00bb），属于正 EV 决策。`,
    };
  }

  // MDF_BLUFF
  const isMdf = q.categoryLabel.includes('Minimum Defense');
  return {
    ...q,
    categoryLabel: translateMathCategory(locale, q.categoryLabel),
    prompt: isMdf
      ? `河牌圈底池 ${q.potBb}bb，对手下注 ${q.betBb}bb（${multPct}% 底池）。你至少需要保持多少最小防守频率（MDF %），才能防止对手用任意空气牌无脑诈唬盈利？`
      : `河牌圈底池 ${q.potBb}bb，你用被跟注后 0% 胜率的空气牌诈唬下注 ${q.betBb}bb（${multPct}% 底池）。对手至少需要以多大频率（%）弃牌，你的诈唬才能盈亏平衡？`,
    contextLine: `6人桌 · 河牌博弈理论 · 底池：${q.potBb}bb · 下注：${q.betBb}bb（${multPct}%）`,
    formulaSteps: isMdf
      ? [
          'MDF = 底池 / (底池 + 下注额)',
          `代入计算：MDF = ${q.potBb} / (${q.potBb} + ${q.betBb}) = ${q.exactAnswer}%`,
        ]
      : [
          '诈唬盈亏平衡弃牌率 (α) = 下注额 / (底池 + 下注额)',
          `代入计算：α = ${q.betBb} / (${q.potBb} + ${q.betBb}) = ${q.exactAnswer}%`,
        ],
    takeaway:
      'MDF 与诈唬所需弃牌率 α 之和恒等于 100%。下注尺度越大，防守方需要防守的比例越低，诈唬方需要打弃对手的频率越高。',
  };
}

const HAND_RANK_ZH: Record<string, string> = {
  'Royal Flush': '皇家同花顺',
  'Straight Flush': '同花顺',
  'Four of a Kind': '四条',
  'Full House': '葫芦',
  Flush: '同花',
  Straight: '顺子',
  'Three of a Kind': '三条',
  'Two Pair': '两对',
  'One Pair': '一对',
  'High Card': '高牌',
};

export function localizeWinnerSummary(locale: Locale, summary: string | null): string {
  if (!summary) return '';
  if (locale === 'en') return summary;

  const uncontested = summary.match(/^(.+?)\s+wins\s+([\d.]+)bb\s+uncontested\.$/);
  if (uncontested) {
    const winner = uncontested[1].replace(/^Hero\b/, '我方 (Hero)');
    return `${winner} 直接拿下 ${uncontested[2]}bb 底池（对手全弃）。`;
  }

  const showdown = summary.match(/^(.+?)\s+wins\s+([\d.]+)bb\s+with\s+(.+)\.$/);
  if (showdown) {
    const winner = showdown[1].replace(/\bHero\b/g, '我方 (Hero)');
    const handZh = HAND_RANK_ZH[showdown[3]] ?? showdown[3];
    return `${winner} 凭借「${handZh}」赢得 ${showdown[2]}bb 底池。`;
  }

  return summary;
}

export function localizeArenaNote(locale: Locale, note: string): string {
  if (locale === 'en' || !note) return note;

  let out = note;

  // Base decision notes
  out = out.replace(
    /Strong holding \(([^)]+)\) builds value by betting\/raising on (\w+)\./,
    (_, hand: string, st: string) =>
      `强牌（${hand}）在${translateStreetLabel(locale, st)}适合通过下注或加注积极做大价值底池。`
  );
  out = out.replace(
    /High-equity draw with preflop initiative makes a strong semi-bluff c-bet on (\w+)\./,
    (_, st: string) =>
      `手握高胜率听牌且占据翻前主动权，在${translateStreetLabel(locale, st)}非常适合做半诈唬持续下注。`
  );
  out = out.replace(
    /Weak showdown value prefers checking or selective bluffing rather than thin betting\./,
    '摊牌价值偏弱，优先选择过牌控池或挑选带阻挡牌的时机诈唬，不宜强行打薄价值。'
  );
  out = out.replace(
    /Medium strength hand plays cleanly as a check for pot control on (\w+)\./,
    (_, st: string) => `中等牌力在${translateStreetLabel(locale, st)}选择过牌控池最为稳健。`
  );
  out = out.replace(
    /High equity vs current bet supports raising for value and protection\./,
    '对抗当前下注具备高胜率优势，支持加注获取价值并保护手牌权益。'
  );
  out = out.replace(
    /Hand strength clears required pot odds \((\d+)%\)—calling is \+EV\./,
    (_, pct: string) => `当前牌力已超过底池赔率门槛（${pct}%），跟注属于正 EV 选择。`
  );
  out = out.replace(
    /Facing ([\d.]+)bb requires (\d+)% equity; folding preserves stack\./,
    (_, toCall: string, pct: string) =>
      `面对 ${toCall}bb 下注需要 ${pct}% 胜率，此时弃牌能有效止损保住筹码。`
  );

  // Opponent-specific exploitative notes
  out = out.replace(
    /\s*Exploit vs ([^()]+) \(Calling Station\): size up value bets—they call too wide\./,
    (_, name: string) =>
      ` 针对 ${name.trim()}（跟注站）的剥削建议：对手跟注范围过宽，强牌可直接放大价值下注尺度。`
  );
  out = out.replace(
    /\s*Exploit vs ([^()]+) \(Calling Station\): avoid low-equity bluffs that rarely fold them out\./,
    (_, name: string) =>
      ` 针对 ${name.trim()}（跟注站）的剥削建议：减少低胜率纯诈唬，很难把对手打弃。`
  );
  out = out.replace(
    /\s*Exploit vs ([^()]+) \(Tight Nit\): respect heavy aggression—their continuing range is value-heavy\./,
    (_, name: string) =>
      ` 针对 ${name.trim()}（紧弱 Nit）的剥削建议：尊重其重注进攻，对手继续行动的范围高度偏向强价值。`
  );
  out = out.replace(
    /\s*Exploit vs ([^()]+) \(Tight Nit\): steady pressure steals pots when they miss\./,
    (_, name: string) =>
      ` 针对 ${name.trim()}（紧弱 Nit）的剥削建议：持续施压能频繁在对手错过牌面时偷下底池。`
  );
  out = out.replace(
    /\s*Exploit vs ([^()]+) \(([^)]+)\): widen bluff-catching calls against over-aggression\./,
    (_, name: string, arch: string) =>
      ` 针对 ${name.trim()}（${translateArchetype(locale, arch)}）的剥削建议：对手进攻频率过高，可适当放宽抓诈唬跟注范围。`
  );
  out = out.replace(
    /\s*Note vs ([^()]+) \(TAG\): keep ranges disciplined and watch blockers on wet boards\./,
    (_, name: string) =>
      ` 对抗 ${name.trim()}（紧凶 TAG）提示：保持范围纪律，在湿润牌面重点留意阻挡牌。`
  );
  out = out.replace(
    /\s*Note vs ([^()]+) \(Balanced Reg\): mix value and draw semi-bluffs to stay unexploitable\./,
    (_, name: string) =>
      ` 对抗 ${name.trim()}（均衡常客）提示：混合强价值与听牌半诈唬，避免被对手读死。`
  );

  return out;
}

const TITLE_EN_TO_ZH: Record<string, string> = {
  // Preflop
  'UTG Open (RFI)': PREFLOP_ZH['rfi-utg'].title,
  'HJ Open (RFI)': PREFLOP_ZH['rfi-hj'].title,
  'CO Open (RFI)': PREFLOP_ZH['rfi-co'].title,
  'BTN Open (RFI)': PREFLOP_ZH['rfi-btn'].title,
  'SB Open (RFI)': PREFLOP_ZH['rfi-sb'].title,
  'BTN vs CO Open': PREFLOP_ZH['vs-open-btn-co'].title,
  'BB vs BTN Open': PREFLOP_ZH['vs-open-bb-btn'].title,
  'SB vs BTN Open (3-Bet Heavy)': PREFLOP_ZH['vs-open-sb-btn'].title,
  'BTN Facing BB 3-Bet': PREFLOP_ZH['vs-3bet-btn-bb'].title,
  'CO Facing BTN 3-Bet': PREFLOP_ZH['vs-3bet-co-btn'].title,
  // Postflop
  'BTN C-Bet on Dry Ace-High Rainbow': POSTFLOP_ZH['pf-srp-btn-bb-a72r'].title,
  'CO C-Bet Check-Back on Low Connected Board': POSTFLOP_ZH['pf-srp-co-bb-765tt'].title,
  'BB Check-Raise Semi-Bluff vs Small C-Bet': POSTFLOP_ZH['pf-srp-bb-btn-xr-984'].title,
  '3-Bet Pot Range Bet IP on K-High Dry': POSTFLOP_ZH['pf-3bp-btn-co-k94r'].title,
  '3-Bet Pot OOP Polarized Check on Wet Broadway': POSTFLOP_ZH['pf-3bp-sb-btn-qjt-oop'].title,
  'Turn Overbet Barrel on Clean Overcard': POSTFLOP_ZH['pf-srp-utg-bb-turn-overcard'].title,
  'BB Turn Defense with Combo Draw vs 75% Barrel': POSTFLOP_ZH['pf-srp-bb-co-turn-call-fd'].title,
  'BTN Turn Pot Control IP with Medium Showdown Value': POSTFLOP_ZH['pf-3bp-btn-bb-turn-checkback'].title,
  'River Thin Value Sizing IP on Brick Runout': POSTFLOP_ZH['pf-srp-btn-bb-river-thin-value'].title,
  'River Bluff-Catch with Nut Flush Blocker': POSTFLOP_ZH['pf-srp-bb-btn-river-bluffcatch-blockers'].title,
  'River Polarized Bluff with Straight Blocker': POSTFLOP_ZH['pf-srp-co-bb-river-bluff-blockers'].title,
  'Disciplined River Fold vs Polarized Overbet': POSTFLOP_ZH['pf-3bp-bb-btn-river-fold-overbet'].title,
  // Hand reading
  'Capped UTG Range After Turn Check-Back': HAND_READING_ZH['hr-utg-cbet-check-turn'].title,
  'BB Polarized Check-Raise Range on 8♠ 7♠ 3♦': HAND_READING_ZH['hr-bb-xr-low-board'].title,
  'BTN 3-Bet Double Barrel Range on Q♦ 9♣ 4♦ 2♠': HAND_READING_ZH['hr-btn-3bet-double-barrel'].title,
  'Polarized CO River Jam on A♥ J♠ 6♣ 3♠ 2♦': HAND_READING_ZH['hr-co-river-overbet'].title,
};

export function localizeSpotLabel(locale: Locale, spotLabel: string): string {
  if (locale === 'en') return spotLabel;
  if (TITLE_EN_TO_ZH[spotLabel]) return TITLE_EN_TO_ZH[spotLabel];

  // Preflop format: "<Title> (<handKey>)"
  const preflopMatch = spotLabel.match(/^(.+?)\s+\(([AKQJT98765432]{2}[so]?)\)$/);
  if (preflopMatch && TITLE_EN_TO_ZH[preflopMatch[1]]) {
    return `${TITLE_EN_TO_ZH[preflopMatch[1]]} (${preflopMatch[2]})`;
  }

  // Math format: "<Category> (<pot>bb pot / <bet>bb bet)"
  const mathMatch = spotLabel.match(/^(.+?)\s+\(([\d.]+)bb pot \/ ([\d.]+)bb bet\)$/);
  if (mathMatch) {
    return `${translateMathCategory(locale, mathMatch[1])}（底池 ${mathMatch[2]}bb / 下注 ${mathMatch[3]}bb）`;
  }

  // Arena format: "6-Max Hand #3 (flop)"
  const arenaMatch = spotLabel.match(/^(\d+)-Max Hand #(\d+) \((\w+)\)$/);
  if (arenaMatch) {
    return `${arenaMatch[1]}人桌 第 ${arenaMatch[2]} 手（${translateStreetLabel(locale, arenaMatch[3])}）`;
  }

  return spotLabel;
}
