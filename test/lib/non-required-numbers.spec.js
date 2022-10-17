const { assert } = require('chai');
const { DOMParser } = require('@xmldom/xmldom');
const sinon = require('sinon');
const nonRequiredNumbers = require('../../src/lib/non-required-numbers');

const domParser = new DOMParser();

const CONFIG_DIR = '/config/dir';
const FILE_NAME = `test_form.xml`;
const FILE_PATH = `${CONFIG_DIR}/${FILE_NAME}`;

const createInstanceElement = (name, value) => {
  if (typeof value !== 'object') {
    return `<${name}/>`;
  }
  return `
    <${name}>
      ${Object.keys(value)
    .map(key => createInstanceElement(key, value[key]))
    .join('')}
    </${name}>`;
};

const createInstanceFields = fields => {
  const instance = fields.reduce((inst, { name }) => {
    const groupNames = name.split('/')
      .slice(2);
    const localName = groupNames.pop();
    let localObj = inst;
    groupNames.forEach(groupName => {
      localObj[groupName] = localObj[groupName] || {};
      localObj = localObj[groupName];
    });
    localObj[localName] = true;
    return inst;
  }, {});

  return createInstanceElement('test_form', instance);
};

const createBinds = fields => {
  const binds = fields
    .map(({ name, type, calculate }) => {
      const calc = calculate ? `calculate="${calculate}"` : '';
      return `<bind nodeset="${name}" type="${type}" ${calc}/>`;
    });
  return binds.join('');
};

const createXml = (fields) => `
<?xml version="1.0"?>
<h:html xmlns="http://www.w3.org/2002/xforms" xmlns:ev="http://www.w3.org/2001/xml-events" xmlns:h="http://www.w3.org/1999/xhtml" xmlns:jr="http://openrosa.org/javarosa" xmlns:orx="http://openrosa.org/xforms/" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <h:head>
    <model>
      <instance>
        ${createInstanceFields(fields)}
      </instance>
      ${createBinds(fields)}
    </model>
  </h:head>
</h:html>`;

describe('non-required-numbers', () => {
  let outStream;

  beforeEach(() => outStream = { write: sinon.stub() });
  afterEach(() => assert.equal(outStream.write.args.length, 0));

  it('int used in one calculation', async () => {
    const fields = [
      { name: '/test_form/my_calc', type: 'string', calculate: ' /test_form/my_number ' },
      { name: '/test_form/my_number', type: 'int' }
    ];
    const data = await domParser.parseFromString(createXml(fields));

    nonRequiredNumbers(outStream, CONFIG_DIR, [{ fileName: FILE_PATH, data }]);

    const output = outStream.write.args;
    assertIntro(output);
    assert.deepEqual(output.shift(), [`### ./${FILE_NAME}\n`]);
    assertField(output, '/test_form/my_number', { calculations: fields.slice(0, 1) });
  });

  it('int used in two calculations', async () => {
    const fields = [
      { name: '/test_form/my_calc', type: 'string', calculate: ' number(/test_form/my_number) ' },
      {
        name: '/test_form/my_group/my_calc1',
        type: 'string',
        calculate: ' coalesce(/test_form/not_my_number, 0) - /test_form/my_number '
      },
      { name: '/test_form/my_number', type: 'int' }
    ];
    const data = await domParser.parseFromString(createXml(fields));

    nonRequiredNumbers(outStream, CONFIG_DIR, [{ fileName: FILE_PATH, data }]);

    const output = outStream.write.args;
    assertIntro(output);
    assert.deepEqual(output.shift(), [`### ./${FILE_NAME}\n`]);
    assertField(output, '/test_form/my_number', { calculations: fields.slice(0, 2) });
  });

  it('int used in calculation with coalesce', async () => {
    const fields = [
      {
        name: '/test_form/my_calc',
        type: 'string',
        calculate: 'coalesce( /test_form/my_number, 0 ) + coalesce(/test_form/my_number,0)'
      },
      { name: '/test_form/my_number', type: 'int' }
    ];
    const data = await domParser.parseFromString(createXml(fields));

    nonRequiredNumbers(outStream, CONFIG_DIR, [{ fileName: FILE_PATH, data }]);

    assert.equal(outStream.write.callCount, 0);
  });

  it('two numbers used in a calculation', async () => {
    const fields = [
      { name: '/test_form/group_1/my_number', type: 'int' },
      { name: '/test_form/group_2/my_number', type: 'decimal' },
      {
        name: '/test_form/my_calc',
        type: 'string',
        calculate: '/test_form/group_1/my_number + /test_form/group_2/my_number'
      }
    ];
    const data = await domParser.parseFromString(createXml(fields));

    nonRequiredNumbers(outStream, CONFIG_DIR, [{ fileName: FILE_PATH, data }]);

    const output = outStream.write.args;
    assertIntro(output);
    assert.deepEqual(output.shift(), [`### ./${FILE_NAME}\n`]);
    assertField(output, '/test_form/group_1/my_number', { calculations: fields.slice(2) });
    assertField(output, '/test_form/group_2/my_number', { calculations: fields.slice(2) });
  });
});

const assertIntro = (output) => {
  assert.deepEqual(output.shift(), ['## Number questions to check\n']);
  assert.deepEqual(output.shift(), [
    'The value used for unanswered number questions in `calculation`s has ' +
    'changed. Previously `0` would be given to the `calculation` logic, but the new version of the CHT follows the [ODK ' +
    'spec](https://docs.getodk.org/form-logic/#empty-values) and returns `NaN` as the value of an unanswered number ' +
    'question.\n'
  ]);
  assert.deepEqual(output.shift(), [
    'This behavior change can break form logic that expects `0`. All ' +
    '`calculation`s involving non-required number questions should be reviewed (these are listed below).\n'
  ]);
  assert.deepEqual(output.shift(), [
    'One potential fix is to update the `calculation` to use the ' +
    '[coalesce](https://docs.getodk.org/form-operators-functions/#coalesce) function.So, ' +
    '`${potentially_empty_value} > 0` becomes `coalesce(${potentially_empty_value}, 0) > 0`.\n'
  ]);
  assert.deepEqual(output.shift(), [
    'See [this issue](https://github.com/medic/cht-core/issues/7222) for more ' +
    'context.\n'
  ]);
};

const assertField = (output, fieldPath, { calculations }) => {
  assert.deepEqual(output.shift(), [`#### ${fieldPath}\n`]);
  if (calculations) {
    assert.deepEqual(output.shift(), ['- calculate:\n']);
    calculations.forEach(({ name, calculate }) => {
      assert.deepEqual(output.shift(), [`  - ${name}\n`]);
      assert.deepEqual(output.shift(), ['    ```\n']);
      assert.deepEqual(output.shift(), [`    ${calculate}\n`]);
      assert.deepEqual(output.shift(), ['    ```\n']);
    });
  }
};
