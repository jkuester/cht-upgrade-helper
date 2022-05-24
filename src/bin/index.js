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
  cht-upgrade-helper <xml_file_names>

DESCRIPTION
  Generates a report of potential config issues that could affect behavior after upgrading to the latest version of the 
  CHT.
  
  The cht-upgrade-helper command can be run without parameters to generate a report for all the forms nested below the 
  current directory. Or the names of the XML files to include in the report can be provided.
  
  Output from the cht-upgrade-helper command is formatted with Markdown and can be saved to a file like this:
    cht-upgrade-helper > output.md 
  `);
};

(async () => {
  try {
    const cmdArgs = parseArgs(process.argv.slice(2));
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
