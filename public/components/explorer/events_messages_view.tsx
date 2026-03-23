/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useMemo, useState } from 'react';
import {
  EuiPanel,
  EuiText,
  EuiCodeBlock,
  EuiButton,
  EuiPagination,
  EuiFormRow,
  EuiSelect,
  EuiFlexGroup,
  EuiFlexItem,
  EuiSpacer,
} from '@elastic/eui';
import moment from 'moment';

interface EventsMessagesViewProps {
  events: any[];
  totalHits: number;
  /**
   * Optional field to display under each item (e.g. '@timestamp').
   * Not required for the "message" rendering logic.
   */
  timestampField?: string;
}

const DATE_DISPLAY_FORMAT = 'MMM D, YYYY @ HH:mm:ss.SSS';
const DEFAULT_EVENTS_PER_PAGE = 10;
const EVENTS_PER_PAGE_OPTIONS = [10, 20, 50, 100, 200];
const DEFAULT_PREVIEW_LINES = 10;
const PREVIEW_LINES_OPTIONS = [5, 10, 15, 20, 30, 50, 100, 'Full'] as const;

export const EventsMessagesView: React.FC<EventsMessagesViewProps> = ({
  events,
  totalHits,
  timestampField,
}) => {
  const [pageIndex, setPageIndex] = useState(0);
  const [eventsPerPage, setEventsPerPage] = useState(DEFAULT_EVENTS_PER_PAGE);
  const [previewLines, setPreviewLines] = useState<number | 'Full'>(DEFAULT_PREVIEW_LINES);

  const { pageEvents, totalPages } = useMemo(() => {
    const safeEvents = events ?? [];
    const total = Math.max(0, safeEvents.length);
    const pages = Math.max(1, Math.ceil(total / eventsPerPage));
    const startIndex = pageIndex * eventsPerPage;
    const endIndex = Math.min(startIndex + eventsPerPage, total);

    return {
      pageEvents: safeEvents.slice(startIndex, endIndex),
      totalPages: pages,
    };
  }, [events, pageIndex, eventsPerPage]);

  const handleEventsPerPageChange = (value: string) => {
    const newPerPage = parseInt(value, 10);
    setEventsPerPage(newPerPage);
    setPageIndex(0); // Reset to first page when changing page size
  };

  const handlePreviewLinesChange = (value: string) => {
    if (value === 'Full') {
      setPreviewLines('Full');
    } else {
      setPreviewLines(parseInt(value, 10));
    }
  };

  const getTimestamp = (event: any): string | null => {
    if (!timestampField) return null;
    const timestamp = event?.[timestampField];
    if (!timestamp) return null;
    try {
      return moment(timestamp).format(DATE_DISPLAY_FORMAT);
    } catch {
      return String(timestamp);
    }
  };

  const renderEventContent = (event: any): { kind: 'message'; text: string } | { kind: 'json'; json: string } => {
    // "If object does not have message field, show all json."
    const hasOwnMessageField = event && Object.prototype.hasOwnProperty.call(event, 'message');
    const messageValue = hasOwnMessageField ? event.message : undefined;

    if (messageValue !== undefined && messageValue !== null) {
      return { kind: 'message', text: String(messageValue) };
    }

    try {
      return { kind: 'json', json: JSON.stringify(event, null, 2) };
    } catch {
      return { kind: 'json', json: String(event) };
    }
  };

  const getPreviewText = (text: string): string => {
    if (previewLines === 'Full') return text;
    const lines = text.split('\n');
    if (lines.length <= previewLines) return text;
    return lines.slice(0, previewLines).join('\n') + '\n...';
  };

  const exportToCsv = () => {
    if (!events || events.length === 0) return;

    const allFieldNames = new Set<string>();
    events.forEach((event) => {
      Object.keys(event ?? {}).forEach((key) => allFieldNames.add(key));
    });
    const fieldNames = Array.from(allFieldNames);
    const escapeCsvValue = (value: any): string => {
      if (value === null || value === undefined) return '';
      const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    const headers = fieldNames.join(',');
    const rows = events.map((event) => fieldNames.map((f) => escapeCsvValue(event?.[f])).join(','));
    const csvContent = [headers, ...rows].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `events_${moment().format('YYYY-MM-DD_HH-mm-ss')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <EuiPanel paddingSize="s">
      <EuiFlexGroup justifyContent="spaceBetween" alignItems="center" gutterSize="m">
        <EuiFlexItem grow={false}>
          <EuiText size="s" color="subdued">
            <strong>{totalHits}</strong> {totalHits === 1 ? 'event' : 'events'}
            {events.length < totalHits && ` (showing ${events.length})`}
          </EuiText>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiFormRow label="Preview lines" display="rowCompressed">
            <EuiSelect
              value={previewLines.toString()}
              onChange={(e) => handlePreviewLinesChange(e.target.value)}
              options={PREVIEW_LINES_OPTIONS.map((opt) => ({
                value: opt.toString(),
                text: opt.toString(),
              }))}
              compressed
              style={{ minWidth: '120px' }}
            />
          </EuiFormRow>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiFormRow label="Events per page" display="rowCompressed">
            <EuiSelect
              value={eventsPerPage.toString()}
              onChange={(e) => handleEventsPerPageChange(e.target.value)}
              options={EVENTS_PER_PAGE_OPTIONS.map((opt) => ({
                value: opt.toString(),
                text: opt.toString(),
              }))}
              compressed
              style={{ minWidth: '140px' }}
            />
          </EuiFormRow>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiButton
            iconType="download"
            onClick={exportToCsv}
            size="s"
            isDisabled={!events || events.length === 0}
          >
            Export CSV
          </EuiButton>
        </EuiFlexItem>
      </EuiFlexGroup>

      <EuiSpacer size="s" />

      {pageEvents.map((event, idx) => {
        const globalIndex = pageIndex * eventsPerPage + idx;
        const timestamp = getTimestamp(event);
        const content = renderEventContent(event);

        return (
          <div key={globalIndex} style={{ marginBottom: '12px' }}>
            <EuiPanel paddingSize="s" style={{ backgroundColor: '#f5f7fa' }}>
              <EuiFlexGroup direction="column" gutterSize="xs">
                <EuiFlexGroup gutterSize="s" alignItems="center" justifyContent="spaceBetween">
                  <EuiFlexItem grow={false}>
                    <EuiFlexGroup gutterSize="s" alignItems="center">
                      {timestamp && (
                        <EuiFlexItem grow={false}>
                          <EuiText size="xs" color="subdued" style={{ fontWeight: 'bold' }}>
                            {timestamp}
                          </EuiText>
                        </EuiFlexItem>
                      )}
                      <EuiFlexItem grow={false}>
                        <EuiText size="xs" color="subdued">
                          #{globalIndex + 1}
                        </EuiText>
                      </EuiFlexItem>
                    </EuiFlexGroup>
                  </EuiFlexItem>
                </EuiFlexGroup>

                <EuiFlexItem>
                  {content.kind === 'message' ? (
                    <EuiCodeBlock
                      language="text"
                      fontSize="s"
                      paddingSize="s"
                      isCopyable={false}
                      style={{ maxHeight: '220px', overflowY: 'auto', whiteSpace: 'pre-wrap' }}
                    >
                      {getPreviewText(content.text)}
                    </EuiCodeBlock>
                  ) : (
                    <EuiCodeBlock
                      language="json"
                      fontSize="s"
                      paddingSize="s"
                      isCopyable
                      style={{ maxHeight: '400px', overflowY: 'auto' }}
                    >
                      {getPreviewText(content.json)}
                    </EuiCodeBlock>
                  )}
                </EuiFlexItem>
              </EuiFlexGroup>
            </EuiPanel>
          </div>
        );
      })}

      {totalPages > 1 && (
        <>
          <EuiSpacer size="m" />
          <EuiFlexGroup justifyContent="center">
            <EuiFlexItem grow={false}>
              <EuiPagination
                pageCount={totalPages}
                activePage={pageIndex}
                onPageClick={(p) => setPageIndex(p)}
              />
            </EuiFlexItem>
          </EuiFlexGroup>
        </>
      )}
    </EuiPanel>
  );
};

