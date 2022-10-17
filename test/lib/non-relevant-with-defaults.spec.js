const { expect } = require('chai');
const xml2js = require('xml2js');
const sinon = require('sinon');
const nonRelevantWithDefaults = require('../../src/lib/non-relevant-with-defaults');

const CONFIG_DIR = '/config/dir';
const FILE_NAME = `test_form.xml`;
const FILE_PATH = `${CONFIG_DIR}/${FILE_NAME}`;

const xmlParser = new xml2js.Parser({ normalize: true });

const getXml = ({ bindData = '', nameDefault = '', summaryTitleDefault = ''} = {}) => `
<?xml version="1.0"?>
<h:html xmlns="http://www.w3.org/2002/xforms" xmlns:ev="http://www.w3.org/2001/xml-events" xmlns:h="http://www.w3.org/1999/xhtml" xmlns:jr="http://openrosa.org/javarosa" xmlns:orx="http://openrosa.org/xforms/" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <h:head>
    <h:title>Test</h:title>
    <model>
      <instance>
        <data id="ABC" version="2015-06-05">
          <name>${nameDefault}</name>
          <age/>
          <address>
            <street_nbr/>
          </address>
          <summary>
            <summary_title>${summaryTitleDefault}</summary_title>
            <details/>
          </summary>
        </data>
      </instance>
      <instance id="contact-summary"/>
      ${bindData}
      <meta>
        <instanceID/>
      </meta>
    </model>
  </h:head>
  <h:body>
    <input ref="/data/name">
      <label>What is the name?</label>
    </input>
    <input ref="/data/age">
      <label>What is the age?</label>
    </input>
  </h:body>
</h:html>`;

const createBindData = fields =>
  fields
    .map(({ name, type, calculate, constraint, readonly, relevant, required }) => {
      const calc = calculate ? `calculate="${calculate}"` : '';
      const cons = constraint ? `constraint="${constraint}"` : '';
      const read = readonly ? `readonly="${readonly}"` : '';
      const rel = relevant ? `relevant="${relevant}"` : '';
      const req = required ? `required="${required}"` : '';
      return `<bind nodeset="${name}" type="${type}" ${calc} ${cons} ${read} ${rel} ${req}/>`;
    })
    .join('');


const assertIntro = (output) => {
  expect(output.shift()).to.deep.equal(['## Non-relevant questions with defaults to check\n']);
  expect(output.shift()).to.deep.equal(['The behavior of default values for non-relevant fields has changed. ' +
    'Previously, if a question with a default value was never relevant, its default value would be used ' +
    'for calculations and other form logic.\n']);
  expect(output.shift()).to.deep.equal(['Now, however, the value from a non-relevant field will always be empty, regardless of the default value. ' +
    '(Note that because of [this known issue](https://github.com/medic/cht-core/issues/7674) it can appear that ' +
    'the default value is being used while filling out the form. However, when the form it saved, the value will be cleared ' +
    'and all the dependent logic will be recalculated.)\n']);
  expect(output.shift()).to.deep.equal(['So, questions with default values that might be non-relevant, but are used in other form logic ' +
    'should be reviewed (these are listed below).\n']);
  expect(output.shift()).to.deep.equal(['One potential fix is to add a `calculation` that can be referenced by the form logic ' +
    'instead of the non-relevant question.  The `calculate` can use the ' +
    '[coalesce](https://docs.getodk.org/form-operators-functions/#coalesce) function like this: ' +
    '`coalesce(${non_relevant_question}, *original default for non_relevant_question*)`.\n']);
};

describe('non-relevant-with-defaults', () => {
  let outStream;

  beforeEach(() => {
    outStream = { write: sinon.stub() };
  });

  afterEach(() => {
    expect(outStream.write.args.length).to.equal(0);
    sinon.restore();
  });

  [
    'calculate',
    // 'constraint',
    // 'readonly',
    'relevant',
    // 'required',
  ].forEach(evalName => {
    it(`flags question with default value that is not relevant and is used in ${evalName}`, async() => {
      const fields = [
        { name: '/data/summary/details', type: 'string' },
        { name: '/data/name', type: 'string', relevant: 'false()' }
      ];
      fields[0][evalName] = ' /data/name ';
      const data = await xmlParser.parseStringPromise(getXml({ bindData: createBindData(fields), nameDefault: 'harambe' }));

      nonRelevantWithDefaults(outStream, CONFIG_DIR, [{ fileName: FILE_PATH, data }]);

      const output = outStream.write.args;
      assertIntro(output);
      expect(output.shift()).to.deep.equal([`### ./${FILE_NAME}\n`]);
      expect(output.shift()).to.deep.equal(['  - `/data/name`\n']);
    });
  });

  it('flags multiple questions with default values that are not relevant and are used in calculate', async() => {
    const fields = [
      { name: '/data/summary/details', type: 'string', calculate: 'concat(/data/summary/summary_title, /data/name)' },
      { name: '/data/name', type: 'string', relevant: 'false()' },
      { name: '/data/age', type: 'string', relevant: 'false()' },
      { name: '/data/summary/summary_title', type: 'string', relevant: '/data/age > 1' },
      { name: '/data/address/street_nbr', type: 'string', relevant: '/data/age > 1' },
    ];
    const data = await xmlParser.parseStringPromise(getXml({ bindData: createBindData(fields), nameDefault: 'harambe', summaryTitleDefault: 'Summary:' }));

    nonRelevantWithDefaults(outStream, CONFIG_DIR, [{ fileName: FILE_PATH, data }]);

    const output = outStream.write.args;
    assertIntro(output);
    expect(output.shift()).to.deep.equal([`### ./${FILE_NAME}\n`]);
    expect(output.shift()).to.deep.equal(['  - `/data/name`\n']);
    expect(output.shift()).to.deep.equal(['  - `/data/summary/summary_title`\n']);
  });

  it('does not flag form with questions with default values that are not relevant but are not used in calculate', async() => {
    const fields = [
      { name: '/data/summary/details', type: 'string', calculate: 'concat(1, 2)' },
      { name: '/data/name', type: 'string', relevant: 'false()' },
      { name: '/data/age', type: 'string', relevant: 'false()' },
      { name: '/data/summary/summary_title', type: 'string', relevant: '/data/age > 1' },
      { name: '/data/address/street_nbr', type: 'string', relevant: '/data/age > 1' },
    ];
    const data = await xmlParser.parseStringPromise(getXml({ bindData: createBindData(fields), nameDefault: 'harambe', summaryTitleDefault: 'Summary:' }));

    nonRelevantWithDefaults(outStream, CONFIG_DIR, [{ fileName: FILE_PATH, data }]);
  });

  [
    '',
    // 'true()'
  ].forEach(relevant => {
    it('does not flag form with questions with default values that are always relevant and are used in calculate', async() => {
      const fields = [
        { name: '/data/summary/details', type: 'string', calculate: 'concat(/data/summary/summary_title, /data/name)' },
        { name: '/data/name', type: 'string', relevant },
        { name: '/data/age', type: 'string', relevant: 'false()' },
        { name: '/data/summary/summary_title', type: 'string', relevant },
        { name: '/data/address/street_nbr', type: 'string', relevant: '/data/age > 1' },
      ];
      const data = await xmlParser.parseStringPromise(getXml({ bindData: createBindData(fields), nameDefault: 'harambe', summaryTitleDefault: 'Summary:' }));

      nonRelevantWithDefaults(outStream, CONFIG_DIR, [{ fileName: FILE_PATH, data }]);
    });
  });
});

