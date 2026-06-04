/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  EuiPanel,
  EuiTitle,
  EuiFieldSearch,
  EuiSpacer,
  EuiListGroup,
  EuiListGroupItem,
  EuiButtonIcon,
  EuiText,
  EuiFlexGroup,
  EuiFlexItem,
  EuiPopover,
  EuiBadge,
  EuiButton,
  EuiHorizontalRule,
  EuiToolTip,
} from '@elastic/eui';
import { I18nProvider } from '@osd/i18n/react';
import isEmpty from 'lodash/isEmpty';

interface IField {
  name: string;
  type: string;
}

interface FieldValueCount {
  value: string;
  count: number;
}

interface FieldWithStats extends IField {
  topValues: FieldValueCount[];
  nonNullCount: number;
  uniqueValueCount?: number;
  coverage?: number;
}

interface FieldsSidebarProps {
  availableFields: IField[];
  /**
   * Append a WHERE filter for the given field and value to the query
   */
  onAddFilter: (fieldName: string, value: string) => void;
  /**
   * Append top-values command for a field to the query
   */
  onAddTopValuesCommand: (fieldName: string) => void;
  explorerData: any;
}

export const FieldsSidebar: React.FC<FieldsSidebarProps> = ({
  availableFields,
  onAddFilter,
  onAddTopValuesCommand,
  explorerData,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [popoverField, setPopoverField] = useState<FieldWithStats | null>(null);

  // Calculate field statistics: filter fields with non-null values and get top 10 values by count
  // Sort by "interestingness" - fields with more unique values and higher coverage are more interesting
  const fieldsWithStats = useMemo<FieldWithStats[]>(() => {
    if (!explorerData || !explorerData.jsonData || explorerData.jsonData.length === 0) {
      return [];
    }

    const totalRows = explorerData.jsonData.length;
    const stats: FieldWithStats[] = [];

    availableFields.forEach((field) => {
      const valueCounts: { [key: string]: number } = {};
      let nonNullCount = 0;

      // Count occurrences of each value for this field
      explorerData.jsonData.forEach((row: any) => {
        const value = row[field.name];
        const valueStr = value === null || value === undefined ? '' : String(value).trim();
        const isNullLikeString = valueStr.toLowerCase() === 'null';
        if (value !== null && value !== undefined && valueStr !== '' && !isNullLikeString) {
          nonNullCount++;
          valueCounts[valueStr] = (valueCounts[valueStr] || 0) + 1;
        }
      });

      // Only include fields with at least 1 non-null value
      if (nonNullCount > 0) {
        // Get top 10 values by count
        const topValues: FieldValueCount[] = Object.entries(valueCounts)
          .map(([value, count]) => ({ value, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);

        const uniqueValueCount = Object.keys(valueCounts).length;
        const coverage = nonNullCount / totalRows; // Percentage of rows with non-null values
        
        stats.push({
          ...field,
          topValues,
          nonNullCount,
          uniqueValueCount,
          coverage,
        });
      }
    });

    // Sort by interestingness:
    // 1. Higher coverage (more rows have this field)
    // 2. More unique values (more diverse data)
    // 3. Higher non-null count
    return stats.sort((a, b) => {
      // First sort by coverage (descending)
      const aCoverage = a.coverage || 0;
      const bCoverage = b.coverage || 0;
      if (Math.abs(aCoverage - bCoverage) > 0.1) {
        return bCoverage - aCoverage;
      }
      // Then by unique value count (descending) - more unique = more interesting
      const aUnique = a.uniqueValueCount || 0;
      const bUnique = b.uniqueValueCount || 0;
      if (aUnique !== bUnique) {
        return bUnique - aUnique;
      }
      // Finally by non-null count
      return b.nonNullCount - a.nonNullCount;
    });
  }, [availableFields, explorerData]);

  // Filter to only show fields with non-null values
  const filteredAvailableFields = fieldsWithStats.filter((field) =>
    field.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <I18nProvider>
      <EuiPanel paddingSize="s" style={{ height: '100%', overflowY: 'auto', overflowX: 'hidden' }}>
        <EuiTitle size="xs">
          <h3>Поля</h3>
        </EuiTitle>
        <EuiSpacer size="s" />
        <EuiFieldSearch
          compressed
          fullWidth
          placeholder="Поиск по имени"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <EuiSpacer size="m" />

        {!isEmpty(explorerData) && (
          <>
            {/* Interesting Fields Section - Like Splunk's Interesting Fields */}
            <EuiTitle size="xxs">
              <h4>Поля событий</h4>
            </EuiTitle>
            <EuiSpacer size="xs" />
            <EuiListGroup gutterSize="none">
              {filteredAvailableFields.map((field) => {
                const isPopoverOpen = popoverField?.name === field.name;
                
                return (
                  <EuiPopover
                    key={field.name}
                    button={
                      <EuiListGroupItem
                        label={
                          <EuiFlexGroup justifyContent="spaceBetween" alignItems="center" gutterSize="s">
                            <EuiFlexItem grow={true}>
                              <EuiText size="s" style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
                                <span
                                  style={{
                                    color: '#006BB4',
                                  }}
                                >
                                  {field.name}
                                </span>{' '}
                                <span style={{ color: '#98A2B3' }}>
                                  {field.uniqueValueCount !== undefined
                                    ? `${field.uniqueValueCount > 100 ? '100+' : field.uniqueValueCount}`
                                    : '0'}
                                </span>{' '}
                                ({Math.round((field.coverage || 0) * 100)} %)
                              </EuiText>
                            </EuiFlexItem>
                          </EuiFlexGroup>
                        }
                        size="s"
                        onClick={() => {
                          setPopoverField(isPopoverOpen ? null : field);
                        }}
                        style={{ cursor: 'pointer', whiteSpace: 'normal' }}
                      />
                    }
                    isOpen={isPopoverOpen}
                    closePopover={() => setPopoverField(null)}
                    anchorPosition="rightCenter"
                    panelPaddingSize="s"
                    style={{ width: '100%' }}
                  >
                    <div style={{ minWidth: '340px', maxWidth: '420px', maxHeight: '420px', overflowY: 'auto' }}>
                      <EuiText size="s" style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                        {field.name}
                      </EuiText>
                      <EuiText size="xs" color="subdued" style={{ marginBottom: '8px' }}>
                        {field.uniqueValueCount !== undefined
                          ? `${field.uniqueValueCount > 100 ? '100+' : field.uniqueValueCount} values`
                          : '0 values'}
                        {` | Event coverage: ${Math.round((field.coverage || 0) * 100)}%`}
                      </EuiText>
                      <EuiButton
                        size="s"
                        iconType="visBarVertical"
                        onClick={() => onAddTopValuesCommand(field.name)}
                      >
                        Top values
                      </EuiButton>
                      <EuiHorizontalRule margin="s" />
                      <EuiText size="xs" color="subdued" style={{ marginBottom: '8px' }}>
                        Top 10 values
                      </EuiText>
                      {field.topValues.length > 0 ? (
                        <div>
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '1fr 70px 60px',
                              columnGap: '8px',
                              padding: '0 4px 6px 4px',
                              borderBottom: '1px solid #D3DAE6',
                              marginBottom: '4px',
                            }}
                          >
                            <EuiText size="xs" color="subdued">Values</EuiText>
                            <EuiText size="xs" color="subdued">Count</EuiText>
                            <EuiText size="xs" color="subdued">%</EuiText>
                          </div>
                          {field.topValues.map((item, index) => {
                            const percent = field.nonNullCount > 0 ? (item.count / field.nonNullCount) * 100 : 0;
                            return (
                              <div
                                key={`${field.name}-${index}`}
                                onClick={() => onAddFilter(field.name, item.value)}
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: '1fr 70px 60px',
                                  columnGap: '8px',
                                  padding: '6px 4px',
                                  cursor: 'pointer',
                                  borderBottom: '1px solid #EEF1F7',
                                }}
                              >
                                <EuiToolTip content={item.value}>
                                  <EuiText size="xs" style={{ wordBreak: 'break-word' }}>
                                    {item.value.length > 100 ? `${item.value.substring(0, 100)}...` : item.value}
                                  </EuiText>
                                </EuiToolTip>
                                <EuiText size="xs">
                                  <EuiBadge color="hollow">{item.count}</EuiBadge>
                                </EuiText>
                                <EuiText size="xs">{percent.toFixed(2)}%</EuiText>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <EuiText size="xs" color="subdued">No values</EuiText>
                      )}
                    </div>
                  </EuiPopover>
                );
              })}
            </EuiListGroup>
          </>
        )}

        {isEmpty(explorerData) && (
          <EuiText size="s" color="subdued" textAlign="center">
            <p>Run a query to see available fields</p>
          </EuiText>
        )}
      </EuiPanel>
    </I18nProvider>
  );
};

