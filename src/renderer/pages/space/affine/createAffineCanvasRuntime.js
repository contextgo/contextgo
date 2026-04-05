// @ts-nocheck
let blockSuiteRuntimePromise = null;
let extensionManagers = null;
let editorEffectsReady = false;

const createEditorContainerClass = runtime => {
  const { SignalWatcher, WithDisposable } = runtime.globalLit;
  const { ThemeProvider } = runtime.services;
  const { BlockStdScope, ShadowlessElement } = runtime.std;
  const { computed, signal } = runtime.signals;
  const { css, html } = runtime.lit;
  const { keyed } = runtime.keyedDirective;
  const { when } = runtime.whenDirective;

  return class ContextGoCanvasEditorContainer extends SignalWatcher(WithDisposable(ShadowlessElement)) {
    static styles = css`
      .affine-page-viewport {
        position: relative;
        display: flex;
        flex-direction: column;
        overflow-x: hidden;
        overflow-y: auto;
        container-name: viewport;
        container-type: inline-size;
        font-family: var(--affine-font-family);
      }

      .affine-page-viewport * {
        box-sizing: border-box;
      }

      @media print {
        .affine-page-viewport {
          height: auto;
        }
      }

      .playground-page-editor-container {
        display: block;
        flex-grow: 1;
        font-family: var(--affine-font-family);
      }

      .playground-page-editor-container * {
        box-sizing: border-box;
      }

      @media print {
        .playground-page-editor-container {
          height: auto;
        }
      }

      .edgeless-editor-container {
        position: relative;
        display: block;
        height: 100%;
        overflow: clip;
        background: var(--affine-background-primary-color);
        font-family: var(--affine-font-family);
      }

      .edgeless-editor-container * {
        box-sizing: border-box;
      }

      @media print {
        .edgeless-editor-container {
          height: auto;
        }
      }

      .affine-edgeless-viewport {
        position: relative;
        display: block;
        height: 100%;
        overflow: clip;
        container-name: viewport;
        container-type: inline-size;
      }
    `;

    static properties = {
      autofocus: { attribute: false },
    };

    autofocus = false;
    _doc = signal();
    _edgelessSpecs = signal([]);
    _mode = signal('page');
    _pageSpecs = signal([]);

    _specs = computed(() => {
      return this._mode.value === 'page' ? this._pageSpecs.value : this._edgelessSpecs.value;
    });

    _std = computed(() => {
      return new BlockStdScope({
        store: this.doc,
        extensions: this._specs.value,
      });
    });

    _editorTemplate = computed(() => {
      return this._std.value.render();
    });

    get doc() {
      return this._doc.value;
    }

    set doc(doc) {
      this._doc.value = doc;
    }

    get edgelessSpecs() {
      return this._edgelessSpecs.value;
    }

    set edgelessSpecs(specs) {
      this._edgelessSpecs.value = specs;
    }

    get host() {
      try {
        return this.std.host;
      } catch {
        return null;
      }
    }

    get mode() {
      return this._mode.value;
    }

    set mode(mode) {
      this._mode.value = mode;
    }

    get pageSpecs() {
      return this._pageSpecs.value;
    }

    set pageSpecs(specs) {
      this._pageSpecs.value = specs;
    }

    get rootModel() {
      return this.doc.root;
    }

    get std() {
      return this._std.value;
    }

    connectedCallback() {
      super.connectedCallback();
      this._disposables.add(this.doc.slots.rootAdded.subscribe(() => this.requestUpdate()));
    }

    firstUpdated() {
      if (this.mode !== 'page') {
        return;
      }

      setTimeout(() => {
        if (!this.autofocus || this.mode !== 'page') {
          return;
        }

        const richText = this.querySelector('rich-text');
        const inlineEditor = richText?.inlineEditor;
        inlineEditor?.focusEnd();
      });
    }

    render() {
      const mode = this._mode.value;
      const themeService = this.std.get(ThemeProvider);
      const appTheme = themeService.app$.value;
      const edgelessTheme = themeService.edgeless$.value;

      return html`${keyed(
        this.rootModel.id + mode,
        html`
          <div
            data-theme=${mode === 'page' ? appTheme : edgelessTheme}
            class=${mode === 'page' ? 'affine-page-viewport' : 'affine-edgeless-viewport'}
          >
            ${when(
              mode === 'page',
              () => html`<doc-title .doc=${this.doc}></doc-title>`
            )}
            <div
              class=${mode === 'page'
                ? 'page-editor playground-page-editor-container'
                : 'edgeless-editor-container'}
            >
              ${this._editorTemplate.value}
            </div>
          </div>
        `
      )}`;
    }

    switchEditor(mode) {
      this._mode.value = mode;
    }
  };
};

