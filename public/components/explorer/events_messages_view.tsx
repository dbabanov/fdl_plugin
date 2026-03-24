/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useMemo, useState } from 'react';
import {
  EuiPanel,
  EuiText,
  EuiButtonEmpty,
  EuiContextMenuItem,
  EuiContextMenuPanel,
  EuiPagination,
  EuiPopover,
  EuiFlexGroup,
  EuiFlexItem,
  EuiSpacer,
} from '@elastic/eui';
import moment from 'moment';

interface EventsMessagesViewProps {
  events: any[];
  totalHits: number;
}

const TIME_DISPLAY_FORMAT = 'YYYY-MM-DD HH:mm:ss.SSS';
const DEFAULT_EVENTS_PER_PAGE = 10;
const EVENTS_PER_PAGE_OPTIONS = [10, 20, 50, 100, 200];
const DEFAULT_PREVIEW_LINES = 10;
const PREVIEW_LINES_OPTIONS = [5, 10, 15, 20, 30, 50, 100, 'Full'] as const;

export const EventsMessagesView: React.FC<EventsMessagesViewProps> = ({
  events,
  totalHits,
}) => {
  const [pageIndex, setPageIndex] = useState(0);
  const [eventsPerPage, setEventsPerPage] = useState(DEFAULT_EVENTS_PER_PAGE);
  const [previewLines, setPreviewLines] = useState<number | 'Full'>(DEFAULT_PREVIEW_LINES);
  const [isFieldMenuOpen, setIsFieldMenuOpen] = useState(false);
  const [isPreviewMenuOpen, setIsPreviewMenuOpen] = useState(false);
  const [isPerPageMenuOpen, setIsPerPageMenuOpen] = useState(false);
  const [selectedDisplayField, setSelectedDisplayField] = useState('message');
  const [expandedEvents, setExpandedEvents] = useState<Set<number>>(new Set());

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

  const displayFields = useMemo(() => {
    const fields = new Set<string>();
    (events || []).forEach((event) => {
      Object.keys(event || {}).forEach((key) => fields.add(key));
    });

    const allFields = Array.from(fields).sort((a, b) => a.localeCompare(b));
    if (!allFields.includes('message')) {
      return ['message', ...allFields];
    }
    return ['message', ...allFields.filter((f) => f !== 'message')];
  }, [events]);

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
    const timestamp = event?.['@timestamp'];
    if (!timestamp) return null;
    try {
      return moment(timestamp).format(TIME_DISPLAY_FORMAT);
    } catch {
      return String(timestamp);
    }
  };

  const renderTimestamp = (timestamp: string): JSX.Element => {
    const [datePart, timePart] = timestamp.split(' ');
    if (!timePart) return <>{timestamp}</>;
    return (
      <div style={{ lineHeight: 1.2 }}>
        <div>{datePart}</div>
        <div>{timePart}</div>
      </div>
    );
  };

  const renderEventContent = (event: any): { kind: 'field'; text: string } | { kind: 'json'; json: string } => {
    // Show selected field value; if field is missing, fallback to full JSON.
    const hasSelectedField = event && Object.prototype.hasOwnProperty.call(event, selectedDisplayField);
    const fieldValue = hasSelectedField ? event[selectedDisplayField] : undefined;

    if (fieldValue !== undefined && fieldValue !== null) {
      return { kind: 'field', text: String(fieldValue) };
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

  const toggleExpandedEvent = (eventIndex: number) => {
    setExpandedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(eventIndex)) {
        next.delete(eventIndex);
      } else {
        next.add(eventIndex);
      }
      return next;
    });
  };

  const renderAsLines = (text: string): JSX.Element => {
    const lines = text.split('\n');
    return (
      <>
        {lines.map((line, index) => (
          <div key={index}>{line || '\u00A0'}</div>
        ))}
      </>
    );
  };

  const exportToCsv = () => {
    if (!events || events.length === 0) return;

    const exportField = selectedDisplayField;
    const escapeCsvValue = (value: any): string => {
      if (value === null || value === undefined) return '';
      const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    const headers = exportField;
    const rows = events.map((event) => escapeCsvValue(event?.[exportField]));
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
      <div
        style={{
          border: '1px solid #d3dae6',
          borderRadius: '4px',
          overflow: 'hidden',
          backgroundColor: '#ffffff',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 10px',
            borderBottom: '1px solid #d3dae6',
            backgroundColor: '#f5f7fa',
            fontSize: '12px',
            color: '#69707d',
          }}
        >
          <div style={{ display: 'flex', gap: '14px' }}>
            <EuiPopover
              button={
                <EuiButtonEmpty
                  size="xs"
                  iconType="arrowDown"
                  iconSide="right"
                  onClick={() => setIsFieldMenuOpen((v) => !v)}
                  flush="both"
                >
                  {`Event: ${selectedDisplayField}`}
                </EuiButtonEmpty>
              }
              isOpen={isFieldMenuOpen}
              closePopover={() => setIsFieldMenuOpen(false)}
              panelPaddingSize="s"
              anchorPosition="downLeft"
            >
              <div style={{ maxHeight: '280px', overflowY: 'auto', minWidth: '220px' }}>
                <EuiContextMenuPanel
                  size="s"
                  items={displayFields.map((fieldName) => (
                    <EuiContextMenuItem
                      key={fieldName}
                      icon={selectedDisplayField === fieldName ? 'check' : 'empty'}
                      onClick={() => {
                        setSelectedDisplayField(fieldName);
                        setIsFieldMenuOpen(false);
                      }}
                    >
                      {fieldName}
                    </EuiContextMenuItem>
                  ))}
                />
              </div>
            </EuiPopover>
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
          <div />
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '24px 150px 1fr',
            gap: '0',
            borderBottom: '1px solid #d3dae6',
            backgroundColor: '#f5f7fa',
            fontSize: '12px',
            color: '#69707d',
            fontWeight: 600,
          }}
        >
          <div style={{ padding: '6px 8px' }}>i</div>
          <div style={{ padding: '6px 10px', borderLeft: '1px solid #e5e9f0' }}>Time</div>
          <div style={{ padding: '6px 10px', borderLeft: '1px solid #e5e9f0' }}>Event</div>
        </div>

        {pageEvents.map((event, idx) => {
          const globalIndex = pageIndex * eventsPerPage + idx;
          const timestamp = getTimestamp(event) || '-';
          const content = renderEventContent(event);
          const fullText = content.kind === 'field' ? content.text : content.json;
          const totalLines = fullText.split('\n').length;
          const isExpanded = expandedEvents.has(globalIndex);
          const isTruncationPossible = previewLines !== 'Full' && totalLines > (previewLines as number);
          const renderedText =
            isExpanded || previewLines === 'Full' ? fullText : getPreviewText(fullText);

          return (
            <div
              key={globalIndex}
              style={{
                display: 'grid',
                gridTemplateColumns: '24px 150px 1fr',
                gap: '0',
                borderBottom: '1px solid #eef1f7',
              }}
            >
              <div
                style={{
                  padding: '8px 6px',
                  fontSize: '11px',
                  color: '#98a2b3',
                  textAlign: 'center',
                }}
              >
                {'>'}
              </div>
              <div
                style={{
                  padding: '8px 10px',
                  fontSize: '12px',
                  color: '#69707d',
                  borderRight: '1px solid #eef1f7',
                  whiteSpace: 'normal',
                  overflow: 'hidden',
                }}
                title={timestamp}
              >
                {renderTimestamp(timestamp)}
              </div>
              <div
                style={{
                  padding: '8px 10px',
                  fontFamily:
                    '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace',
                  fontSize: '12px',
                  lineHeight: 1.35,
                  color: '#343741',
                  overflowX: 'auto',
                  borderLeft: '1px solid #eef1f7',
                }}
              >
                {renderAsLines(renderedText)}
                {isTruncationPossible && (
                  <div style={{ marginTop: '4px' }}>
                    <EuiButtonEmpty
                      size="xs"
                      flush="left"
                      onClick={() => toggleExpandedEvent(globalIndex)}
                    >
                      {isExpanded ? 'Show less' : `Show all ${totalLines} lines`}
                    </EuiButtonEmpty>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

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

