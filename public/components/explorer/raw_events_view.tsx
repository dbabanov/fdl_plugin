/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  EuiPanel,
  EuiText,
  EuiSpacer,
  EuiCodeBlock,
  EuiPagination,
  EuiFlexGroup,
  EuiFlexItem,
  EuiButtonIcon,
  EuiToolTip,
  EuiButtonEmpty,
  EuiPopover,
  EuiContextMenuItem,
  EuiContextMenuPanel,
  EuiLink,
} from '@elastic/eui';
import moment from 'moment';
import { useFdlTheme } from '../../hooks/use_fdl_theme';

interface RawEventsViewProps {
  events: any[];
  totalHits: number;
  timestampField?: string;
}

const DATE_DISPLAY_FORMAT = 'MMM D, YYYY @ HH:mm:ss.SSS';
const DEFAULT_EVENTS_PER_PAGE = 10;
const EVENTS_PER_PAGE_OPTIONS = [10, 20, 50, 100, 200];
const DEFAULT_PREVIEW_LINES = 10;
const PREVIEW_LINES_OPTIONS = [5, 10, 15, 20, 30, 50, 100, 'Full'] as const;

export const RawEventsView: React.FC<RawEventsViewProps> = ({
  events,
  totalHits,
  timestampField,
}) => {
  const [pageIndex, setPageIndex] = useState(0);
  const [eventsPerPage, setEventsPerPage] = useState(DEFAULT_EVENTS_PER_PAGE);
  const [previewLines, setPreviewLines] = useState<number | 'Full'>(DEFAULT_PREVIEW_LINES);
  const [expandedEvents, setExpandedEvents] = useState<Set<number>>(new Set());
  const [isPreviewMenuOpen, setIsPreviewMenuOpen] = useState(false);
  const [isPerPageMenuOpen, setIsPerPageMenuOpen] = useState(false);
  const theme = useFdlTheme();

  const totalPages = Math.ceil(events.length / eventsPerPage);
  const startIndex = pageIndex * eventsPerPage;
  const endIndex = Math.min(startIndex + eventsPerPage, events.length);
  const pageEvents = events.slice(startIndex, endIndex);

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

  const getEventLineCount = (eventJson: string): number => eventJson.split('\n').length;

  const isEventPreviewTruncated = (eventJson: string): boolean => {
    if (previewLines === 'Full') {
      return false;
    }
    return getEventLineCount(eventJson) > previewLines;
  };

  const getPreviewText = (eventJson: string): string => {
    if (previewLines === 'Full') {
      return eventJson;
    }
    const lines = eventJson.split('\n');
    if (lines.length <= previewLines) {
      return eventJson;
    }
    return lines.slice(0, previewLines).join('\n');
  };

  const toggleEvent = (index: number) => {
    const globalIndex = startIndex + index;
    const newExpanded = new Set(expandedEvents);
    if (newExpanded.has(globalIndex)) {
      newExpanded.delete(globalIndex);
    } else {
      newExpanded.add(globalIndex);
    }
    setExpandedEvents(newExpanded);
  };

  const formatEvent = (event: any): string => {
    try {
      return JSON.stringify(event, null, 2);
    } catch (e) {
      return String(event);
    }
  };

  const getTimestamp = (event: any): string | null => {
    if (!timestampField) return null;
    const timestamp = event[timestampField];
    if (!timestamp) return null;
    try {
      return moment(timestamp).format(DATE_DISPLAY_FORMAT);
    } catch (e) {
      return String(timestamp);
    }
  };

  const escapeCsvValue = (value: any): string => {
    if (value === null || value === undefined) {
      return '';
    }
    const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
    // Escape quotes and wrap in quotes if contains comma, quote, or newline
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  const exportToCsv = () => {
    if (!events || events.length === 0) {
      return;
    }

    // Get all unique field names from all events
    const allFieldNames = new Set<string>();
    events.forEach((event) => {
      Object.keys(event).forEach((key) => allFieldNames.add(key));
    });
    const fieldNames = Array.from(allFieldNames);

    // Create CSV header
    const headers = fieldNames.join(',');
    
    // Create CSV rows
    const rows = events.map((event) => {
      return fieldNames.map((fieldName) => escapeCsvValue(event[fieldName])).join(',');
    });

    // Combine header and rows
    const csvContent = [headers, ...rows].join('\n');

    // Create blob and download
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
      <div
        style={{
          border: `1px solid ${theme.border}`,
          borderRadius: '4px',
          overflow: 'hidden',
          backgroundColor: theme.panelBackground,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 10px',
            borderBottom: `1px solid ${theme.border}`,
            backgroundColor: theme.toolbarBackground,
            fontSize: '12px',
            color: theme.textSubdued,
          }}
        >
          <div style={{ display: 'flex', gap: '14px' }}>
            <EuiPopover
              button={
                <EuiButtonEmpty
                  size="xs"
                  iconType="arrowDown"
                  iconSide="right"
                  onClick={() => setIsPreviewMenuOpen((v) => !v)}
                  flush="both"
                >
                  {`Preview lines: ${previewLines}`}
                </EuiButtonEmpty>
              }
              isOpen={isPreviewMenuOpen}
              closePopover={() => setIsPreviewMenuOpen(false)}
              panelPaddingSize="s"
              anchorPosition="downLeft"
            >
              <div style={{ maxHeight: '280px', overflowY: 'auto', minWidth: '180px' }}>
                <EuiContextMenuPanel
                  size="s"
                  items={PREVIEW_LINES_OPTIONS.map((option) => {
                    const value = option.toString();
                    const selected = previewLines.toString() === value;
                    return (
                      <EuiContextMenuItem
                        key={value}
                        icon={selected ? 'check' : 'empty'}
                        onClick={() => {
                          handlePreviewLinesChange(value);
                          setIsPreviewMenuOpen(false);
                        }}
                      >
                        {value}
                      </EuiContextMenuItem>
                    );
                  })}
                />
              </div>
            </EuiPopover>
            <EuiPopover
              button={
                <EuiButtonEmpty
                  size="xs"
                  iconType="arrowDown"
                  iconSide="right"
                  onClick={() => setIsPerPageMenuOpen((v) => !v)}
                  flush="both"
                >
                  {`Events per page: ${eventsPerPage}`}
                </EuiButtonEmpty>
              }
              isOpen={isPerPageMenuOpen}
              closePopover={() => setIsPerPageMenuOpen(false)}
              panelPaddingSize="s"
              anchorPosition="downLeft"
            >
              <div style={{ maxHeight: '280px', overflowY: 'auto', minWidth: '180px' }}>
                <EuiContextMenuPanel
                  size="s"
                  items={EVENTS_PER_PAGE_OPTIONS.map((option) => {
                    const value = option.toString();
                    const selected = eventsPerPage.toString() === value;
                    return (
                      <EuiContextMenuItem
                        key={value}
                        icon={selected ? 'check' : 'empty'}
                        onClick={() => {
                          handleEventsPerPageChange(value);
                          setIsPerPageMenuOpen(false);
                        }}
                      >
                        {value}
                      </EuiContextMenuItem>
                    );
                  })}
                />
              </div>
            </EuiPopover>
            <EuiButtonEmpty
              size="xs"
              iconType="download"
              onClick={exportToCsv}
              isDisabled={!events || events.length === 0}
              flush="both"
            >
              Export CSV
            </EuiButtonEmpty>
          </div>
          <EuiText size="xs" color="subdued">
            <strong>{totalHits}</strong> {totalHits === 1 ? 'event' : 'events'}
            {events.length < totalHits && ` (showing ${events.length})`}
          </EuiText>
        </div>
        <div style={{ padding: '8px' }}>
          {pageEvents.map((event, index) => {
            const globalIndex = startIndex + index;
            const isExpanded = expandedEvents.has(globalIndex);
            const timestamp = getTimestamp(event);
            const eventJson = formatEvent(event);

            return (
              <div key={globalIndex} style={{ marginBottom: '8px' }}>
                <EuiPanel paddingSize="s" style={{ backgroundColor: theme.toolbarBackground }}>
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
                      <EuiFlexItem grow={false}>
                        <EuiToolTip content={isExpanded ? 'Collapse' : 'Expand'}>
                          <EuiButtonIcon
                            iconType={isExpanded ? 'arrowDown' : 'arrowRight'}
                            onClick={() => toggleEvent(index)}
                            aria-label={isExpanded ? 'Collapse event' : 'Expand event'}
                          />
                        </EuiToolTip>
                      </EuiFlexItem>
                    </EuiFlexGroup>
                    <EuiFlexItem>
                      {isExpanded ? (
                        <EuiCodeBlock
                          language="json"
                          fontSize="s"
                          paddingSize="s"
                          isCopyable
                          style={{ maxHeight: '400px', overflowY: 'auto' }}
                        >
                          {eventJson}
                        </EuiCodeBlock>
                      ) : (
                        <>
                          <EuiCodeBlock
                            language="json"
                            fontSize="s"
                            paddingSize="s"
                            isCopyable={false}
                            style={{ maxHeight: '300px', overflowY: 'auto' }}
                          >
                            {getPreviewText(eventJson)}
                          </EuiCodeBlock>
                          {isEventPreviewTruncated(eventJson) && (
                            <EuiLink
                              onClick={() => toggleEvent(index)}
                              data-test-subj={`showAllLines-${globalIndex}`}
                            >
                              Показать все строки ({getEventLineCount(eventJson)})
                            </EuiLink>
                          )}
                        </>
                      )}
                    </EuiFlexItem>
                  </EuiFlexGroup>
                </EuiPanel>
              </div>
            );
          })}
        </div>
      </div>
      {totalPages > 1 && (
        <>
          <EuiSpacer size="m" />
          <EuiFlexGroup justifyContent="center">
            <EuiFlexItem grow={false}>
              <EuiPagination
                pageCount={totalPages}
                activePage={pageIndex}
                onPageClick={setPageIndex}
              />
            </EuiFlexItem>
          </EuiFlexGroup>
        </>
      )}
    </EuiPanel>
  );
};

