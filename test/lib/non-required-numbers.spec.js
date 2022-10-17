const { expect } = require('chai');
const xml2js = require('xml2js');
const sinon = require('sinon');
const nonRequiredNumbers = require('../../src/lib/non-required-numbers');

const xmlParser = new xml2js.Parser({ normalize: true });

const CONFIG_DIR = '/config/dir';
const FILE_NAME = `test_form.xml`;
const FILE_PATH = `${CONFIG_DIR}/${FILE_NAME}`;

const createInstanceElement = (name, value) => {
  if(typeof value !== 'object') {
    return `<${name}/>`;
  }
  return `
    <${name}>
      ${Object.keys(value).map(key => createInstanceElement(key, value[key])).join('')}
    </${name}>`;
};

const createInstanceFields = fields => {
  const instance = fields.reduce((inst, { name }) => {
    const groupNames = name.split('/').slice(2);
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
<h:html>
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

  beforeEach(() => {
    outStream = { write: sinon.stub() };
  });

  afterEach(() => {
    sinon.restore();
  });

  it('int used in one calculation', async() => {
    const fields = [
      { name: '/test_form/my_calc', type: 'string', calculate: ' /test_form/my_number ' },
      { name: '/test_form/my_number', type: 'int' }
    ];
    const data = await xmlParser.parseStringPromise(createXml(fields));

    nonRequiredNumbers(outStream, CONFIG_DIR, [{ fileName: FILE_PATH, data }]);

    const output = outStream.write.args;
    assertIntro(output);
    expect(output.shift()).to.deep.equal([`### ./${FILE_NAME}\n`]);
    assertField(output, '/test_form/my_number', { calculations: fields.slice(0, 1) });
    expect(output.length).to.equal(0);
  });

  it('int used in two calculations', async() => {
    const fields = [
      { name: '/test_form/my_calc', type: 'string', calculate: ' number(/test_form/my_number) ' },
      {
        name: '/test_form/my_group/my_calc1',
        type: 'string',
        calculate: ' coalesce(/test_form/not_my_number, 0) - /test_form/my_number '
      },
      { name: '/test_form/my_number', type: 'int' }
    ];
    const data = await xmlParser.parseStringPromise(createXml(fields));

    nonRequiredNumbers(outStream, CONFIG_DIR, [{ fileName: FILE_PATH, data }]);

    const output = outStream.write.args;
    assertIntro(output);
    expect(output.shift()).to.deep.equal([`### ./${FILE_NAME}\n`]);
    assertField(output, '/test_form/my_number', { calculations: fields.slice(0, 2) });
    expect(output.length).to.equal(0);
  });

  it('int used in calculation with coalesce', async() => {
    const fields = [
      {
        name: '/test_form/my_calc',
        type: 'string',
        calculate: 'coalesce( /test_form/my_number, 0 ) + coalesce(/test_form/my_number,0)'
      },
      { name: '/test_form/my_number', type: 'int' }
    ];
    const data = await xmlParser.parseStringPromise(createXml(fields));

    nonRequiredNumbers(outStream, CONFIG_DIR, [{ fileName: FILE_PATH, data }]);

    expect(outStream.write.callCount).to.eq(0);
  });

  it('two numbers used in a calculation', async() => {
    const fields = [
      { name: '/test_form/group_1/my_number', type: 'int' },
      { name: '/test_form/group_2/my_number', type: 'decimal' },
      {
        name: '/test_form/my_calc',
        type: 'string',
        calculate: '/test_form/group_1/my_number + /test_form/group_2/my_number'
      }
    ];
    const data = await xmlParser.parseStringPromise(createXml(fields));

    nonRequiredNumbers(outStream, CONFIG_DIR, [{ fileName: FILE_PATH, data }]);

    const output = outStream.write.args;
    assertIntro(output);
    expect(output.shift()).to.deep.equal([`### ./${FILE_NAME}\n`]);
    assertField(output, '/test_form/group_1/my_number', { calculations: fields.slice(2) });
    assertField(output, '/test_form/group_2/my_number', { calculations: fields.slice(2) });
    expect(output.length).to.equal(0);
  });
});

const assertIntro = (output) => {
  expect(output.shift()).to.deep.equal(['## Number questions to check\n']);
  expect(output.shift()).to.deep.equal(['The value used for unanswered number questions in `calculation`s has ' +
  'changed. Previously `0` would be given to the `calculation` logic, but the new version of the CHT follows the [ODK ' +
  'spec](https://docs.getodk.org/form-logic/#empty-values) and returns `NaN` as the value of an unanswered number ' +
  'question.\n']);
  expect(output.shift()).to.deep.equal(['This behavior change can break form logic that expects `0`. All ' +
  '`calculation`s involving non-required number questions should be reviewed (these are listed below).\n']);
  expect(output.shift()).to.deep.equal(['One potential fix is to update the `calculation` to use the ' +
  '[coalesce](https://docs.getodk.org/form-operators-functions/#coalesce) function.So, ' +
  '`${potentially_empty_value} > 0` becomes `coalesce(${potentially_empty_value}, 0) > 0`.\n']);
  expect(output.shift()).to.deep.equal(['See [this issue](https://github.com/medic/cht-core/issues/7222) for more ' +
  'context.\n']);
};

const assertField = (output, fieldPath, { calculations }) => {
  expect(output.shift()).to.deep.equal([`#### ${fieldPath}\n`]);
  if(calculations) {
    expect(output.shift()).to.deep.equal(['- calculate:\n']);
    calculations.forEach(({ name, calculate }) => {
      expect(output.shift()).to.deep.equal([`  - ${name}\n`]);
      expect(output.shift()).to.deep.equal(['    ```\n']);
      expect(output.shift()).to.deep.equal([`    ${calculate}\n`]);
      expect(output.shift()).to.deep.equal(['    ```\n']);
    });
  }
};
