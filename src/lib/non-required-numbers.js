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

      const namePattern = new RegExp(`(?<=\\W|^)(${questionName})(?![\\w/])`, 'g');
      const coalescePattern = new RegExp(`(?<=coalesce\\(\\s*)(${questionName})(?![\\w/])`, 'g');
      const containsQuestionName = (value) => {
        const nameMatches = value.match(namePattern);
        if(!nameMatches) {
          return false;
        }
        // If the field is already the first param in a `coalesce` function, assume it is safe.
        // Have to do this double-check since there is no negative look-behind in Node 8.
        const coalesceMatches = value.match(coalescePattern);
        return !coalesceMatches || coalesceMatches.length < nameMatches.length;
      };

      const calcs = calculates.filter(calcv => containsQuestionName(calcv.calculate));
      const relevs = relevants.filter(relev => containsQuestionName(relev.relevant));
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

module.exports = (outStream, configDir, forms) => {
  const numberQuestionsToCheck =   forms
    .map(({ fileName, data }) => ({ fileName, data: getNumberFieldsToCheck(data) }))
    .filter(formData => formData.data.length);
  if(numberQuestionsToCheck.length) {
    outStream.write('## Number questions to check\n');
    outStream.write('The value used for unanswered number questions in `calculation`s has changed. ' +
      'Previously `0` would be given to the `calculation` logic, but the new version of the CHT follows the ' +
      '[ODK spec](https://docs.getodk.org/form-logic/#empty-values) and returns `NaN` as the value of an unanswered number question.\n');
    outStream.write('This behavior change can break form logic that expects `0`. ' +
      'All `calculation`s involving non-required number questions should be reviewed (these are listed below).\n');
    outStream.write('One potential fix is to update the `calculation` to use the [coalesce](https://docs.getodk.org/form-operators-functions/#coalesce) function.' +
      'So, `${potentially_empty_value} > 0` becomes `coalesce(${potentially_empty_value}, 0) > 0`.\n');
    outStream.write('See [this issue](https://github.com/medic/cht-core/issues/7222) for more context.\n');
    numberQuestionsToCheck.forEach(({ fileName, data }) => {
      outStream.write(`### .${fileName.substring(configDir.length)}\n`);
      data.forEach(({ questionName, calculates, relevants }) => {
        outStream.write(`#### ${questionName}\n`);
        if(calculates.length) {
          outStream.write('calculate:\n');
          calculates.forEach(({ name, calculate }) => {
            outStream.write(`  - ${name}\n`);
            outStream.write(`    - \`${calculate}\`\n`);
          });
        }
        if(relevants.length) {
          outStream.write('relevant:\n');
          relevants.forEach(({ name, relevant }) => {
            outStream.write(`  - ${name}\n`);
            outStream.write(`    - \`${relevant}\`\n`);
          });
        }
      });
    });
  }
};
