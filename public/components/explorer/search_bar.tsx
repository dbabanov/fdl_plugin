/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect } from 'react';
import {
  EuiFlexGroup,
  EuiFlexItem,
  EuiButton,
  EuiTextArea,
  EuiFormRow,
  EuiSuperDatePicker,
  OnTimeChangeProps,
} from '@elastic/eui';
import { I18nProvider } from '@osd/i18n/react';

interface SearchBarProps {
  tempQuery: string;
  onQueryChange: (query: string) => void;
  onQuerySearch: () => void;
  isLoading: boolean;
  startTime: string;
  endTime: string;
  onStartTimeChange: (time: string) => void;
  onEndTimeChange: (time: string) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  tempQuery,
  onQueryChange,
  onQuerySearch,
  isLoading,
  startTime,
  endTime,
  onStartTimeChange,
  onEndTimeChange,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const handleTimeChange = ({ start, end }: OnTimeChangeProps) => {
    onStartTimeChange(start);
    onEndTimeChange(end);
  };

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = 'auto';
      // Set height based on scrollHeight, with min and max constraints
      const newHeight = Math.min(Math.max(textarea.scrollHeight, 32), 300);
      textarea.style.height = `${newHeight}px`;
    }
  }, [tempQuery]);

  // Callback ref to get the textarea element
  const setTextareaRef = (node: HTMLTextAreaElement | null) => {
    textareaRef.current = node;
  };

  return (
    <I18nProvider>
      <EuiFlexGroup gutterSize="s" alignItems="flexEnd" style={{ width: '100%' }}>
        <EuiFlexItem grow={true}>
          <EuiFormRow label="Введите запрос" fullWidth>
            <EuiTextArea
              inputRef={setTextareaRef}
              fullWidth
              rows={2}
              value={tempQuery}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="source = security-auditlog-* | head 100"
              data-test-subj="explorerQueryInput"
              style={{ minHeight: '32px', maxHeight: '300px', overflowY: 'auto', resize: 'none' }}
            />
          </EuiFormRow>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiSuperDatePicker
            start={startTime}
            end={endTime}
            onTimeChange={handleTimeChange}
            showUpdateButton={false}
            compressed={true}
          />
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiButton
            fill
            onClick={onQuerySearch}
            isLoading={isLoading}
            data-test-subj="explorerQueryButton"
          >
            Поиск
          </EuiButton>
        </EuiFlexItem>
      </EuiFlexGroup>
    </I18nProvider>
  );
};

