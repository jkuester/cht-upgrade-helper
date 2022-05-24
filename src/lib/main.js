const fs = require('fs');
const parseArgs = require('minimist');
const Path = require('path');

const getXmlFiles = require('./xml-files');
const invalidXpaths = require('./invalid-xpaths');
const nonRequiredNumbers = require('./non-required-numbers');
const nonRelevantWithDefaults = require('./non-relevant-with-defaults');

module.exports = async (argv) => {
  const cmdArgs = parseArgs(argv);
  const configDir = Path.resolve(cmdArgs.source || '.');
  const forms = await getXmlFiles(configDir);

  const output = [
    '# Upgrade Helper Results',
    ...invalidXpaths(configDir, forms),
    ...nonRequiredNumbers(configDir, forms),
    ...nonRelevantWithDefaults(configDir, forms)
  ];

  fs.writeFileSync(Path.join(configDir, 'upgrade_helper_output.md'), output.join('\n\n'));
};
