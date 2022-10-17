const { EXPRESSION_ATTRIBUTES, getBindNodes } = require('./common');

const getNumberQuestionNames = (bindNodes) => bindNodes
  .filter(bindNode => ['decimal', 'int'].includes(bindNode.getAttribute('type')))
  .filter(bindNode => bindNode.getAttribute('required') !== 'true()')
  .map(bindNode => bindNode.getAttribute('nodeset'));

const expressionContainsFieldPath = (expression, fieldName) => {
  const namePattern = new RegExp(`(?<=\\W|^)(${fieldName})(?![\\w/])`, 'g');
  const coalescePattern = new RegExp(`(?<=coalesce\\(\\s*)(${fieldName})(?![\\w/])`, 'g');
  const nameMatches = expression.match(namePattern);
  if (!nameMatches) {
    return false;
  }
  // If the field is already the first param in a `coalesce` function, assume it is safe.
  // Have to do this double-check since there is no negative look-behind in Node 8.
  const coalesceMatches = expression.match(coalescePattern);
  return !coalesceMatches || coalesceMatches.length < nameMatches.length;
};

const getExpressionsUsingFieldPath = (expressionName, fieldPath, bindNodes) => bindNodes
  .filter(bindNode => bindNode.getAttribute(expressionName))
  .filter(bindNode => expressionContainsFieldPath(bindNode.getAttribute(expressionName), fieldPath))
  .map(bindNode => ({
    name: bindNode.getAttribute('nodeset'),
    [expressionName]: bindNode.getAttribute(expressionName)
  }));

const hasExpression = ({ calculates, constraints, relevants, readonlys, requireds }) =>
  calculates.length || constraints.length || relevants.length || readonlys.length || requireds.length;

const getNumberFieldsToCheck = (formData) => {
  const bindNodes = getBindNodes(formData);
  return getNumberQuestionNames(bindNodes)
    .map(questionName => {
      const field = { questionName };
      EXPRESSION_ATTRIBUTES.forEach(expressionName => {
        field[`${expressionName}s`] = getExpressionsUsingFieldPath(expressionName, questionName, bindNodes);
      });
      return field;
    })
    .filter(hasExpression);
};

module.exports = (outStream, configDir, forms) => {
  const numberQuestionsToCheck = forms
    .map(({ fileName, data }) => ({ fileName, data: getNumberFieldsToCheck(data) }))
    .filter(formData => formData.data.length);
  if (numberQuestionsToCheck.length) {
    outStream.write('## Number questions to check\n');
    outStream.write('The value used for unanswered number questions in `calculation`s has changed. ' +
      'Previously `0` would be given to the `calculation` logic, but the new version of the CHT follows the ' +
      '[ODK spec](https://docs.getodk.org/form-logic/#empty-values) and returns `NaN` as the value of an unanswered number question.\n');
    outStream.write('This behavior change can break form logic that expects `0`. ' +
      'All `calculation`s involving non-required number questions should be reviewed (these are listed below).\n');
    outStream.write(
      'One potential fix is to update the `calculation` to use the [coalesce](https://docs.getodk.org/form-operators-functions/#coalesce) function.' +
      'So, `${potentially_empty_value} > 0` becomes `coalesce(${potentially_empty_value}, 0) > 0`.\n');
    outStream.write('See [this issue](https://github.com/medic/cht-core/issues/7222) for more context.\n');
    numberQuestionsToCheck.forEach(({ fileName, data }) => {
      outStream.write(`### .${fileName.substring(configDir.length)}\n`);
      data.forEach(({ questionName, calculates, relevants }) => {
        outStream.write(`#### ${questionName}\n`);
        if (calculates.length) {
          outStream.write('- calculate:\n');
          calculates.forEach(({ name, calculate }) => {
            outStream.write(`  - ${name}\n`);
            outStream.write('    ```\n');
            outStream.write(`    ${calculate}\n`);
            outStream.write('    ```\n');
          });
        }
        if (relevants.length) {
          outStream.write('- relevant:\n');
          relevants.forEach(({ name, relevant }) => {
            outStream.write(`  - ${name}\n`);
            outStream.write('    ```\n');
            outStream.write(`    ${relevant}\n`);
            outStream.write('    ```\n');
          });
        }
      });
    });
  }
};
