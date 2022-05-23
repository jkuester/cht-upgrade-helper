const fs = require('fs');
const parseArgs = require('minimist')
const Path = require("path");

const getXmlFiles = require('./xml-files');

const XPATH_PATTERN = /(?<=\W|^)(\.\.\/|\.\/|\/)[\w/.]+/g;

const getFormModel = (formData) => {
  if(!formData['h:html']
    || !formData['h:html']['h:head']
    || !formData['h:html']['h:head'][0]
    || !formData['h:html']['h:head'][0].model
    || !formData['h:html']['h:head'][0].model[0]) {
    return {};
  }
  return formData['h:html']['h:head'][0].model[0];
};

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

const getFormFields = (formData) => {
  const formModel = getFormModel(formData);

  if(!formModel.bind || !formModel.bind.length) {
    return [];
  }
  return formModel.bind.map(node => node['$']);
}

const getNumberQuestionNames = (fields) => {
  return fields
    .filter(field => ['decimal', 'int'].includes(field.type))
    .filter(field => field.required !== 'true()')
    .map(field => field.nodeset);
};

const getCalculates = (fields) => fields.filter(node => node.calculate);
const getRelevants = (fields) => fields.filter(node => node.relevant);

const getNumberFieldsToCheck = (formData) => {
  const formFields = getFormFields(formData);
  const calculates = getCalculates(formFields);
  const relevants = getRelevants(formFields);

  return getNumberQuestionNames(formFields)
    .reduce((fieldsToCheck, questionName) => {
      const localName = questionName.split('/').pop();
      const namePattern = new RegExp(`\/${localName}[^\w|\/]`);
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
}

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
      const namePattern = new RegExp(`\/${localName}[^\w|\/]`);
      if(calculates.find(calc => namePattern.test(calc.calculate))) {
        return true;
      }
      return relevants.find(relev => namePattern.test(relev.relevant));
    });
};

const isInvalidXpathPath = (nodePaths, field, path) => {
  if(path.startsWith('/')) {
    // This is an absolute path, just look for a field
    return !nodePaths.includes(path);
  }
  const searchStack = field.nodeset.split('/');
  // searchStack.pop();
  let searchPath = path;
  (path.match(/\.\.\//g)||[]).forEach(_ => {
    searchStack.pop();
    searchPath = searchPath.replace('../', '');
  });
  searchPath = searchPath.replace('./', '');
  searchStack.push(searchPath);
  const searchName = searchStack.join('/')
  return !nodePaths.includes(searchName);
};

const getNodePaths = (currentPath, node) => {
  let currentNames = [];
  const entries = Object.entries(node);
  entries.forEach(([name, value]) => {
    if(name === '$') {
      return;
    }
    const entryPath = `${currentPath}/${name}`;
    currentNames.push(entryPath);
    if(value[0] && typeof value[0] === 'object' && value[0] != null) {
      currentNames = [...currentNames, ...getNodePaths(entryPath, value[0])];
    }
  });
  return currentNames;
};

const getNodePathsFromInstance = (formData) => {
  const model = getFormModel(formData);
  if(!model.instance || !model.instance[0]) {
    return [];
  }
  const instanceWrapper = model.instance[0];
  const instanceName = Object.keys(instanceWrapper)[0];
  const instance = instanceWrapper[instanceName][0];
  return getNodePaths(`/${instanceName}`, instance);
};

