import { IRouter, Logger } from '../../../../src/core/server';
import { defineQueryLogRoutes } from './query_log';

export function defineRoutes(router: IRouter, logger: Logger) {
  defineQueryLogRoutes(router, logger);
  router.get(
    {
      path: '/api/fdl_plugin/example',
      validate: false,
    },
    async (context, request, response) => {
      return response.ok({
        body: {
          time: new Date().toISOString(),
        },
      });
    }
  );
}
