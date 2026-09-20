#!/usr/bin/env node
/**
 * ES5-spread guard — the executable version of ADR-0012 (根因 G10).
 *
 * WHY
 * ---
 * Cocos Creator's script packer (babel, ES5 target — no project-level switch,
 * the target is baked into packer-driver per platform) lowers *spread of a
 * non-array iterable* to `[].concat(x)`, which does **not** expand a Set/Map/
 * iterator/string. `[...set]` therefore silently becomes `[set]` (length 1) in
 * the shipped bundle while Node, vitest and `tsc` all stay green.
 *
 * G10 was exactly this: `patternColors()` returned length 1 in the web-mobile
 * build → every level failed `validateBeadsLevel` → `_boot()` early-returned →
 * all 8 levels were stuck at `phase = "boot"` on device.
 *
 * WHAT IS CHECKED
 * ---------------
 * Shipped TypeScript sources (framework `src/**` + each game's `src/**`, tests
 * and build output excluded — they never reach the Cocos packer) are compiled
 * with the real TypeScript **type checker**, then every spread position is
 * classified by the static type of its operand:
 *
 *   ES-01  array literal spread   `[...x]`
 *   ES-02  call spread            `f(...x)`   (babel emits `[].concat(...args)`)
 *   ES-03  rest destructuring     `const [a, ...r] = x`
 *
 * A spread is *safe* only when the operand is provably an Array/Tuple. Anything
 * else — Set/Map/WeakSet/WeakMap/iterator/string/`any`/unknown/exotic array-likes
 * such as NodeList — is a violation (fail-closed). `Array.from(x)` is the fix:
 * babel does not touch built-in statics, and the target runtime provably has
 * ES2015 built-ins (the bundle contains bare `new Set()` / `new Map()`, no
 * core-js polyfills).
 *
 * Escape hatch (use sparingly, it is greppable): append
 *   // es5-spread: allow <reason>
 * on the line *above* the spread, or on the same line.
 *
 * USAGE
 *   node tools/scripts/check-es5-spread.mjs            # source guard (CI, no Cocos needed)
 *   node tools/scripts/check-es5-spread.mjs --json
 *   node tools/scripts/check-es5-spread.mjs --dist     # optional post-build scan of build output
 *
 * Exit code 0 = clean, 1 = violations (or unparseable config — never a silent pass).
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const require = createRequire(import.meta.url);
const ts = require('typescript');

const args = process.argv.slice(2);
const AS_JSON = args.includes('--json');
const DIST_MODE = args.includes('--dist');

/** Packages whose *shipped* sources must satisfy the language contract. */
function collectConfigs() {
    const out = [{ config: join(ROOT, 'packages/framework/tsconfig.json'), src: join(ROOT, 'packages/framework/src') }];
    const gamesDir = join(ROOT, 'games');
    for (const name of safeReaddir(gamesDir)) {
        const gameDir = join(gamesDir, name);
        const cfg = join(gameDir, 'tsconfig.json');
        const src = join(gameDir, 'src');
        if (!existsDir(src)) continue;
        if (!existsSync(cfg)) {
            // K-031/K-033 判据：枚举清单漏项必须**会红**，而不是静默不扫。
            hardErrors.push(
                `games/${name}/src 存在但无 tsconfig.json —— 该游戏不进入守卫扫描面（新增游戏须同时建 tsconfig，否则本守卫不覆盖它）`,
            );
            continue;
        }
        out.push({ config: cfg, src });
    }
    return out.filter((e) => existsSync(e.config));
}

const hardErrors = [];

