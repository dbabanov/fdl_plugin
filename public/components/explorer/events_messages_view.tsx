/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useEffect, useMemo, useState } from 'react';
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
  EuiCheckbox,
} from '@elastic/eui';
import moment from 'moment';
import { useFdlTheme } from '../../hooks/use_fdl_theme';

interface EventsMessagesViewProps {
  events: any[];
  totalHits: number;
}

const TIME_DISPLAY_FORMAT = 'YYYY-MM-DD HH:mm:ss.SSS';
const DEFAULT_EVENTS_PER_PAGE = 10;
const EVENTS_PER_PAGE_OPTIONS = [10, 20, 50, 100, 200];
const DEFAULT_PREVIEW_LINES = 10;
const PREVIEW_LINES_OPTIONS = [5, 10, 15, 20, 30, 50, 100, 'Full'] as const;
const SELECTED_FIELDS_STORAGE_KEY = 'fdl_plugin:events_selected_fields';
const DEFAULT_SELECTED_FIELDS = ['message'];

const loadSelectedFields = (): string[] => {
  if (typeof window === 'undefined') {
    return DEFAULT_SELECTED_FIELDS;
  }

  try {
    const raw = window.localStorage.getItem(SELECTED_FIELDS_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_SELECTED_FIELDS;
    }
    const saved = JSON.parse(raw);
    if (!Array.isArray(saved)) {
      return DEFAULT_SELECTED_FIELDS;
    }
    const fields = saved.filter((f): f is string => typeof f === 'string' && f.length > 0);
    return fields.length > 0 ? fields : DEFAULT_SELECTED_FIELDS;
  } catch {
    return DEFAULT_SELECTED_FIELDS;
  }
};

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
  const [selectedDisplayFields, setSelectedDisplayFields] = useState<string[]>(loadSelectedFields);
  const [expandedCells, setExpandedCells] = useState<Set<string>>(new Set());
  const theme = useFdlTheme();

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(
        SELECTED_FIELDS_STORAGE_KEY,
        JSON.stringify(selectedDisplayFields)
      );
    } catch {
      // Ignore localStorage write failures.
    }
  }, [selectedDisplayFields]);

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

  const pickerFields = useMemo(() => {
    const selected = selectedDisplayFields.filter((f) => displayFields.includes(f));
    const unselected = displayFields
      .filter((f) => !selectedDisplayFields.includes(f))
      .sort((a, b) => a.localeCompare(b));
    return [...selected, ...unselected];
  }, [displayFields, selectedDisplayFields]);

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

  const getFieldDisplayValue = (event: any, fieldName: string): string => {
    if (!event || !Object.prototype.hasOwnProperty.call(event, fieldName)) {
      return '';
    }
    const value = event[fieldName];
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value, null, 2);
      } catch {
        return String(value);
      }
    }
    return String(value);
  };

  const toggleDisplayField = (fieldName: string) => {
    setSelectedDisplayFields((prev) => {
      if (prev.includes(fieldName)) {
        if (prev.length === 1) {
          return prev;
        }
        return prev.filter((f) => f !== fieldName);
      }
      return [...prev, fieldName];
    });
  };

  const getEventPickerLabel = (): string => {
    if (selectedDisplayFields.length === 0) {
      return 'Event: —';
    }
    if (selectedDisplayFields.length <= 2) {
      return `Event: ${selectedDisplayFields.join(', ')}`;
    }
    return `Event: ${selectedDisplayFields[0]} (+${selectedDisplayFields.length - 1})`;
  };

  const gridTemplateColumns = `24px 150px ${selectedDisplayFields
    .map(() => 'minmax(120px, 1fr)')
    .join(' ')}`;

  const getPreviewText = (text: string): string => {
    if (previewLines === 'Full') return text;
    const lines = text.split('\n');
    if (lines.length <= previewLines) return text;
    return lines.slice(0, previewLines).join('\n') + '\n...';
  };

  const getCellExpandKey = (eventIndex: number, fieldName: string): string =>
    `${eventIndex}:${fieldName}`;

  const toggleExpandedCell = (eventIndex: number, fieldName: string) => {
    const key = getCellExpandKey(eventIndex, fieldName);
    setExpandedCells((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const renderFieldValue = (text: string): JSX.Element => (
    <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{text}</div>
  );

  const exportToCsv = () => {
    if (!events || events.length === 0) return;

    const escapeCsvValue = (value: any): string => {
      if (value === null || value === undefined) return '';
      const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    const headers = selectedDisplayFields.join(',');
    const rows = events.map((event) =>
      selectedDisplayFields.map((fieldName) => escapeCsvValue(event?.[fieldName])).join(',')
    );
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
                  onClick={() => setIsFieldMenuOpen((v) => !v)}
                  flush="both"
                >
                  {getEventPickerLabel()}
                </EuiButtonEmpty>
              }
              isOpen={isFieldMenuOpen}
              closePopover={() => setIsFieldMenuOpen(false)}
              panelPaddingSize="s"
              anchorPosition="downLeft"
            >
              <div style={{ maxHeight: '280px', overflowY: 'auto', minWidth: '220px', padding: '8px' }}>
                {pickerFields.map((fieldName) => {
                  const isSelected = selectedDisplayFields.includes(fieldName);
                  const isOnlySelected = isSelected && selectedDisplayFields.length === 1;
                  return (
                    <div key={fieldName} style={{ padding: '2px 0' }}>
                      <EuiCheckbox
                        id={`event-field-${fieldName}`}
                        label={fieldName}
                        checked={isSelected}
                        disabled={isOnlySelected}
                        onChange={() => toggleDisplayField(fieldName)}
                      />
                    </div>
                  );
                })}
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
            gridTemplateColumns,
            gap: '0',
            borderBottom: `1px solid ${theme.border}`,
            backgroundColor: theme.toolbarBackground,
            fontSize: '12px',
            color: theme.textSubdued,
            fontWeight: 600,
          }}
        >
          <div style={{ padding: '6px 8px' }}>i</div>
          <div style={{ padding: '6px 10px', borderLeft: `1px solid ${theme.borderMedium}` }}>Time</div>
          {selectedDisplayFields.map((fieldName) => (
            <div
              key={fieldName}
              style={{ padding: '6px 10px', borderLeft: `1px solid ${theme.borderMedium}` }}
              title={fieldName}
            >
              {fieldName}
            </div>
          ))}
        </div>

        {pageEvents.map((event, idx) => {
          const globalIndex = pageIndex * eventsPerPage + idx;
          const timestamp = getTimestamp(event) || '-';

          return (
            <div
              key={globalIndex}
              style={{
                display: 'grid',
                gridTemplateColumns,
                gap: '0',
                borderBottom: `1px solid ${theme.borderLight}`,
              }}
            >
              <div
                style={{
                  padding: '8px 6px',
                  fontSize: '11px',
                  color: theme.textMuted,
                  textAlign: 'center',
                }}
              >
                {'>'}
              </div>
              <div
                style={{
                  padding: '8px 10px',
                  fontSize: '12px',
                  color: theme.textSubdued,
                  borderRight: `1px solid ${theme.borderLight}`,
                  whiteSpace: 'normal',
                  overflow: 'hidden',
                }}
                title={timestamp}
              >
                {renderTimestamp(timestamp)}
              </div>
              {selectedDisplayFields.map((fieldName) => {
                const fullText = getFieldDisplayValue(event, fieldName);
                const totalLines = fullText ? fullText.split('\n').length : 0;
                const cellKey = getCellExpandKey(globalIndex, fieldName);
                const isExpanded = expandedCells.has(cellKey);
                const isTruncationPossible =
                  previewLines !== 'Full' && totalLines > (previewLines as number);
                const renderedText =
                  isExpanded || previewLines === 'Full' ? fullText : getPreviewText(fullText);

                return (
                  <div
                    key={fieldName}
                    style={{
                      padding: '8px 10px',
                      fontFamily:
                        '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace',
                      fontSize: '12px',
                      lineHeight: 1.35,
                      color: theme.textPrimary,
                      overflowX: 'auto',
                      borderLeft: `1px solid ${theme.borderLight}`,
                    }}
                  >
                    {fullText ? (
                      <>
                        {renderFieldValue(renderedText)}
                        {isTruncationPossible && (
                          <div style={{ marginTop: '4px' }}>
                            <EuiButtonEmpty
                              size="xs"
                              flush="left"
                              onClick={() => toggleExpandedCell(globalIndex, fieldName)}
                            >
                              {isExpanded ? 'Show less' : `Показать все ${totalLines} строки`}
                            </EuiButtonEmpty>
                          </div>
                        )}
                      </>
                    ) : (
                      <span style={{ color: theme.textMuted }}>—</span>
                    )}
                  </div>
                );
              })}
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

