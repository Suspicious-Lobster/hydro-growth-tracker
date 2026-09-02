// Repo hygiene: package.json should only describe things that actually
// exist on disk, and the root should be free of dev-launcher cruft
// (start.bat/start.ps1 and friends). MR-17.
//
// Another row (MR-22, MR-29) will extend this file later; keep helpers small
// and named so new checks slot in without touching existing ones.

import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';

const root = path.resolve(import.meta.dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'));
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf-8');

// True if a build.files entry contains glob syntax (*, ?, {}, []).
function isGlobPattern(entry) {
  return /[*?{}[\]]/.test(entry);
}

// For a glob entry, the directory that must exist is everything before the
// first path segment containing a glob character.
function globBaseDir(entry) {
  const segments = entry.split('/');
  const literalSegments = [];
  for (const segment of segments) {
    if (isGlobPattern(segment)) break;
    literalSegments.push(segment);
  }
  return literalSegments.join('/');
}

describe('package.json build.files describe real paths', () => {
  const entries = pkg.build.files;

  it('checks every build.files entry', () => {
    console.log(`repo-hygiene: checked ${entries.length} build.files entries`);
    expect(entries.length).toBeGreaterThan(0);
  });

  for (const entry of entries) {
    if (isGlobPattern(entry)) {
      it(`glob entry's base directory exists: ${entry}`, () => {
        const base = globBaseDir(entry);
        // frontend/dist may be absent on a clean checkout (it's a build
        // output); treat 'frontend/dist/**/*' as satisfied as long as
        // 'frontend' itself exists.
        const checkPath = base === 'frontend/dist' ? 'frontend' : base;
        const exists = fs.existsSync(path.join(root, checkPath));
        expect(exists, `expected directory to exist for glob entry "${entry}": ${checkPath}`).toBe(true);
      });
    } else {
      it(`entry exists on disk: ${entry}`, () => {
        const exists = fs.existsSync(path.join(root, entry));
        expect(exists, `expected build.files entry to exist: ${entry}`).toBe(true);
      });
    }
  }
});

describe('package.json scripts reference real node files', () => {
  const scripts = Object.entries(pkg.scripts || {});

  it('checks every script entry', () => {
    console.log(`repo-hygiene: checked ${scripts.length} package.json scripts`);
    expect(scripts.length).toBeGreaterThan(0);
  });

  for (const [name, command] of scripts) {
    const match = /^node\s+(\S+)/.exec(command);
    if (!match) continue;
    it(`"${name}" script's node target exists: ${match[1]}`, () => {
      const exists = fs.existsSync(path.join(root, match[1]));
      expect(exists, `expected "${name}" script's node file to exist: ${match[1]}`).toBe(true);
    });
  }
});

describe('no dev-launcher cruft at the repo root', () => {
  it('has no .bat or .ps1 files at the root', () => {
    const rootFiles = fs.readdirSync(root);
    const launchers = rootFiles.filter((f) => /\.(bat|ps1)$/i.test(f));
    expect(launchers, `unexpected launcher files at repo root: ${launchers.join(', ')}`).toEqual([]);
  });
});

describe('README.md only mentions real npm scripts', () => {
  // Matches "npm run <script>" or "npm test", ignoring trailing flags like
  // "npm run dist -- --dir". Lines that "cd frontend" first name a script in
  // frontend/package.json, not the root one, so those are out of scope here.
  const mentionPattern = /npm (run\s+([\w:-]+)|test\b)/g;

  function readmeScriptMentions() {
    const mentions = [];
    for (const line of readme.split('\n')) {
      if (line.includes('cd frontend')) continue;
      let match;
      mentionPattern.lastIndex = 0;
      while ((match = mentionPattern.exec(line)) !== null) {
        mentions.push(match[2] ? match[2] : 'test');
      }
    }
    return mentions;
  }

  const mentions = readmeScriptMentions();

  it('checks every README script mention', () => {
    console.log(`repo-hygiene: checked ${mentions.length} README "npm run/test" mentions`);
    expect(mentions.length).toBeGreaterThan(0);
  });

  for (const scriptName of mentions) {
    it(`README-mentioned script exists in package.json: ${scriptName}`, () => {
      expect(pkg.scripts, `expected package.json scripts to have "${scriptName}"`).toHaveProperty(scriptName);
    });
  }
});

describe('licence and privacy docs', () => {
  const licensePath = path.join(root, 'LICENSE');
  const userGuidePath = path.join(root, 'docs', 'user-guide.md');

  it('LICENSE exists and contains "MIT License"', () => {
    expect(fs.existsSync(licensePath), 'expected a LICENSE file at repo root').toBe(true);
    const license = fs.readFileSync(licensePath, 'utf-8');
    expect(license).toContain('MIT License');
  });

  it('package.json license is MIT', () => {
    expect(pkg.license).toBe('MIT');
  });

  it('README has a Privacy heading', () => {
    expect(readme).toMatch(/^##+ .*Privacy/m);
  });

  it('docs/user-guide.md exists and describes where data lives', () => {
    expect(fs.existsSync(userGuidePath), 'expected docs/user-guide.md to exist').toBe(true);
    const guide = fs.readFileSync(userGuidePath, 'utf-8');
    expect(guide).toContain('hydro-data.json');
    expect(guide).toContain('uploads');
  });
});

describe('one product name', () => {
  const indexHtmlPath = path.join(root, 'frontend', 'index.html');
  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf-8');

  it('pkg.build.productName is "Hydro Growth Tracker"', () => {
    expect(pkg.build.productName).toBe('Hydro Growth Tracker');
  });

  it('pkg.build.nsis.shortcutName is "Hydro Growth Tracker"', () => {
    expect(pkg.build.nsis.shortcutName).toBe('Hydro Growth Tracker');
  });

  it('index.html contains correct title', () => {
    expect(indexHtml).toContain('<title>Hydro Growth Tracker</title>');
  });

  it('no naming variants appear in README, index.html, or package.json', () => {
    const badPattern = /tracker pro|HydroGrowth|Vite \+ React/i;
    const pkgString = JSON.stringify(pkg);
    expect(readme).not.toMatch(badPattern);
    expect(indexHtml).not.toMatch(badPattern);
    expect(pkgString).not.toMatch(badPattern);
  });
});
