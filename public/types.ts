import { NavigationPublicPluginStart } from '../../../src/plugins/navigation/public';

export interface FdlPluginPluginSetup {
  getGreeting: () => string;
}
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface FdlPluginPluginStart {}

export interface AppPluginStartDependencies {
  navigation: NavigationPublicPluginStart;
}
