const xpath = require('xpath');

const EXPRESSION_ATTRIBUTES = ['calculate', 'constraint', 'readonly', 'relevant', 'required',];
const XPATH_MODEL = '/h:html/h:head/model';

const getNode = (currentNode, path) =>
  xpath.parse(path).select1({ node: currentNode, allowAnyNamespaceForNoPrefix: true });

const getNodes = (currentNode, path) =>
  xpath.parse(path).select({ node: currentNode, allowAnyNamespaceForNoPrefix: true });

module.exports = {
  EXPRESSION_ATTRIBUTES,
  XPATH_MODEL,

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
