#!/usr/bin/env node
/* eslint-disable no-console */
const parseArgs = require('minimist');
const main = require('../lib/main');

const printUsage = () => {
  console.log(`
NAME
  cht-upgrade-helper - Helper script for reviewing configuration when upgrading the CHT

SYNOPSIS
  cht-upgrade-helper
Or:
  cht-upgrade-helper -- <form_names>

DESCRIPTION
  Generates a report of potential config issues that could affect behavior after upgrading to the latest version of the 
  CHT.
  
  Run the cht-upgrade-helper command from the base directory of the config. If no form names are provided, a report will 
  be generated for all the forms in the config. If one or more form names are provided, only information for these
  forms will be included in the report.
  
  Output from the cht-upgrade-helper command is formatted with Markdown and can be saved to a file like this:
    cht-upgrade-helper > output.md 
  `);
};

(async () => {
  try {
    const cmdArgs = parseArgs(process.argv.slice(2), { '--' : true });
    if(cmdArgs.help) {
      printUsage();
      return;
    }
    await main(process.stdout, cmdArgs);
  } catch (e) {
    console.error(e);
    process.exitCode = 1; // emit a non-zero exit code for scripting
  }
})();
