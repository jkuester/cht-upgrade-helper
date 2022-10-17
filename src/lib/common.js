const xpath = require('xpath');

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
};

const getCalculates = (fields) => fields.filter(node => node.calculate);

const getRelevants = (fields) => fields.filter(node => node.relevant);


const XPATH_MODEL = '/h:html/h:head/model';

const getNode = (currentNode, path) =>
  xpath.parse(path).select1({ node: currentNode, allowAnyNamespaceForNoPrefix: true });

const getNodes = (currentNode, path) =>
  xpath.parse(path).select({ node: currentNode, allowAnyNamespaceForNoPrefix: true });

module.exports = {
  XPATH_MODEL,
  getFormModel,
  getFormFields,
  getCalculates,
  getRelevants,

  /**
   * Returns the node from the form XML specified by the given XPath.
   * @param {Element} currentNode the current node in the form XML document
   * @param {string} path the XPath expression
   * @returns {Element} the selected node or `undefined` if not found
   */
  getNode,

  /**
   * Returns the nodes from the form XML specified by the given XPath.
   * @param {Element} currentNode the current node in the form XML document
   * @param {string} path the XPath expression
   * @returns {Element} the selected nodes or an empty array if none are found
   */
  getNodes,

  /**
   * Returns the `bind` nodes for the given form XML.
   * @param {Document} xmlDoc the form XML document
   * @returns {Element}
   */
  getBindNodes: xmlDoc => getNodes(xmlDoc, `${XPATH_MODEL}/bind`),

  /**
   * Returns the primary (first) `instance` node for the given form XML.
   * @param {Document} xmlDoc the form XML document
   * @returns {Element}
   */
  getPrimaryInstanceNode: xmlDoc => getNode(xmlDoc, `${XPATH_MODEL}/instance`),
};
