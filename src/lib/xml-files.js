const fs = require('fs');
const xml2js = require('xml2js');
const xmlParser = new xml2js.Parser({ normalize: true });

const getXmlFilePaths = (dirPath) => {
  return fs
    .readdirSync(dirPath)
    .reduce((xmlFiles, file) => {
      const filePath = `${dirPath}/${file}`;
      if(fs.statSync(filePath).isDirectory() && 'node_modules' !== file) {
        return xmlFiles.concat(getXmlFilePaths(filePath));
      } else if(file.endsWith('.xml')) {
        xmlFiles.push(filePath);
      }
      return xmlFiles;
    }, []);
};

const getXmlFile = (fileName) => {
  const file = fs.readFileSync(fileName, 'UTF-8');
  return xmlParser.parseStringPromise(file)
    .then(data => ({fileName, data}));
};

module.exports = {
  getXmlFile,
  getAllXmlFiles: (configDir) => {
    return Promise.all(
      getXmlFilePaths(configDir)
        .map((fileName) => getXmlFile(fileName))
    );
  }
};
