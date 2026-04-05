export class StoreExtensionManager {
  constructor(extensions: unknown);
  get(scope: 'store'): unknown[];
}
export class ViewExtensionManager {
  constructor(extensions: unknown);
  get(scope: 'page' | 'edgeless'): unknown[];
}
