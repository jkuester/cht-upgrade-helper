const Path = require('path');

const { getXmlFile, getAllXmlFiles } = require('./xml-files');
const initForms = require('./init-forms');
const invalidXpaths = require('./invalid-xpaths');
const nonRequiredNumbers = require('./non-required-numbers');
const nonRelevantWithDefaults = require('./non-relevant-with-defaults');

const getIndividualXmlFiles = (configDir, fileNames) => {
  return Promise.all(
    fileNames
      .map(fileName => Path.resolve(configDir, fileName))
      .map(filePath => getXmlFile(filePath))
  );
};

module.exports = async (outStream, options) => {
  const configDir = Path.resolve(options.configDir || '.');
  const forms = options._ && options._.length
    ? await getIndividualXmlFiles(configDir, options._)
    : await getAllXmlFiles(configDir);

  outStream.write('# Upgrade Helper Results\n');
  await initForms(outStream, configDir);
  invalidXpaths(outStream, configDir, forms);
  nonRequiredNumbers(outStream, configDir, forms);
  nonRelevantWithDefaults(outStream, configDir, forms);
};
