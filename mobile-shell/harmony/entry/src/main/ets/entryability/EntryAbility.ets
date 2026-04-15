import { UIAbility, Want } from '@kit.AbilityKit';
import { window } from '@kit.ArkUI';

export default class EntryAbility extends UIAbility {
  private windowStage?: window.WindowStage;

  onCreate(want: Want): void {
    this.applyIncomingWant(want);
  }

  onWindowStageCreate(windowStage: window.WindowStage): void {
    this.windowStage = windowStage;
    windowStage.loadContent('pages/Index', (error) => {
      if (error && error.code) {
        console.error(`Failed to load page content: ${JSON.stringify(error)}`);
      }
    });
  }

  onNewWant(want: Want): void {
    this.applyIncomingWant(want);
    this.windowStage?.loadContent('pages/Index', (error) => {
      if (error && error.code) {
        console.error(`Failed to reload page content: ${JSON.stringify(error)}`);
      }
    });
  }

  private applyIncomingWant(want: Want): void {
    AppStorage.setOrCreate('shellIncomingUrl', want.uri ?? '');
  }
}
