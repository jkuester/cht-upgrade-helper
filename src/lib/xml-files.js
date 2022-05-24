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

module.exports = (configDir) => {
  // const fileName = '/home/jlkuester7/git/cht-core/config/standard/forms/app/immunization_visit.xml';
  // const forms = [{
  //   fileName,
  //   data: await xmlParser.parseStringPromise(fs.readFileSync(fileName, 'UTF-8'))
  // }];
  return Promise.all(
    getXmlFilePaths(configDir)
      .map(fileName => ({ fileName, file: fs.readFileSync(fileName, 'UTF-8') }))
      .map(async({ fileName, file }) => ({
        fileName,
        data: await xmlParser.parseStringPromise(file)
      }))
  );
};
