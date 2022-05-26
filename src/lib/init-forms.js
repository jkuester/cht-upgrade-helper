const Harness = require('cht-conf-test-harness');
const fs = require('fs');
const path = require('path');

const getFormNames = (baseDir, formType) => {
  return fs
    .readdirSync(path.join(baseDir, 'forms', formType))
    .filter(fileName => fileName.endsWith('.xml'))
    .map(fileName => fileName.substring(0, fileName.length - 4));
};

module.exports = async(outStream, configDir) => {
  const harness = new Harness({
    verbose: false,
    directory: configDir,
    harnessDataPath: `${__dirname}/../../harness.defaults.json`,
    headless: true
  });
  await harness.start();

  const appErrors = [];
  const appFormNames = getFormNames(configDir, 'app');
  for(let i = 0; i < appFormNames.length; i++) {
    const formName = appFormNames[i];
    await harness.clear();
    try {
      await harness.loadForm(formName);
    } catch(e) {
      appErrors.push({ formName, e });
    }
  }

  const contactErrors = [];
  const contactFormNames = getFormNames(configDir, 'contact');
  for(let i = 0; i < contactFormNames.length; i++) {
    const formName = contactFormNames[i];
    await harness.clear();
    try {
      const nameSegments = formName.split('-');
      const action = nameSegments.pop();
      await harness.loadContactForm(nameSegments.join('-'), action);
    } catch(e) {
      contactErrors.push({ formName, e });
    }
  }

  if(appErrors.length || contactErrors.length) {
    outStream.write('## Forms with runtime errors\n');
    outStream.write('The following forms failed to be initialized due to a runtime error. This could be caused by form ' +
      'configuration issues that need to be addressed.\n');
    appErrors.forEach(({ formName, e }) => {
      outStream.write(`### ./forms/app/${formName}\n`);
      outStream.write('```\n');
      outStream.write(`${e}\n`);
      outStream.write('```\n');
    });
    contactErrors.forEach(({ formName, e }) => {
      outStream.write(`### ./forms/contact/${formName}\n`);
      outStream.write('```\n');
      outStream.write(`${e}\n`);
      outStream.write('```\n');
    });
  }

  await harness.stop();
};