const getFieldsWithInvaildXpaths = (formData) => {
  const formFields = getFormFields(formData);
  const relevants = getRelevants(formFields);
  const calculates = getCalculates(formFields);
  const nodePaths = getNodePathsFromInstance(formData);

  let invalidDataByQuestionName = relevants.reduce((fieldsToCheckByName, field) => {
    const paths = field.relevant.match(XPATH_PATTERN) || [];
    const invalidPaths = paths.filter(path => isInvalidXpathPath(nodePaths, field, path));
    if(invalidPaths.length) {
      fieldsToCheckByName.set(field.nodeset, { questionName: field.nodeset, relevants: invalidPaths });
    }
    return fieldsToCheckByName;
  }, new Map());
  invalidDataByQuestionName = calculates.reduce((fieldsToCheckByName, field) => {
    const paths = field.calculate.match(XPATH_PATTERN) || [];
    const invalidPaths = paths.filter(path => isInvalidXpathPath(nodePaths, field, path));
    if(invalidPaths.length) {
      const fieldData = fieldsToCheckByName.get(field.nodeset) || { questionName: field.nodeset };
      fieldData.calculates = invalidPaths;
      fieldsToCheckByName.set(field.nodeset, fieldData);
    }
    return fieldsToCheckByName;
  }, invalidDataByQuestionName);

  return Array.from(invalidDataByQuestionName.values());
};

module.exports = async (argv, env) => {
  const cmdArgs = parseArgs(argv);
  const configDir = Path.resolve(cmdArgs.source || '.');
  const forms = await getXmlFiles(configDir);

  const output = ['# Upgrade Helper Results'];

  const fieldsWithInvalidXpaths =   forms
    .map(({ fileName, data }) => ({ fileName, data: getFieldsWithInvaildXpaths(data) }))
    .filter(formData => formData.data.length);
  if(fieldsWithInvalidXpaths.length) {
    output.push('## Fields with xPath paths to check');
    output.push('Explicit [xPath paths](https://docs.getodk.org/form-logic/#advanced-xpath-paths) (either absolute or relative) ' +
      'provided in a form do not cause an error if they are invalid (if the element they identify does not exist in the form).');
    output.push('So, these invalid paths can be difficult to identify. Below are listed the fields using xPath paths ' +
      'in their `calculation` or `relevant` logic that have been flagged as being potentially invalid.');
    output.push('These fields (and their accompanying logic) should be evaluated to ensure the paths are correct.');
    fieldsWithInvalidXpaths.forEach(({ fileName, data }) => {
      output.push(`### .${fileName.substring(configDir.length)}`);
      data.forEach(({ questionName, calculates, relevants }) => {
        output.push(`#### ${questionName}`);
        if(calculates && calculates.length) {
          output.push('calculate:');
          calculates.forEach(path => {
            output.push(`  - ${path}`);
          });
        }
        if(relevants && relevants.length) {
          output.push('relevant:');
          relevants.forEach(path => {
            output.push(`  - ${path}`);
          });
        }
      });
    });
  }

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

  const nonRelQuestionsWithDefaults = forms
    .map(({ fileName, data }) => ({ fileName, data: getNonRelevantQuestionsWithDefaultsToCheck(data) }))
    .filter(formData => formData.data.length);
  if(nonRelQuestionsWithDefaults.length) {
    output.push('## Non-relevant questions with defaults to check');
    output.push('The behavior of default values for non-relevant fields has changed. ' +
      'Previously, if a question with a default value was never relevant, its default value would be used ' +
      'for calculations and other form logic.');
    output.push('Now, however, the value from a non-relevant field will always be empty, regardless of the default value. ' +
      '(Note that because of [this Enketo issue](https://github.com/enketo/enketo-core/issues/849) it can appear that ' +
      'the default value is being used while filling out the form. But, when the form it saved, the value will be cleared ' +
      'and all the dependent logic will be recalculated.)');
    output.push('So, questions with default values that might be non-relevant, but are used in other form logic ' +
      'should be reviewed (these are listed below).');
    output.push('One potential fix is to add a `calculation` that can be referenced by the form logic ' +
      'instead of the non-relevant question.  The `calculate` can use the ' +
      '[coalesce](https://docs.getodk.org/form-operators-functions/#coalesce) function like this: ' +
      '`coalesce(${non_relevant_question}, *original default for non_relevant_question*)`.');
    nonRelQuestionsWithDefaults.forEach(({ fileName, data }) => {
      output.push(`### .${fileName.substring(configDir.length)}`);
      data.forEach(({ nodeset }) => output.push(`  - \`${nodeset}\``));
    });
  }

  fs.writeFileSync(Path.join(configDir, 'upgrade_helper_output.md'), output.join('\n\n'));
};
