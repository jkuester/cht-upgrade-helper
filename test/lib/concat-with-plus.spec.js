const { assert } = require('chai');
const { DOMParser } = require('@xmldom/xmldom');
const sinon = require('sinon');
const concatWithPlus = require('../../src/lib/concat-with-plus');

const domParser = new DOMParser();

const CONFIG_DIR = '/config/dir';
const FILE_NAME = `test_form.xml`;
const FILE_PATH = `${CONFIG_DIR}/${FILE_NAME}`;

const createBinds = fields => {
  const binds = fields
    .map(({ name, type, calculate, constraint, readonly, relevant, required }) => {
      const calc = calculate ? `calculate="${calculate}"` : '';
      const constr = constraint ? `constraint="${constraint}"` : '';
      const read = readonly ? `readonly="${readonly}"` : '';
      const rel = relevant ? `relevant="${relevant}"` : '';
      const req = required ? `required="${required}"` : '';
      return `<bind nodeset="${name}" type="${type}" ${calc} ${constr} ${read} ${rel} ${req}/>`;
    });
  return binds.join('');
};

const createXml = (fields) => `
<?xml version="1.0"?>
<h:html xmlns="http://www.w3.org/2002/xforms" xmlns:ev="http://www.w3.org/2001/xml-events" xmlns:h="http://www.w3.org/1999/xhtml" xmlns:jr="http://openrosa.org/javarosa" xmlns:orx="http://openrosa.org/xforms/" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <h:head>
    <model>
      ${createBinds(fields)}
    </model>
  </h:head>
</h:html>`;

describe('concat-with-plus', () => {
  let outStream;

  beforeEach(() => outStream = { write: sinon.stub() });
  afterEach(() => assert.equal(outStream.write.args.length, 0));

  [
    'calculate',
    'constraint',
    'readonly',
    'relevant',
    'required',
  ].forEach(expressionName => {
    it(`plus used in ${expressionName}`, () => {
      const fields = [
        { name: '/test_form/my_calc', type: 'string', [expressionName]: ` &quot;hello&quot; + 'world' ` },
      ];
      const data = domParser.parseFromString(createXml(fields));

      concatWithPlus(outStream, CONFIG_DIR, [{ fileName: FILE_PATH, data }]);

      const output = outStream.write.args;
      assertIntro(output);
      assert.deepEqual(output.shift(), [`### ./${FILE_NAME}\n`]);
      assertField(output, '/test_form/my_calc', expressionName);
    });
  });

  it(`plus used in multiple fields`, () => {
    const fields = [
      { name: '/test_form/my_calc', type: 'string', calculate: ` &quot;hello&quot; + 'world' ` },
      { name: '/test_form/my_other_calc', type: 'string', calculate: ` 'world' + &quot;hello&quot; ` },
    ];
    const data = domParser.parseFromString(createXml(fields));

    concatWithPlus(outStream, CONFIG_DIR, [{ fileName: FILE_PATH, data }]);

    const output = outStream.write.args;
    assertIntro(output);
    assert.deepEqual(output.shift(), [`### ./${FILE_NAME}\n`]);
    assertField(output, '/test_form/my_calc', 'calculate');
    assertField(output, '/test_form/my_other_calc', 'calculate');
  });

  it(`plus used in multiple expressions in the same field`, () => {
    const fields = [
      { name: '/test_form/my_calc', type: 'string', calculate: ` &quot;hello&quot; + 'world' `, readonly: ` 'world' + &quot;hello&quot; ` },
    ];
    const data = domParser.parseFromString(createXml(fields));

    concatWithPlus(outStream, CONFIG_DIR, [{ fileName: FILE_PATH, data }]);

    const output = outStream.write.args;
    assertIntro(output);
    assert.deepEqual(output.shift(), [`### ./${FILE_NAME}\n`]);
    assertField(output, '/test_form/my_calc', 'calculate,readonly');
  });
});

const assertIntro = (output) => {
  assert.deepEqual(output.shift(), ['## String literal concatenations to check\n']);
  assert.deepEqual(output.shift(), [
    'Previous versions of Enketo supported concatenating strings with the `+` operator, but it was never ' +
    'part of the ODK Specification. This functionality no longer works in later versions of Enketo and results in `NaN`.\n'
  ]);
  assert.deepEqual(output.shift(), [
    'The [`concat` function](https://docs.getodk.org/form-operators-functions/#concat) should be used instead.\n'
  ]);
};

const assertField = (output, fieldPath, expressions) => {
  assert.equal(output.shift(), `- ${fieldPath} - ${expressions} \n`);
};
