import './index.scss';

import { FdlPluginPlugin } from './plugin';

// This exports static code and TypeScript types,
// as well as, OpenSearch Dashboards Platform `plugin()` initializer.
export function plugin() {
  return new FdlPluginPlugin();
}
export { FdlPluginPluginSetup, FdlPluginPluginStart } from './types';
