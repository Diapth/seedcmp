import { execSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { existsSync, rmSync, readdirSync } from 'node:fs';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const checksDir = join(repoRoot, '.ai', 'checks');
const imWebDir = repoRoot;

console.log('===========================================================');
console.log('🚀 Running Complete Automated Regression Suite for All Issues...');
console.log('===========================================================');

// Find all verify-*.mjs files in checks directory, excluding verify-all-issues.mjs and verify-issues-9-11.mjs (since we will run their granular sub-checks directly)
const checkFiles = readdirSync(checksDir)
  .filter(file => file.startsWith('verify-') && file.endsWith('.mjs') && file !== 'verify-all-issues.mjs' && file !== 'verify-issues-9-11.mjs')
  .sort();

const tests = checkFiles.map(file => ({
  name: `Check: ${file}`,
  command: `node ${file}`,
  cwd: checksDir
}));

// Add groupChatUtils unit test
tests.push({
  name: 'Unit Test: groupChatUtils.test.ts',
  command: 'npx tsc packages/datasource-vue/tests/groupChatUtils.test.ts --module NodeNext --moduleResolution NodeNext --target ES2022 --skipLibCheck --esModuleInterop --allowSyntheticDefaultImports --outDir ./scratch/seedcmp-im-tests && node ./scratch/seedcmp-im-tests/tests/groupChatUtils.test.js',
  cwd: imWebDir,
  cleanup: () => {
    const outDir = join(imWebDir, 'scratch', 'seedcmp-im-tests');
    if (existsSync(outDir)) {
      try {
        rmSync(outDir, { recursive: true, force: true });
      } catch (e) {
        // ignore
      }
    }
  }
});

let passedCount = 0;
let failedCount = 0;

for (const t of tests) {
  console.log(`\n👉 Running: ${t.name}...`);
  try {
    const stdout = execSync(t.command, { cwd: t.cwd, encoding: 'utf8', stdio: 'pipe' });
    console.log('✅ Passed!');
    if (stdout.trim()) {
      console.log(`   Output: ${stdout.trim().split('\n').map(l => '     ' + l).join('\n').trim()}`);
    }
    passedCount++;
  } catch (err) {
    console.error(`❌ Failed: ${t.name}`);
    console.error(`   Error details:\n${err.message || err}`);
    if (err.stdout) console.error(`   Stdout:\n${err.stdout}`);
    if (err.stderr) console.error(`   Stderr:\n${err.stderr}`);
    failedCount++;
  } finally {
    if (t.cleanup) {
      t.cleanup();
    }
  }
}

console.log('\n===========================================================');
console.log('📊 Complete Test Suite Execution Summary:');
console.log(`   Total Tests Run: ${tests.length}`);
console.log(`   Passed:          ${passedCount}`);
console.log(`   Failed:          ${failedCount}`);
console.log('===========================================================');

if (failedCount > 0) {
  console.error('\n⚠️ Some regression checks failed! Please review the errors above.');
  process.exit(1);
} else {
  console.log('\n✨ All automated issue checks passed successfully! Your workspace is fully healthy.');
  process.exit(0);
}
