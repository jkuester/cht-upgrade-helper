const { getFormFields, getCalculates, getRelevants, getFormModel } = require('./common');

const getFormInstance = (formData, instanceName) => {
  const formModel = getFormModel(formData);
  if(!formModel.instance || !formModel.instance.length) {
    return {};
  }

  const instanceWrapper = formModel.instance.find(inst => Object.keys(inst).includes(instanceName));
  if(!instanceWrapper || !instanceWrapper[instanceName].length) {
    return {};
  }

  return instanceWrapper[instanceName][0];
};

const isObject = n => typeof n === `object`;
const getPrimitiveOrNull = val => isObject(val) ? null : val;

const findDefaultVal = (instData, steps) => {
  const current = instData[steps.shift()];
  if(!current) {
    return null;
  }
  if(!steps.length) {
    return getPrimitiveOrNull(current.length ? current[0] : current);
  }
  if(isObject(current)) {
    return findDefaultVal(current.length ? current[0] : current, steps);
  }
  return getPrimitiveOrNull(current);
};

const getFieldSteps = fieldName => fieldName.split('/').filter(s => s.length);

const getDefaultValue = (formData, fieldName) => {
  const fieldSteps = getFieldSteps(fieldName);
  const instance = getFormInstance(formData, fieldSteps.shift());
  return findDefaultVal(instance, fieldSteps);
};

const getDefaults = (formData, fields) => {
  return fields.filter(field => getDefaultValue(formData, field.nodeset));
};

const getNonRelevantQuestionsWithDefaultsToCheck = (formData) => {
  const formFields = getFormFields(formData);
  const calculates = getCalculates(formFields);
  const relevants = getRelevants(formFields);
  const defaultFields = getDefaults(formData, formFields);

  return defaultFields
    .filter(defaultField => !defaultField.nodeset.includes('/inputs/'))
    .filter(defaultField => {
      const steps = getFieldSteps(defaultField.nodeset);
      return steps.find(step => relevants.filter(relevant => relevant.nodeset.endsWith(`/${step}`)).length);
    }).filter(defaultField => {
      const localName = defaultField.nodeset.split('/').pop();
      const namePattern = new RegExp(`/${localName}[^w|/]`);
      if(calculates.find(calc => namePattern.test(calc.calculate))) {
        return true;
      }
      return relevants.find(relev => namePattern.test(relev.relevant));
    });
};

module.exports = (outStream, configDir, forms) => {
  const nonRelQuestionsWithDefaults = forms
    .map(({ fileName, data }) => ({ fileName, data: getNonRelevantQuestionsWithDefaultsToCheck(data) }))
    .filter(formData => formData.data.length);
  if(nonRelQuestionsWithDefaults.length) {
    outStream.write('## Non-relevant questions with defaults to check\n');
    outStream.write('The behavior of default values for non-relevant fields has changed. ' +
      'Previously, if a question with a default value was never relevant, its default value would be used ' +
      'for calculations and other form logic.\n');
    outStream.write('Now, however, the value from a non-relevant field will always be empty, regardless of the default value. ' +
      '(Note that because of [this Enketo issue](https://github.com/enketo/enketo-core/issues/849) it can appear that ' +
      'the default value is being used while filling out the form. But, when the form it saved, the value will be cleared ' +
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
