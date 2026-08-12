#!/usr/bin/env bun
/**
 * next-version.mjs — is main due a release, and at what version? (#595)
 *
 * Ports the trigger/bump policy from claude-kit's scripts/next-version.py (선례,
 * Lyainc/claude-kit). FILME diverges from that precedent in two ways the issue
 * decided explicitly:
 *   - no lockstep manifest bump — package.json's `version` stays untouched
 *     (private:true, never read for deploy/install), so a release here is just a
 *     git tag + GitHub Release, never a commit. That also means the loop-safety
 *     concern claude-kit's release.yml carries (its own bump commit re-firing the
 *     push trigger) doesn't apply — nothing this script's caller does pushes a
 *     commit to main.
 *   - no curated per-plugin release notes (gen-release-notes.py) — the workflow
 *     uses `gh release create --generate-notes` as-is (#595 "결정: 자동 생성분만").
 *     So this file only needs the decide/bump half, not the Conventional-Commit-
 *     to-category grouping claude-kit's gen-release-notes.py does.
 *
 * Policy (same as claude-kit RELEASING.md):
 *   1. PRIMARY trigger — a PR merged carrying the `release` label. Always releases,
 *      even docs-only (explicit human "ship this" outranks the backstop).
 *   2. BACKSTOP — N (default 70, see #595 for the threshold math: ~weekly at this
 *      repo's commit rate) unreleased USER-VISIBLE commits, label or not.
 *
 *   User-visible = feat / fix / perf / refactor, plus anything breaking.
 *   docs / chore / test / ci / build / style never trigger alone — they ride
 *   along into the next release once something else fires it.
 *
 *   Bump, from the same commit set, largest change wins:
 *     breaking (`!` or a BREAKING CHANGE: body)  -> major
 *     feat                                       -> minor
 *     any other user-visible commit               -> patch
 *
 * Usage:
 *   bun scripts/next-version.mjs [--labeled] [--backstop 70] [--to HEAD]
 *   bun scripts/next-version.mjs --self-test
 *
 * Writes `key=value` lines on stdout, ready for GitHub Actions' $GITHUB_OUTPUT:
 *   release=true|false
 *   version=X.Y.Z        (empty when release=false)
 *   reason=<one line>
 *   visible=<count of unreleased user-visible commits>
 *
 * Exit codes: 0 = decided (release true or false — both are success), 2 = usage/IO error.
 */
import { execFileSync } from 'node:child_process';

const USER_VISIBLE_TYPES = new Set(['feat', 'fix', 'perf', 'refactor']);
const DEFAULT_BACKSTOP = 70;

// `type(scope)!: subject` or `type: subject`. scope and `!` optional.
const HEADER_RE = /^(?<type>[a-z]+)(?:\([^)]*\))?(?<bang>!)?:\s*(?<subject>.+)$/;

function ctype(commit) {
  const m = HEADER_RE.exec(commit.subject);
  return m ? m.groups.type : null;
}

// Anchored to a footer line (Conventional Commits' `BREAKING CHANGE: ...` trailer),
// not an unanchored substring — otherwise a commit that merely *mentions* the phrase
// (e.g. "NOT a BREAKING CHANGE for existing callers") would wrongly major-bump.
const BREAKING_FOOTER_RE = /^BREAKING CHANGE:/m;

function isBreaking(commit) {
  const m = HEADER_RE.exec(commit.subject);
  return Boolean(m?.groups.bang) || BREAKING_FOOTER_RE.test(commit.body ?? '');
}

function isUserVisible(commit) {
  return USER_VISIBLE_TYPES.has(ctype(commit)) || isBreaking(commit);
}

