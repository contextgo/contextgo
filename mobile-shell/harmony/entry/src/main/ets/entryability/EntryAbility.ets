import { UIAbility } from '@kit.AbilityKit';
import { window } from '@kit.ArkUI';

export default class EntryAbility extends UIAbility {
  onWindowStageCreate(windowStage: window.WindowStage): void {
    windowStage.loadContent('pages/Index', (error) => {
      if (error && error.code) {
        console.error(`Failed to load page content: ${JSON.stringify(error)}`);
      }
    });
  }
}
