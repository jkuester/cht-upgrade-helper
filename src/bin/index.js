#!/usr/bin/env node
const parseArgs = require('minimist');
const main = require('../lib/main');
(async () => {
  try {
    const cmdArgs = parseArgs(process.argv.slice(2));
    await main(process.stdout, cmdArgs);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exitCode = 1; // emit a non-zero exit code for scripting
  }
})();