const loadBlockSuiteRuntime = async () => {
  if (blockSuiteRuntimePromise) {
    return blockSuiteRuntimePromise;
  }

  blockSuiteRuntimePromise = Promise.all([
    import('@blocksuite/affine/effects'),
    import('@blocksuite/affine/shared/services'),
    import('@blocksuite/affine/ext-loader'),
    import('@blocksuite/affine/extensions/store'),
    import('@blocksuite/affine/extensions/view'),
    import('@blocksuite/affine/global/lit'),
    import('@blocksuite/affine/std'),
    import('@blocksuite/affine/std/gfx'),
    import('@blocksuite/affine/store'),
    import('@blocksuite/affine/store/test'),
    import('@preact/signals-core'),
    import('lit'),
    import('lit/directives/keyed.js'),
    import('lit/directives/when.js'),
  ]).then(
    ([, services, extLoader, storeExtensions, viewExtensions, globalLit, std, gfx, store, storeTest, signals, lit, keyedDirective, whenDirective]) => ({
      extLoader,
      gfx,
      globalLit,
      keyedDirective,
      lit,
      services,
      signals,
      std,
      store,
      storeExtensions,
      storeTest,
      viewExtensions,
      whenDirective,
    })
  );

  return blockSuiteRuntimePromise;
};

const getExtensionManagers = runtime => {
  if (extensionManagers) {
    return extensionManagers;
  }

  const { StoreExtensionManager, ViewExtensionManager } = runtime.extLoader;

  extensionManagers = {
    storeManager: new StoreExtensionManager(runtime.storeExtensions.getInternalStoreExtensions()),
    viewManager: new ViewExtensionManager(runtime.viewExtensions.getInternalViewExtensions()),
  };

  return extensionManagers;
};

const ensureEditorRegistered = runtime => {
  if (editorEffectsReady) {
    return;
  }

  if (!customElements.get('affine-editor-container')) {
    customElements.define('affine-editor-container', createEditorContainerClass(runtime));
  }

  editorEffectsReady = true;
};

const createParagraphBlock = (store, Text, parentId, paragraph) => {
  return store.addBlock(
    'affine:paragraph',
    {
      text: new Text(paragraph.text),
      type: paragraph.type,
    },
    parentId
  );
};

const resolveNoteHeight = item => {
  return Math.max(item.height, 112 + Math.max(0, item.blocks.length - 1) * 28);
};

const findSelectionItem = (map, selectedIds, selectedElements) => {
  const elementIds = selectedElements
    .map(element => Reflect.get(element, 'id'))
    .filter(value => typeof value === 'string');

  for (const id of [...selectedIds, ...elementIds]) {
    const item = map.get(id);
    if (item) {
      return item;
    }
  }

  return null;
};

const waitForEditorReady = async editor => {
  await editor.updateComplete;
  await new Promise(resolve => {
    requestAnimationFrame(() => {
      requestAnimationFrame(resolve);
    });
  });
};

export const createAffineCanvasRuntime = async projection => {
  const runtime = await loadBlockSuiteRuntime();
  const { Text } = runtime.store;
  const { TestWorkspace } = runtime.storeTest;
  const { GfxControllerIdentifier } = runtime.gfx;
  const { CommunityCanvasTextFonts, FontConfigExtension } = runtime.services;
  const { storeManager, viewManager } = getExtensionManagers(runtime);

  ensureEditorRegistered(runtime);

  const workspace = new TestWorkspace();
  workspace.storeExtensions = storeManager.get('store');
  workspace.meta.initialize();

  const doc = workspace.createDoc(`contextgo-space-${Date.now()}`).getStore();
  const blockToItem = new Map();

  doc.load(() => {
    const rootId = doc.addBlock('affine:page', {
      title: new Text('ContextGo Space Canvas'),
    });

    doc.addBlock('affine:surface', {}, rootId);

    projection.items.forEach(item => {
      const noteId = doc.addBlock(
        'affine:note',
        {
          xywh: `[${item.x}, ${item.y}, ${item.width}, ${resolveNoteHeight(item)}]`,
        },
        rootId
      );
      blockToItem.set(noteId, item);

      item.blocks.forEach(paragraph => {
        const paragraphId = createParagraphBlock(doc, Text, noteId, paragraph);
        blockToItem.set(paragraphId, item);
      });
    });
  });

  doc.resetHistory();

  const editor = document.createElement('affine-editor-container');
  const sharedExtensions = [FontConfigExtension(CommunityCanvasTextFonts)];

  editor.autofocus = false;
  editor.doc = doc;
  editor.mode = 'edgeless';
  editor.pageSpecs = [...viewManager.get('page'), ...sharedExtensions];
  editor.edgelessSpecs = [...viewManager.get('edgeless'), ...sharedExtensions];

  const getGfx = () => editor.std.get(GfxControllerIdentifier);

  return {
    destroy: () => {
      try {
        getGfx().selection.clear();
      } catch {
        // Ignore teardown failures from partially mounted editors.
      }
      editor.remove();
    },
    editor,
    fitToScreen: () => {
      getGfx().fitToScreen();
    },
    ready: () => waitForEditorReady(editor),
    subscribeSelection: onSelectionChange => {
      const gfx = getGfx();
      const syncSelection = () => {
        onSelectionChange(findSelectionItem(blockToItem, gfx.selection.selectedIds, gfx.selection.selectedElements));
      };

      syncSelection();
      const subscription = gfx.selection.slots.updated.subscribe(syncSelection);

      return () => {
        subscription.unsubscribe();
      };
    },
  };
};
