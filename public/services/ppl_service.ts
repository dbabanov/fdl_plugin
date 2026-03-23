/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CoreStart } from 'opensearch-dashboards/public';

const PPL_BASE = '/api/ppl';
const PPL_SEARCH = '/search';

export default class PPLService {
  private http: CoreStart['http'];

  constructor(http: CoreStart['http']) {
    this.http = http;
  }

  fetch = async (
    params: {
      query: string;
      format: string;
    },
    dataSourceMDSId?: string,
    errorHandler?: (error: any) => void
  ) => {
    return this.http
      .post(`${PPL_BASE}${PPL_SEARCH}`, {
        body: JSON.stringify(params),
        query: {
          dataSourceMDSId,
        },
      })
      .catch((error: any) => {
        console.error('fetch error: ', error?.body ?? error);
        if (errorHandler) {
          errorHandler(error);
        }
        throw error;
      });
  };
}

