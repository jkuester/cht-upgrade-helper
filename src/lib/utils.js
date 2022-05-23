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

const getFormFields = (formData) => {
  const formModel = getFormModel(formData);

  if(!formModel.bind || !formModel.bind.length) {
    return [];
  }
  return formModel.bind.map(node => node['$']);
}

const getCalculates = (fields) => fields.filter(node => node.calculate);

const getRelevants = (fields) => fields.filter(node => node.relevant);

module.exports = {
  getFormModel,
  getFormFields,
  getCalculates,
  getRelevants
}