/** Largest change in the set wins. `current` is the last released version. */
function bump(current, commits) {
  const [major, minor, patch] = current.split('.').slice(0, 3).map(Number);
  if (commits.some(isBreaking)) return `${major + 1}.0.0`;
  if (commits.some((c) => ctype(c) === 'feat')) return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

/** The whole policy, as a pure function — this is what the self-test pins. */
function decide(commits, current, labeled, backstop = DEFAULT_BACKSTOP) {
  const visible = commits.filter(isUserVisible);

  // Nothing at all since the last tag: there is no release to cut. This is also
  // what would keep a workflow from looping if anything ever did push a commit.
  if (commits.length === 0) {
    return { release: false, version: '', visible: 0, reason: 'no commits since the last tag' };
  }

  if (labeled) {
    return {
      release: true,
      version: bump(current, commits),
      visible: visible.length,
      reason: 'a PR merged with the `release` label',
    };
  }

  if (visible.length >= backstop) {
    return {
      release: true,
      version: bump(current, commits),
      visible: visible.length,
      reason: `backstop: ${visible.length} unreleased user-visible commits (>= ${backstop})`,
    };
  }

  return {
    release: false,
    version: '',
    visible: visible.length,
    reason: `no \`release\` label, and only ${visible.length} user-visible commit(s) since the last tag (backstop is ${backstop})`,
  };
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' });
}

/**
 * The last RELEASED tag, inclusive of `toRef` itself (a tag ON HEAD means already
 * released). `--match` restricts this to vX.Y.Z tags this script itself could have
 * cut — this repo carries older non-release snapshot tags (e.g. `wizard-final`),
 * and without the filter `git describe` would happily return one of those as "the
 * last release", while currentVersion() (below) would reject it and fall back to
 * 0.0.0 — a mismatch where the commit *range* is bounded by a tag the version math
 * doesn't believe in, which manufactured a false release covering months of
 * already-shipped work the first time this ran against real history.
 */
function lastTag(toRef) {
  try {
    return git(['describe', '--tags', '--abbrev=0', '--match', 'v[0-9]*.[0-9]*.[0-9]*', toRef]).trim() || null;
  } catch {
    return null; // no semver tag reachable — nothing has been released by this policy yet
  }
}

/** The version we are bumping FROM. No manifest fallback (package.json's version is unmanaged, #595) — first release starts from 0.0.0. */
function currentVersion(tag) {
  const m = tag?.match(/^v?(\d+\.\d+\.\d+)/);
  return m ? m[1] : '0.0.0';
}

/** {sha, subject, body}[] for fromRef..toRef (fromRef null = walk from repo root). */
function collectCommits(fromRef, toRef) {
  const range = fromRef ? `${fromRef}..${toRef}` : toRef;
  const raw = git(['log', '--format=%x00%H%x1f%s%x1f%b', range]);
  return raw
    .split('\x00')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const [sha, subject, body] = chunk.split('\x1f');
      return { sha, subject: (subject ?? '').trim(), body: body ?? '' };
    });
}

function parseArgs(argv) {
  const args = { labeled: false, backstop: DEFAULT_BACKSTOP, to: 'HEAD', selfTest: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--labeled') args.labeled = true;
    else if (a === '--backstop') args.backstop = Number(argv[++i]);
    else if (a === '--to') args.to = argv[++i];
    else if (a === '--self-test') args.selfTest = true;
    else {
      console.error(`unknown argument: ${a}`);
      process.exit(2);
    }
  }
  return args;
}

function main(argv) {
  const args = parseArgs(argv);
  if (args.selfTest) return selfTest();

  let tag, commits;
  try {
    tag = lastTag(args.to);
    commits = collectCommits(tag, args.to);
  } catch (err) {
    console.error(`error: git failed: ${err.message}`);
    return 2;
  }

  const result = decide(commits, currentVersion(tag), args.labeled, args.backstop);
  for (const key of ['release', 'version', 'reason', 'visible']) {
    console.log(`${key}=${result[key]}`);
  }
  console.error(
    `\n${result.release ? 'RELEASE' : 'HOLD'} — ${result.reason} (since ${tag ?? '<no tag>'}: ${commits.length} commit(s), ${result.visible} user-visible)`,
  );
  return 0;
}

