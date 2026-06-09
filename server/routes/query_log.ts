/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { schema } from '@osd/config-schema';
import { IRouter, Logger } from '../../../../src/core/server';

export function defineQueryLogRoutes(router: IRouter, logger: Logger) {
  router.post(
    {
      path: '/api/fdl_plugin/query_log',
      validate: {
        body: schema.object({
          rawQuery: schema.string(),
          normalizedQuery: schema.string(),
          finalQuery: schema.string(),
          startTime: schema.string(),
          endTime: schema.string(),
          resolvedStart: schema.string(),
          resolvedEnd: schema.string(),
          strategy: schema.string(),
        }),
      },
    },
    async (context, request, response) => {
      const {
        rawQuery,
        normalizedQuery,
        finalQuery,
        startTime,
        endTime,
        resolvedStart,
        resolvedEnd,
        strategy,
      } = request.body;

      logger.info('[FDL Plugin] PPL query execution');
      logger.info(`  raw:        ${rawQuery}`);
      logger.info(`  normalized: ${normalizedQuery}`);
      logger.info(`  final:      ${finalQuery}`);
      logger.info(
        `  time:       ${startTime} -> ${endTime} (resolved: ${resolvedStart} .. ${resolvedEnd})`
      );
      logger.info(`  strategy:   ${strategy}`);

      return response.ok({
        body: { logged: true },
      });
    }
  );
}
