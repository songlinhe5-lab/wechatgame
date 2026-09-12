/**
 * commitlint 细粒度规则 — WXG-T-016
 * 规则说明 / scope 适用路径 / 正反示例：docs/ci/commit-and-review-rules.md
 *
 * 拦截点：
 *  1. type-enum        仓库惯用类型（含设计专用 design）
 *  2. scope-enum       对齐仓库实际分区；scope-empty: never 强制带 scope
 *  3. header-max-length 100；subject 禁句号结尾（中英文都拦）；subject-case 全关（中文兼容）
 *  4. task-id-required 整条信息必须含 WXG-T-<数字> 或 issue 引用 #<数字>（可追溯任务单）
 *
 * 自定义规则注册方式（2026-09-12 修复）：commitlint 要求自定义规则经
 * `plugins: [{ rules: {...} }]` 数组对象注册，`rules` 表内只写 [级别, 应用, ...] 配置；
 * 直接把函数内联进 rules 会报 "Found rules without implementation" 崩溃。
 *
 * @type {import('@commitlint/types').UserConfig}
 */

/** @type {Record<string, (parsed: any) => [boolean, string]>} */
const localRules = {
  // 整条信息（header+body+footer）须可追溯任务单
  // 注意：@commitlint/load 在加载期会以 undefined 调用一次自定义规则，必须先做空参守卫
  'task-id-required': (parsed) => {
    if (!parsed || typeof parsed !== 'object') return [true, ''];
    const raw = typeof parsed.raw === 'string' ? parsed.raw : '';
    const ok = /WXG-T-\d+|#\d+/.test(raw);
    return [
      ok,
      '整条提交信息（header/body/footer 任意位置）必须包含任务单号 WXG-T-<数字> 或 issue 引用 #<数字>',
    ];
  },

  // subject 不允许中文句号结尾
  'subject-no-cn-stop': (parsed) => {
    if (!parsed || typeof parsed !== 'object') return [true, ''];
    const subject = typeof parsed.subject === 'string' ? parsed.subject : '';
    const ok = !subject.endsWith('。');
    return [ok, 'subject 不允许中文句号「。」结尾'];
  },
};

export default {
  extends: ['@commitlint/config-conventional'],
  plugins: [{ rules: localRules }],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'docs', 'design', 'refactor', 'perf', 'test', 'chore', 'ci', 'build', 'revert'],
    ],
    'scope-enum': [
      2,
      'always',
      [
        'framework',
        'breakout',
        'beads',
        'harness',
        'levels',
        'qa',
        'epics',
        'architecture',
        'art',
        'ux',
        'audio',
        'memory',
        'release',
        'tools',
        'agents',
        'ci',
        'deps',
      ],
    ],
    // 粒度要求：必须带 scope，不允许裸 type
    'scope-empty': [2, 'never'],
    'header-max-length': [2, 'always', 100],
    // 英文句号结尾
    'subject-full-stop': [2, 'never', '.'],
    // 中文句号结尾（自定义规则，实现见上方 localRules）
    'subject-no-cn-stop': [2, 'always'],
    // 中文 subject 兼容：关闭全部大小写类规则
    'subject-case': [0],
    'type-empty': [2, 'never'],
    'subject-empty': [2, 'never'],

    // 整条信息（header+body+footer）须可追溯任务单（自定义规则，实现见上方 localRules）
    'task-id-required': [2, 'always'],
  },
};
