/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CoreStart } from '../../../../src/core/public';
import { PreprocessQueryDetails } from './ppl_query_utils';

const LOG_PREFIX = '[FDL Plugin]';

export const logPplQueryToConsole = (details: PreprocessQueryDetails): void => {
  const { rawQuery, normalizedQuery, finalQuery, startTime, endTime, resolvedStart, resolvedEnd, strategy } =
    details;

  // eslint-disable-next-line no-console
  console.group(`${LOG_PREFIX} PPL query execution`);
  // eslint-disable-next-line no-console
  console.log('Raw query:', rawQuery);
  // eslint-disable-next-line no-console
  console.log('Normalized query:', normalizedQuery);
  // eslint-disable-next-line no-console
  console.log('Final query (sent to /api/ppl/search):', finalQuery);
  // eslint-disable-next-line no-console
  console.log('Time picker:', { startTime, endTime });
  // eslint-disable-next-line no-console
  console.log('Resolved time bounds:', { start: resolvedStart, end: resolvedEnd });
  // eslint-disable-next-line no-console
  console.log('Rewrite strategy:', strategy);
  // eslint-disable-next-line no-console
  console.groupEnd();
};

export const logPplQueryToServer = (
  http: CoreStart['http'],
  details: PreprocessQueryDetails
): void => {
  http
    .post('/api/fdl_plugin/query_log', {
      body: JSON.stringify(details),
    })
    .catch(() => {
      // Logging must not block or surface errors to the user.
    });
};