/** Files that are actually compiled into a Cocos/web bundle. */
function isShippedSource(fileName) {
    const rel = relative(ROOT, fileName).split(/[\\/]/).join('/');
    if (!/\.tsx?$/.test(rel) || rel.endsWith('.d.ts')) return false;
    if (rel.startsWith('packages/framework/src/')) return true;
    if (/^games\/[^/]+\/src\//.test(rel)) return true;
    // Derived copies: mirrored by framework:sync, checked by framework:sync:check.
    if (rel.includes('/cocos/assets/scripts/')) return false;
    return false;
}

const NON_ARRAY_ITERABLE = new Set([
    'Set', 'Map', 'WeakSet', 'WeakMap',
    'ReadonlySet', 'ReadonlyMap',
    'IterableIterator', 'Iterator', 'AsyncIterableIterator', 'AsyncIterator',
    'Generator', 'GeneratorFunction',
    'NodeList', 'HTMLCollection', 'Arguments',
    'TextDecoderStream', 'ReadableStream',
]);

/** Classify a spread operand. Returns { ok, why }. */
function classify(checker, type) {
    const safe = (why) => ({ ok: true, why });
    const bad = (why) => ({ ok: false, why });

    if (type.flags & ts.TypeFlags.Any) return bad('类型不可判定（any）——展开对象必须可证明是数组');
    if (type.flags & ts.TypeFlags.Unknown) return bad('类型不可判定（unknown）——展开对象必须可证明是数组');
    if (type.flags & (ts.TypeFlags.String | ts.TypeFlags.StringLiteral | ts.TypeFlags.TemplateLiteral)) {
        return bad('字符串不是数组：ES5 构建会把 [...str] 压成 [].concat(str)（不展开）');
    }
    if (type.isUnion()) {
        // `[...(aOrB)]` is only safe when *every* constituent is safe.
        const offenders = type.types
            .map((t) => classify(checker, t))
            .filter((r) => !r.ok);
        return offenders.length ? bad(`联合类型含非数组分支：${offenders[0].why}`) : safe('union');
    }
    if (type.isIntersection()) {
        const results = type.types.map((t) => classify(checker, t));
        return results.some((r) => r.ok) ? safe('intersection') : bad('交叉类型均非数组');
    }

    const symbolName = type.aliasSymbol?.name ?? type.getSymbol()?.name;
    const objectFlags = type.objectFlags ?? 0;
    const isArrayObj = !!(objectFlags & ts.ObjectFlags.Array);
    const isTupleObj = !!(objectFlags & ts.ObjectFlags.Tuple);
    // Numbered index signature + `Array`/`ReadonlyArray` symbol is the only shape
    // babel's `[].concat(x)` handles correctly.
    if (isArrayObj || isTupleObj || symbolName === 'Array' || symbolName === 'ReadonlyArray') {
        return safe(symbolName || 'array');
    }
    if (symbolName && NON_ARRAY_ITERABLE.has(symbolName)) {
        return bad(`${symbolName} 不是数组：展开会塌成长度 1 的 [${symbolName}]`);
    }
    if (symbolName === 'arguments') return bad('arguments 类数组对象在 ES5 构建下不展开');
    return bad(
        `不可证明为数组${symbolName ? `（${symbolName}）` : ''}——请用 Array.from(x)；` +
        'array-like（NodeList 等）同样会被压成 [].concat(x)',
    );
}

const violations = [];
/** framework src is pulled into every game program via `@wxgame/framework` paths — dedupe. */
const seenViolation = new Set();

function pushViolation(v) {
    const key = `${v.kind}|${v.file}|${v.line}|${v.expr}`;
    if (seenViolation.has(key)) return;
    seenViolation.add(key);
    violations.push(v);
}

function allowedAt(sf, pos) {
    const lines = sf.text.split('\n');
    const idx = sf.getLineAndCharacterOfPosition(pos).line;
    const thisLine = lines[idx] ?? '';
    const prevLine = idx > 0 ? lines[idx - 1] ?? '' : '';
    return /es5-spread:\s*allow/.test(thisLine) || /es5-spread:\s*allow/.test(prevLine);
}

function checkSf(program, checker, sf) {
    const report = (node, kind, expr, why) => {
        if (allowedAt(sf, node.getStart(sf))) return;
        const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
        const srcText = (expr.getText(sf) || '').replace(/\s+/g, ' ').slice(0, 60);
        pushViolation({
            kind,
            file: relative(ROOT, sf.fileName).split(/[\\/]/).join('/'),
            line: line + 1,
            expr: srcText,
            message: why,
        });
    };

    const inspect = (node, expr, kind) => {
        const type = checker.getTypeAtLocation(expr);
        const res = classify(checker, type);
        if (!res.ok) report(node, kind, expr, res.why);
    };

    const walk = (node) => {
        if (ts.isArrayLiteralExpression(node)) {
            for (const el of node.elements) {
                if (ts.isSpreadElement(el)) inspect(el, el.expression, 'ES-01 array-spread');
            }
        } else if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
            for (const a of node.arguments ?? []) {
                if (ts.isSpreadElement(a)) inspect(a, a.expression, 'ES-02 call-spread');
            }
        } else if (ts.isArrayBindingPattern(node)) {
            for (const el of node.elements) {
                if (!ts.isOmittedExpression(el) && el.dotDotDotToken) {
                    // `const [first, ...rest] = <expr>` — find what is being destructured.
                    let p = node.parent;
                    while (p && !(ts.isVariableDeclaration(p) || ts.isParameter(p))) p = p.parent;
                    if (ts.isVariableDeclaration(p) && p.initializer) {
                        inspect(el, p.initializer, 'ES-03 rest-destructure');
                    }
                }
            }
        }
        ts.forEachChild(node, walk);
    };

    if (!sf.isDeclarationFile) walk(sf);
}

