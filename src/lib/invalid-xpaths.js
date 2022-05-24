const { getFormModel, getFormFields, getCalculates, getRelevants } = require('./common');

const XPATH_PATTERN = /(?<=\W|^)(\.\.\/|\.\/|\/)[\w/.]+/g;

const isInvalidXpathPath = (nodePaths, field, path) => {
  if(path.startsWith('/')) {
    // This is an absolute path, just look for a field
    return !nodePaths.includes(path);
  }
  const searchStack = field.nodeset.split('/');
  let searchPath = path;
  (path.match(/\.\.\//g)||[]).forEach(() => {
    searchStack.pop();
    searchPath = searchPath.replace('../', '');
  });
  searchPath = searchPath.replace('./', '');
  searchStack.push(searchPath);
  const searchName = searchStack.join('/');
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
    if(value[0] && typeof value[0] === 'object' && value[0] !== null) {
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

module.exports = (configDir, forms) => {
  const output = [];
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

  return output;
};
