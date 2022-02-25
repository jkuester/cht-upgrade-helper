const fs = require('fs');
const Path = require("path");
const xml2js = require('xml2js');

const xmlParser = new xml2js.Parser({ normalize: true });

const getFormFields = (formData) => {
  if(!formData['h:html']
    || !formData['h:html']['h:head']
    || !formData['h:html']['h:head'][0]
    || !formData['h:html']['h:head'][0].model
    || !formData['h:html']['h:head'][0].model[0]
    || !formData['h:html']['h:head'][0].model[0].bind
    || !formData['h:html']['h:head'][0].model[0].bind.length) {
    return [];
  }
  return formData['h:html']['h:head'][0].model[0].bind.map(node => node['$']);
}

const getNumberQuestionNames = (fields) => {
  return fields
    .filter(field => ['decimal', 'int'].includes(field.type))
    .filter(field => field.required !== 'true()')
    .map(field => field.nodeset);
};

const getCalculates = (fields) => fields.filter(node => node.calculate);

const getNumberFieldsToCheck = (formData) => {
  const formFields = getFormFields(formData);
  const calculates = getCalculates(formFields);
  return getNumberQuestionNames(formFields)
    .reduce((fieldsToCheck, questionName) => {
      const localName = questionName.split('/').pop();
      const calcs = calculates.filter((calc => calc.calculate.includes(localName)));
      if(calcs.length) {
        fieldsToCheck.push({
          questionName,
          calculates: calcs.map(calc => ({
            name: calc.nodeset,
            calculate: calc.calculate
          }))
        });
      }
      return fieldsToCheck;
    }, []);
}

const getAllFiles = (dirPath) => {
  return fs
    .readdirSync(dirPath)
    .reduce((xmlFiles, file) => {
      const filePath = `${dirPath}/${file}`;
      if(fs.statSync(filePath).isDirectory()) {
        return xmlFiles.concat(getAllFiles(filePath));
      } else if(file.endsWith('.xml')) {
        xmlFiles.push(filePath);
      }
      return xmlFiles;
    }, []);
}

(async function() {
  const configDir = '/home/jlkuester7/git/cht-core/config/default/forms';
  const forms = await Promise.all(getAllFiles(configDir)
    .map(async(fileName) => ({
      fileName,
      data: await xmlParser.parseStringPromise(fs.readFileSync(fileName, 'UTF-8'))
    })));
  const output = ['# Upgrade Helper Results'];

  output.push('## Number questions to check');
  output.push('The value used for unanswered number questions in `calculation`s has changed. ' +
    'Previously `0` would be given to the `calculation` logic, but the new version of the CHT follows the ' +
    '[ODK spec](https://docs.getodk.org/form-logic/#empty-values) and returns `NaN` as the value of an unanswered number question.');
  output.push('This behavior change can break form logic that expects `0`. ' +
    'All `calculation`s involving non-required number questions should be reviewed (these are listed below).');
  output.push('One potential fix is to update the `calculation` to use the [coalesce](https://docs.getodk.org/form-operators-functions/#coalesce) function.' +
    'So, `${potentially_empty_value} > 0` becomes `coalesce(${potentially_empty_value}, 0) > 0`.');
  output.push('See [this issue](https://github.com/medic/cht-core/issues/7222) for more context.');
  forms
    .map(({ fileName, data }) => ({ fileName, data: getNumberFieldsToCheck(data) }))
    .filter(formData => formData.data.length)
    .forEach(({ fileName, data }) => {
      output.push(`### .${fileName.substring(configDir.length)}`);
      data.forEach(({ questionName, calculates }) => {
        output.push(`#### ${questionName}`);
        calculates.forEach(({ name, calculate }) => {
          output.push(`  - ${name}`);
          output.push(`    - \`${calculate}\``);
        });
      });
    });

  fs.writeFileSync(Path.join(configDir, 'upgrade_helper_output.md'), output.join('\n\n'));
})();