// ───────────────────────────────────────────────────────── optional dist scan

function scanDist() {
    // Informational: after a Cocos build, list `[].concat(` emits so a human can
    // confirm none of them wraps a Set/Map/string. It cannot be a hard gate —
    // spreading a real array legitimately produces `[].concat(arr)` too.
    const found = [];
    for (const name of safeReaddir(join(ROOT, 'games'))) {
        const assets = join(ROOT, 'games', name, 'cocos', 'build');
        if (!existsSync(assets)) continue;
        for (const f of walkJs(assets)) {
            const text = readFileSync(f, 'utf8');
            const lines = text.split('\n');
            for (let i = 0; i < lines.length; i++) {
                const hits = lines[i].match(/\[\]\.concat\([^)]*\)/g) ?? [];
                for (const h of hits) found.push({ file: relative(ROOT, f), line: i + 1, hit: h.slice(0, 80) });
            }
        }
    }
    if (AS_JSON) console.log(JSON.stringify({ findings: found }, null, 2));
    else {
        console.log(`check-es5-spread --dist: ${found.length} \`[].concat(...)\` emit(s) to review:`);
        for (const f of found.slice(0, 40)) console.log(`  ${f.file}:${f.line}  ${f.hit}`);
        if (found.length > 40) console.log(`  … (+${found.length - 40})`);
    }
    return 0;
}

function walkJs(dir, out = []) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.')) continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walkJs(full, out);
        else if (/\.js$/.test(entry.name)) out.push(full);
    }
    return out;
}

// ─────────────────────────────────────────────────────────────────── helpers

function safeReaddir(dir) {
    try {
        return readdirSync(dir, { withFileTypes: true })
            .filter((e) => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules')
            .map((e) => e.name);
    } catch {
        return [];
    }
}

function existsDir(dir) {
    try {
        return statSync(dir).isDirectory();
    } catch {
        return false;
    }
}

// ─────────────────────────────────────────────────────────────────────── run

if (DIST_MODE) {
    process.exit(scanDist());
}

let scannedFiles = 0;
const scanned = new Set();
for (const { config: configPath, src: srcDir } of collectConfigs()) {
    const relCfg = relative(ROOT, configPath);
    const read = ts.readConfigFile(configPath, ts.sys.readFile);
    if (read.error) {
        console.error(`check-es5-spread: cannot read ${relCfg} — ${read.error.messageText}`);
        process.exit(1);
    }
    const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, dirname(configPath));
    if (parsed.errors?.length) {
        console.error(`check-es5-spread: bad tsconfig ${relCfg}`);
        for (const e of parsed.errors.slice(0, 5)) console.error(`  ${ts.flattenDiagnosticMessageText(e.messageText, ' ')}`);
        process.exit(1);
    }
    const program = ts.createProgram(parsed.fileNames, parsed.options);
    const checker = program.getTypeChecker();
    let perConfig = 0;
    for (const sf of program.getSourceFiles()) {
        if (!isShippedSource(sf.fileName)) continue;
        if (scanned.has(sf.fileName)) continue;
        scanned.add(sf.fileName);
        scannedFiles++;
        perConfig++;
        checkSf(program, checker, sf);
    }
    // 同上判据：一个登记在册的 program 扫出 0 个入库文件 = 扫描面静默落空。
    if (perConfig === 0) {
        hardErrors.push(`${relCfg} 的 program 未扫到任何 ${relative(ROOT, srcDir)}下的源文件（include/scope 已漂移）`);
    }
}

violations.sort((a, b) => (a.file + a.line).localeCompare(b.file + b.line));

if (AS_JSON) {
    console.log(JSON.stringify({ scannedFiles, hardErrors, violations }, null, 2));
} else {
    for (const e of hardErrors) console.log(`FAIL  [ES-00 scope] ${e}`);
    for (const v of violations) {
        console.log(`FAIL  [${v.kind}] ${v.file}:${v.line}  ${v.expr}`);
        console.log(`        ${v.message}`);
    }
    if (violations.length === 0 && hardErrors.length === 0) {
        console.log(`check-es5-spread: OK — ${scannedFiles} shipped source file(s), no non-array spread.`);
    } else {
        console.log(
            `\ncheck-es5-spread: ${violations.length} violation(s)` +
            (hardErrors.length ? `, ${hardErrors.length} scope error(s)` : '') +
            '. 用 Array.from(x) 替换展开 — 见 ADR-0012。',
        );
    }
}

process.exit(violations.length === 0 && hardErrors.length === 0 ? 0 : 1);
