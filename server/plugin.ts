import {
  PluginInitializerContext,
  CoreSetup,
  CoreStart,
  Plugin,
  Logger,
} from '../../../src/core/server';

import { FdlPluginPluginSetup, FdlPluginPluginStart } from './types';
import { defineRoutes } from './routes';

export class FdlPluginPlugin implements Plugin<FdlPluginPluginSetup, FdlPluginPluginStart> {
  private readonly logger: Logger;

  constructor(initializerContext: PluginInitializerContext) {
    this.logger = initializerContext.logger.get();
  }

  public setup(core: CoreSetup) {
    this.logger.debug('fdlPlugin: Setup');
    const router = core.http.createRouter();

    // Register server side APIs
    defineRoutes(router);

    return {};
  }

  public start(core: CoreStart) {
    this.logger.debug('fdlPlugin: Started');
    return {};
  }

  public stop() {}
}
