const { EXPRESSION_ATTRIBUTES, getBindNodes } = require('./common');

const expressionHasPlusConcact = expression => expression && expression.match(/['"]\s*\+\s*['"]/g);

const hasExpression = field => EXPRESSION_ATTRIBUTES.filter(expressionName => field[expressionName]).length;

const getFieldsWithPlusConcats = (formData) => {
  return getBindNodes(formData)
    .map(bindNode => {
      const field = { name: bindNode.getAttribute('nodeset') };
      EXPRESSION_ATTRIBUTES.forEach(expressionName => {
        field[`${expressionName}`] = expressionHasPlusConcact(bindNode.getAttribute(expressionName));
      });
      return field;
    })
    .filter(hasExpression);
};

module.exports = (outStream, configDir, forms) => {
  const plusConcatsToCheck = forms
    .map(({ fileName, data }) => ({ fileName, data: getFieldsWithPlusConcats(data) }))
    .filter(formData => formData.data.length);
  if (plusConcatsToCheck.length) {
    outStream.write('## String literal concatenations to check\n');
    outStream.write('Previous versions of Enketo supported concatenating strings with the `+` operator, but it was never ' +
      'part of the ODK Specification. This functionality no longer works in later versions of Enketo and results in `NaN`.\n');
    outStream.write('The [`concat` function](https://docs.getodk.org/form-operators-functions/#concat) should be used instead.\n');
    plusConcatsToCheck.forEach(({ fileName, data }) => {
      outStream.write(`### .${fileName.substring(configDir.length)}\n`);
      data.forEach(field => {
        const expressions = EXPRESSION_ATTRIBUTES.filter(expressionName => field[expressionName]);
        outStream.write(`- ${field.name} - ${expressions} \n`);
      });
    });
  }
};
