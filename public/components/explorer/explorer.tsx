/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  EuiPage,
  EuiPageBody,
  EuiPanel,
  EuiTabbedContent,
  EuiTabbedContentTab,
  EuiSpacer,
  EuiLoadingSpinner,
  EuiText,
  EuiFlexGroup,
  EuiFlexItem,
} from '@elastic/eui';
import { CoreStart } from '../../../../../src/core/public';
import PPLService from '../../services/ppl_service';
import { SearchBar } from './search_bar';
import { FieldsSidebar } from './fields_sidebar';
import { DataGrid } from './data_grid';
import { RawEventsView } from './raw_events_view';
import { EventsMessagesView } from './events_messages_view';
import { Timeline } from './timeline';
import { preprocessQuery } from '../../utils/ppl_query_utils';

interface IField {
  name: string;
  type: string;
}

interface ExplorerData {
  jsonData: any[];
  datarows: any[];
  schema: IField[];
  total: number;
}

interface ExplorerProps {
  http: CoreStart['http'];
  notifications: CoreStart['notifications'];
}

const LAST_RUN_STORAGE_KEY = 'fdl_plugin:last_run_query_state';

export const Explorer: React.FC<ExplorerProps> = ({ http, notifications }) => {
  const [tempQuery, setTempQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [explorerData, setExplorerData] = useState<ExplorerData | null>(null);
  const [availableFields, setAvailableFields] = useState<IField[]>([]);
  const [selectedTabId, setSelectedTabId] = useState<string>('events_messages');
  const [startTime, setStartTime] = useState<string>('now-15m');
  const [endTime, setEndTime] = useState<string>('now');
  // Used for rendering/time display in the UI (timeline, grids). Time filtering always uses @timestamp.
  const [timestampField, setTimestampField] = useState<string>('');

  const pplService = new PPLService(http);

  const addSchemaRowMapping = (queryResult: any): ExplorerData => {
    const data: any[] = [];
    queryResult.datarows?.forEach((row: any[]) => {
      const record: any = {};
      for (let i = 0; i < queryResult.schema.length; i++) {
        const cur = queryResult.schema[i];
        if (typeof row[i] === 'object') {
          record[cur.name] = JSON.stringify(row[i]);
        } else if (typeof row[i] === 'boolean') {
          record[cur.name] = row[i].toString();
        } else {
          record[cur.name] = row[i];
        }
      }
      data.push(record);
    });
    return {
      ...queryResult,
      jsonData: data,
    };
  };

  const TIME_FILTER_FIELD = '@timestamp';

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const raw = window.localStorage.getItem(LAST_RUN_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { query?: string; startTime?: string; endTime?: string };

      if (typeof saved.query === 'string') {
        setTempQuery(saved.query);
      }
      if (typeof saved.startTime === 'string') {
        setStartTime(saved.startTime);
      }
      if (typeof saved.endTime === 'string') {
        setEndTime(saved.endTime);
      }
    } catch {
      // Ignore malformed localStorage payloads and continue with defaults.
    }
  }, []);

  const handleQuerySearch = useCallback(async () => {
    if (!tempQuery.trim()) {
      notifications.toasts.addWarning({
        title: 'Empty query',
        text: 'Please enter a PPL query',
      });
      return;
    }

    setIsLoading(true);

    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(
          LAST_RUN_STORAGE_KEY,
          JSON.stringify({
            query: tempQuery.trim(),
            startTime,
            endTime,
          })
        );
      }

      // Build the query with time range filter.
      // Requirement: always use @timestamp for the time filter injection.
      const queryWithTimeFilter = preprocessQuery({
        rawQuery: tempQuery.trim(),
        startTime,
        endTime,
        timeField: TIME_FILTER_FIELD,
      });

      // Log the query being executed
      console.log('[FDL Plugin] Executing PPL Query:', queryWithTimeFilter);
      console.log('[FDL Plugin] Time filter applied using field:', TIME_FILTER_FIELD);
      console.log('[FDL Plugin] Time range:', { startTime, endTime });

      const response = await pplService.fetch({
        query: queryWithTimeFilter,
        format: 'jdbc',
      });

      if (response && response.datarows) {
        const processedData = addSchemaRowMapping(response);
        setExplorerData(processedData);
        setAvailableFields(response.schema || []);
        
        // Auto-select timestamp field if available
        const tsField = response.schema?.find((f: IField) => 
          f.type === 'timestamp' || f.name.includes('time') || f.name.includes('@timestamp')
        );
        if (tsField) {
          setTimestampField(tsField.name);
        }
      } else {
        setExplorerData(null);
        setAvailableFields([]);
      }
    } catch (error: any) {
      notifications.toasts.addError(error, {
        title: 'Query execution failed',
      });
      setExplorerData(null);
    } finally {
      setIsLoading(false);
    }
  }, [tempQuery, startTime, endTime, availableFields, pplService, notifications]);

  const escapePPLString = (value: string): string =>
    `'${value.replace(/'/g, "''")}'`;

  /**
   * Append a simple WHERE clause for field=value to the end of the query.
   * Always appends as a new command:  ... | where `field` = 'value'
   */
  const handleAddFilter = (fieldName: string, value: string) => {
    setTempQuery((prev) => {
      const trimmed = prev.trim();
      const predicate = `\`${fieldName}\` = ${escapePPLString(value)}`;
      if (!trimmed) {
        return `where ${predicate}`;
      }
      return `${trimmed} | where ${predicate}`;
    });
  };

  const handleAddTopValuesCommand = (fieldName: string) => {
    setTempQuery((prev) => {
      const trimmed = prev.trim();
      const command = `top 20 \`${fieldName}\``;
      if (!trimmed) return command;
      return `${trimmed} | ${command}`;
    });
  };

  const tabs: EuiTabbedContentTab[] = [
    {
      id: 'events_messages',
      name: 'События',
      content: (
        <div>
          {isLoading ? (
            <EuiPanel>
              <EuiLoadingSpinner size="l" />
              <EuiSpacer size="m" />
              <EuiText textAlign="center">Running query...</EuiText>
            </EuiPanel>
          ) : explorerData && explorerData.jsonData.length > 0 ? (
            <EventsMessagesView
              events={explorerData.jsonData}
              totalHits={explorerData.total || explorerData.datarows.length}
            />
          ) : (
            <EuiPanel>
              <EuiText textAlign="center">
                <h2>No results</h2>
                <p>Enter a PPL query and click Run to see results</p>
              </EuiText>
            </EuiPanel>
          )}
        </div>
      ),
    },
    {
      id: 'events',
      name: 'Json',
      content: (
        <div>
          {isLoading ? (
            <EuiPanel>
              <EuiLoadingSpinner size="l" />
              <EuiSpacer size="m" />
              <EuiText textAlign="center">Running query...</EuiText>
            </EuiPanel>
          ) : explorerData && explorerData.jsonData.length > 0 ? (
            <RawEventsView
              events={explorerData.jsonData}
              totalHits={explorerData.total || explorerData.datarows.length}
              timestampField={timestampField}
            />
          ) : (
            <EuiPanel>
              <EuiText textAlign="center">
                <h2>No results</h2>
                <p>Enter a PPL query and click Run to see results</p>
              </EuiText>
            </EuiPanel>
          )}
        </div>
      ),
    },
    {
      id: 'table',
      name: 'Таблица',
      content: (
        <div>
          {isLoading ? (
            <EuiPanel>
              <EuiLoadingSpinner size="l" />
              <EuiSpacer size="m" />
              <EuiText textAlign="center">Running query...</EuiText>
            </EuiPanel>
          ) : explorerData && explorerData.jsonData.length > 0 ? (
            <DataGrid
              rows={explorerData.jsonData}
              explorerFields={{
                availableFields,
                selectedFields: availableFields, // Show all fields in table view
                queriedFields: availableFields,
                unselectedFields: [],
              }}
              timeStampField={timestampField}
              totalHits={explorerData.total || explorerData.datarows.length}
            />
          ) : (
            <EuiPanel>
              <EuiText textAlign="center">
                <h2>No results</h2>
                <p>Enter a PPL query and click Run to see results</p>
              </EuiText>
            </EuiPanel>
          )}
        </div>
      ),
    },
    {
      id: 'charts',
      name: 'Визуализация',
      content: (
        <EuiPanel>
          <EuiText textAlign="center">
            <p>Charts visualization coming soon</p>
          </EuiText>
        </EuiPanel>
      ),
    },
  ];

  return (
    <EuiPage style={{ backgroundColor: 'transparent' }}>
      <EuiPageBody paddingSize="none">
        {/* Part 1: Query, Time Picker, Search Button */}
        <div style={{ padding: '16px' }}>
          <SearchBar
            tempQuery={tempQuery}
            onQueryChange={setTempQuery}
            onQuerySearch={handleQuerySearch}
            isLoading={isLoading}
            startTime={startTime}
            endTime={endTime}
            onStartTimeChange={setStartTime}
            onEndTimeChange={setEndTime}
          />
        </div>

        {/* Part 2: Timeline */}
        <EuiPanel paddingSize="none" style={{ margin: '0 16px' }}>
          <Timeline
            data={explorerData?.jsonData}
            timeField={timestampField}
          />
        </EuiPanel>
        <EuiSpacer size="m" />

        {/* Part 3 & 4: Fields Sidebar and Events/Table side by side */}
        <EuiFlexGroup gutterSize="s" style={{ height: 'calc(100vh - 400px)', minHeight: '500px', padding: '0 16px' }}>
          {/* Part 3: Fields Sidebar */}
          <EuiFlexItem grow={false} style={{ width: '200px', minWidth: '200px' }}>
            <div>
              <FieldsSidebar
                availableFields={availableFields}
                onAddFilter={handleAddFilter}
                onAddTopValuesCommand={handleAddTopValuesCommand}
                explorerData={explorerData}
              />
            </div>
          </EuiFlexItem>
          {/* Part 4: Events and Table */}
          <EuiFlexItem grow={true}>
            <div>
              <EuiTabbedContent
                tabs={tabs}
                selectedTab={tabs.find((tab) => tab.id === selectedTabId) || tabs[0]}
                onTabClick={(tab) => setSelectedTabId(tab.id)}
              />
            </div>
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiPageBody>
    </EuiPage>
  );
};

