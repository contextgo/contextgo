export class TestWorkspace {
  storeExtensions: unknown;
  meta: { initialize: () => void };
  createDoc(id: string): { getStore: () => unknown };
}