// ---------------------------------------------------------------------------
// Self-test — the policy is the thing worth pinning, so it is tested as a pure
// function over synthetic commit lists (no git, no network). ponytail: non-trivial
// branching logic (decide/bump) doesn't ship without this.
// ---------------------------------------------------------------------------
function c(subject, body = '') {
  return { subject, body };
}

function selfTest() {
  const cases = [];
  const check = (name, got, want) => {
    const ok = got === want;
    cases.push({ name: `${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`, ok });
  };

  const fix = c('fix(x): a');
  const feat = c('feat(x): b');
  const docs = c('docs: c');
  const chore = c('chore: d');
  const breaking = c('feat(x)!: e');
  const breakingBody = c('fix(x): f', 'BREAKING CHANGE: gone');
  const breakingMentionNegated = c('fix(x): g', 'note this is NOT a BREAKING CHANGE for existing callers');

  check('fix is user-visible', isUserVisible(fix), true);
  check('feat is user-visible', isUserVisible(feat), true);
  check('docs is NOT user-visible', isUserVisible(docs), false);
  check('chore is NOT user-visible', isUserVisible(chore), false);
  check('breaking `!` is user-visible', isUserVisible(breaking), true);
  check('BREAKING CHANGE body is user-visible', isUserVisible(breakingBody), true);
  check('a body merely mentioning/negating BREAKING CHANGE is NOT breaking (not a footer trailer)', isBreaking(breakingMentionNegated), false);
  check('a non-conventional subject is not user-visible', isUserVisible(c('wip')), false);

  check('fixes only -> patch', bump('4.0.1', [fix, fix]), '4.0.2');
  check('a feat -> minor', bump('4.0.1', [fix, feat]), '4.1.0');
  check('a breaking `!` -> major', bump('4.0.1', [fix, feat, breaking]), '5.0.0');
  check('a BREAKING CHANGE body -> major', bump('4.0.1', [breakingBody]), '5.0.0');

  check('labeled + one fix -> release', decide([fix], '4.0.1', true).version, '4.0.2');
  check('labeled + docs only -> release anyway (explicit human intent)', decide([docs], '4.0.1', true).release, true);
  check('labeled but NOTHING since the tag -> no release (anti-loop guard)', decide([], '4.0.1', true).release, false);

  check('69 fixes, no label -> hold (below the backstop)', decide(Array(69).fill(fix), '4.0.1', false).release, false);
  check('70 fixes, no label -> release (backstop)', decide(Array(70).fill(fix), '4.0.1', false).release, true);
  check('70 fixes -> patch bump', decide(Array(70).fill(fix), '4.0.1', false).version, '4.0.2');
  check('50 docs commits, no label -> hold (docs never count)', decide(Array(50).fill(docs), '4.0.1', false).release, false);
  check('69 fixes + 50 chores -> still hold (chores do not pad the count)', decide([...Array(69).fill(fix), ...Array(50).fill(chore)], '4.0.1', false).release, false);
  check('backstop counts breaking commits too', decide(Array(70).fill(breaking), '4.0.1', false).release, true);
  check('a breaking commit reached via the backstop still majors', decide([breaking, ...Array(69).fill(fix)], '4.0.1', false).version, '5.0.0');
  check('custom backstop respected', decide(Array(3).fill(fix), '4.0.1', false, 3).release, true);

  check('a labeled release carries the docs commits with it (bump ignores them)', decide([docs, chore, feat], '4.0.1', true).version, '4.1.0');

  check('no tag reachable -> version starts from 0.0.0', currentVersion(null), '0.0.0');
  check('vX.Y.Z tag -> parsed version', currentVersion('v4.0.1'), '4.0.1');

  for (const { name, ok } of cases) console.log(`  [${ok ? 'OK' : 'FAIL'}] ${name}`);
  const failed = cases.filter((cs) => !cs.ok);
  if (failed.length) {
    console.log(`\nSELF-TEST FAILED: ${failed.length} case(s)`);
    return 1;
  }
  console.log(`\nOK: all ${cases.length} self-test cases passed`);
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}

export { decide, bump, isUserVisible, isBreaking, currentVersion, collectCommits, lastTag };
