import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const testFiles = [
  'health.test.js',
  'auth.test.js',
  'event.test.js',
  'concurrency.test.js',
  'ledger_and_checkin.test.js',
];

async function runTest(file) {
  return new Promise((resolve, reject) => {
    console.log(`\n▶ Running ${file}...`);
    const child = spawn('node', [path.join(__dirname, file)], {
      stdio: 'inherit',
      shell: true,
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✔ ${file} completed successfully.`);
        resolve();
      } else {
        reject(new Error(`Test failed in ${file} with exit code ${code}`));
      }
    });
  });
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  VOLUNTEERHUB — FULL INTEGRATION TEST SUITE');
  console.log('═══════════════════════════════════════════════════════');

  for (const file of testFiles) {
    try {
      await runTest(file);
    } catch (err) {
      console.error(err.message);
      process.exit(1);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  ALL TEST SUITES PASSED CLEANLY! (100% SUCCESS)');
  console.log('═══════════════════════════════════════════════════════\n');
}

main();

