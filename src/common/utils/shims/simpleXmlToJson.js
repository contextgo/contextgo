// Normalize default export shape for BlockSuite mindmap imports in Vite/esbuild.
import {
  convertXML,
  createAST,
} from '../../../../node_modules/.bun/node_modules/simple-xml-to-json/lib/simpleXmlToJson.min.mjs';

const simpleXmlToJson = {
  convertXML,
  createAST,
};

export { convertXML, createAST };
export default simpleXmlToJson;
