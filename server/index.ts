import { PluginInitializerContext } from '../../../src/core/server';
import { FdlPluginPlugin } from './plugin';

// This exports static code and TypeScript types,
// as well as, OpenSearch Dashboards Platform `plugin()` initializer.

export function plugin(initializerContext: PluginInitializerContext) {
  return new FdlPluginPlugin(initializerContext);
}

export { FdlPluginPluginSetup, FdlPluginPluginStart } from './types';
