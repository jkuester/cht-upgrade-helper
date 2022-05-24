const { getFormFields, getCalculates, getRelevants } = require('./common');

const getNumberQuestionNames = (fields) => {
  return fields
    .filter(field => ['decimal', 'int'].includes(field.type))
    .filter(field => field.required !== 'true()')
    .map(field => field.nodeset);
};

const getNumberFieldsToCheck = (formData) => {
  const formFields = getFormFields(formData);
  const calculates = getCalculates(formFields);
  const relevants = getRelevants(formFields);

  return getNumberQuestionNames(formFields)
    .reduce((fieldsToCheck, questionName) => {
      const localName = questionName.split('/').pop();
      const namePattern = new RegExp(`/${localName}[^w|/]`);
      const calcs = calculates.filter(calc => namePattern.test(calc.calculate));
      const relevs = relevants.filter(relev => namePattern.test(relev.relevant));
      if(calcs.length || relevs.length) {
        fieldsToCheck.push({
          questionName,
          calculates: calcs.map(calc => ({
            name: calc.nodeset,
            calculate: calc.calculate
          })),
          relevants: relevs.map(relev => ({
            name: relev.nodeset,
            relevant: relev.relevant
          }))
        });
      }
      return fieldsToCheck;
    }, []);
};

module.exports = (configDir, forms) => {
  const output = [];
  const numberQuestionsToCheck =   forms
    .map(({ fileName, data }) => ({ fileName, data: getNumberFieldsToCheck(data) }))
    .filter(formData => formData.data.length);
  if(numberQuestionsToCheck.length) {
    output.push('## Number questions to check');
    output.push('The value used for unanswered number questions in `calculation`s has changed. ' +
      'Previously `0` would be given to the `calculation` logic, but the new version of the CHT follows the ' +
      '[ODK spec](https://docs.getodk.org/form-logic/#empty-values) and returns `NaN` as the value of an unanswered number question.');
    output.push('This behavior change can break form logic that expects `0`. ' +
      'All `calculation`s involving non-required number questions should be reviewed (these are listed below).');
    output.push('One potential fix is to update the `calculation` to use the [coalesce](https://docs.getodk.org/form-operators-functions/#coalesce) function.' +
      'So, `${potentially_empty_value} > 0` becomes `coalesce(${potentially_empty_value}, 0) > 0`.');
    output.push('See [this issue](https://github.com/medic/cht-core/issues/7222) for more context.');
    numberQuestionsToCheck.forEach(({ fileName, data }) => {
      output.push(`### .${fileName.substring(configDir.length)}`);
      data.forEach(({ questionName, calculates, relevants }) => {
        output.push(`#### ${questionName}`);
        if(calculates.length) {
          output.push('calculate:');
          calculates.forEach(({ name, calculate }) => {
            output.push(`  - ${name}`);
            output.push(`    - \`${calculate}\``);
          });
        }
        if(relevants.length) {
          output.push('relevant:');
          relevants.forEach(({ name, relevant }) => {
            output.push(`  - ${name}`);
            output.push(`    - \`${relevant}\``);
          });
        }
      });
    });
  }

  return output;
};
