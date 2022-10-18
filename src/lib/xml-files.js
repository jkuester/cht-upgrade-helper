const fs = require('fs');
const path = require('path');
const { DOMParser } = require('@xmldom/xmldom');
const domParser = new DOMParser();

const getXmlFilePaths = (configDir, formType) => {
  const formsPath = path.resolve(configDir, 'forms', formType);
  return fs.readdirSync(formsPath)
    .filter(fileName => fileName.endsWith('.xml'))
    .map(fileName => path.resolve(formsPath, fileName));
};

const getXmlFile = (fileName) => {
  const file = fs.readFileSync(fileName, 'UTF-8');
  return {
    fileName,
    data: domParser.parseFromString(file),
  };
};

const getXmlFiles = (configDir, formNames) => {
  const formNameFilter = filePath => formNames.length === 0 || formNames.includes(path.basename(filePath, '.xml'));
  const appForms = getXmlFilePaths(configDir, 'app').filter(formNameFilter);
  const contactForms = getXmlFilePaths(configDir, 'contact').filter(formNameFilter);
  return Promise.all([...appForms, ...contactForms].map((fileName) => getXmlFile(fileName)));
};

module.exports = {
  getXmlFilePaths,
  getXmlFiles
};
