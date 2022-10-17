const { XPATH_MODEL, getPrimaryInstanceNode, getNodes, getBindNodes } = require('./common');

const XPATH_MODEL_INSTANCE_PATH = `${XPATH_MODEL}/instance`;
const EXPRESSION_ATTRIBUTES = ['calculate', 'constraint', 'readonly', 'relevant', 'required',];

const getNodesWithDefaultValues = (xmlDoc) => {
  const primaryInstance = getPrimaryInstanceNode(xmlDoc);
  return getNodes(primaryInstance, './/*[normalize-space(text())]');
};

const getNodePath = (node, currentPath = '') => {
  const newPath = `/${node.tagName}${currentPath}`;
  if (newPath.startsWith(XPATH_MODEL_INSTANCE_PATH)) {
    return newPath.substring(XPATH_MODEL_INSTANCE_PATH.length);
  }
  return getNodePath(node.parentNode, newPath);
};

const getDefaultFieldPaths = xmlDoc => getNodesWithDefaultValues(xmlDoc)
  .map(node => getNodePath(node));

const hasRelevantExpression = (fieldPath, bindNodes) => {
  const bindNode = bindNodes.find(bind => bind.getAttribute('nodeset') === fieldPath);
  if (!bindNode) {
    return false;
  }
  const relevant = bindNode.getAttribute('relevant');
  return relevant && relevant !== 'true()';
};

const expressionContainsFieldPath = (expression, fieldPath) => new RegExp(`${fieldPath}[^w/]`).test(expression);

const usedInExpression = (expressionName, fieldPath, bindNodes) => bindNodes
  .map(bindNode => bindNode.getAttribute(expressionName))
  .find(expression => expression && expressionContainsFieldPath(expression, fieldPath));

const getNonRelevantQuestionsWithDefaultsToCheck = (xmlDoc) => {
  const bindNodes = getBindNodes(xmlDoc);
  return getDefaultFieldPaths(xmlDoc)
    .filter(defaultFieldPath => !defaultFieldPath.includes('/inputs/'))
    .filter(defaultFieldPath => hasRelevantExpression(defaultFieldPath, bindNodes))
    .filter(defaultFieldPath => EXPRESSION_ATTRIBUTES.find(expressionName => usedInExpression(
      expressionName,
      defaultFieldPath,
      bindNodes
    )))
    .map(defaultFieldPath => ({ nodeset: defaultFieldPath }));
};

module.exports = (outStream, configDir, forms) => {
  const nonRelQuestionsWithDefaults = forms
    .map(({ fileName, data }) => ({ fileName, data: getNonRelevantQuestionsWithDefaultsToCheck(data) }))
    .filter(formData => formData.data.length);
  if (nonRelQuestionsWithDefaults.length) {
    outStream.write('## Non-relevant questions with defaults to check\n');
    outStream.write('The behavior of default values for non-relevant fields has changed. ' +
      'Previously, if a question with a default value was never relevant, its default value would be used ' +
      'for calculations and other form logic.\n');
    outStream.write(
      'Now, however, the value from a non-relevant field will always be empty, regardless of the default value. ' +
      '(Note that because of [this known issue](https://github.com/medic/cht-core/issues/7674) it can appear that ' +
      'the default value is being used while filling out the form. However, when the form it saved, the value will be cleared ' +
      'and all the dependent logic will be recalculated.)\n');
    outStream.write('So, questions with default values that might be non-relevant, but are used in other form logic ' +
      'should be reviewed (these are listed below).\n');
    outStream.write('One potential fix is to add a `calculation` that can be referenced by the form logic ' +
      'instead of the non-relevant question.  The `calculate` can use the ' +
      '[coalesce](https://docs.getodk.org/form-operators-functions/#coalesce) function like this: ' +
      '`coalesce(${non_relevant_question}, *original default for non_relevant_question*)`.\n');
    nonRelQuestionsWithDefaults.forEach(({ fileName, data }) => {
      outStream.write(`### .${fileName.substring(configDir.length)}\n`);
      data.forEach(({ nodeset }) => outStream.write(`  - \`${nodeset}\`\n`));
    });
  }
};
