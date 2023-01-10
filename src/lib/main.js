const path = require('path');

const { getXmlFiles } = require('./xml-files');
const initForms = require('./init-forms');
const nonRequiredNumbers = require('./non-required-numbers');
const nonRelevantWithDefaults = require('./non-relevant-with-defaults');
const concatWithPlus = require('./concat-with-plus');

module.exports = async (outStream, options) => {
  const configDir = path.resolve(options.configDir || '.');
  const formNames = options['--'];

  const forms = await getXmlFiles(configDir, formNames);

  outStream.write('# Upgrade Helper Results\n');
  await initForms(outStream, configDir, formNames);
  nonRequiredNumbers(outStream, configDir, forms);
  nonRelevantWithDefaults(outStream, configDir, forms);
  concatWithPlus(outStream, configDir, forms);
};
