#!/usr/bin/env node

const main = require('../lib/main');
(async () => {
  try {
    await main(process.argv);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log(e);
    process.exitCode = 1; // emit a non-zero exit code for scripting
  }
})();
