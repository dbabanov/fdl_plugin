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
  selectedFields: IField[];
  onAddField: (field: IField) => void;
  onRemoveField: (field: IField) => void;
  /**
   * Append a WHERE filter for the given field and value to the query
   */
  onAddFilter: (fieldName: string, value: string) => void;
  explorerData: any;
}

export const FieldsSidebar: React.FC<FieldsSidebarProps> = ({
  availableFields,
  selectedFields,
  onAddField,
  onRemoveField,
  onAddFilter,
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
        if (value !== null && value !== undefined && value !== '') {
          nonNullCount++;
          const valueStr = String(value);
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

  // Filter selected fields to only show those with non-null values
  const selectedFieldsWithStats = selectedFields
    .map((field) => fieldsWithStats.find((f) => f.name === field.name))
    .filter((field): field is FieldWithStats => field !== undefined);
  
  const filteredSelectedFields = selectedFieldsWithStats.filter((field) =>
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
            {/* Selected Fields Section - Like Splunk's Selected Fields */}
            {filteredSelectedFields.length > 0 && (
              <>
                <EuiTitle size="xxs">
                  <h4>Selected Fields</h4>
                </EuiTitle>
                <EuiSpacer size="xs" />
                <EuiListGroup gutterSize="none">
                  {filteredSelectedFields.map((field) => (
                    <EuiListGroupItem
                      key={field.name}
                      label={
                        <EuiFlexGroup justifyContent="spaceBetween" alignItems="center" gutterSize="s">
                          <EuiFlexItem grow={true}>
                            <EuiText size="s">{field.name}</EuiText>
                          </EuiFlexItem>
                          <EuiFlexItem grow={false}>
                            <EuiButtonIcon
                              iconType="cross"
                              aria-label={`Remove ${field.name}`}
                              onClick={() => onRemoveField(field)}
                              size="s"
                            />
                          </EuiFlexItem>
                        </EuiFlexGroup>
                      }
                      size="s"
                    />
                  ))}
                </EuiListGroup>
                <EuiSpacer size="m" />
              </>
            )}

            {/* Interesting Fields Section - Like Splunk's Interesting Fields */}
            <EuiTitle size="xxs">
              <h4>Поля событий</h4>
            </EuiTitle>
            <EuiSpacer size="xs" />
            <EuiListGroup gutterSize="none">
              {filteredAvailableFields.map((field) => {
                const isSelected = selectedFields.some((sf) => sf.name === field.name);
                const isPopoverOpen = popoverField?.name === field.name;
                
                return (
                  <EuiPopover
                    key={field.name}
                    button={
                      <EuiListGroupItem
                        label={
                          <EuiFlexGroup justifyContent="spaceBetween" alignItems="center" gutterSize="s">
                        <EuiFlexItem grow={true}>
                          <EuiText size="s">
                            {field.name}
                            {field.uniqueValueCount !== undefined && (
                              <EuiText size="xs" color="subdued" style={{ marginLeft: '8px' }}>
                                ({field.uniqueValueCount > 100 ? '100+' : field.uniqueValueCount})
                              </EuiText>
                            )}
                            {field.coverage && (
                              <EuiText size="xs" color="subdued" style={{ marginLeft: '4px' }}>
                                {Math.round(field.coverage * 100)}%
                              </EuiText>
                            )}
                          </EuiText>
                        </EuiFlexItem>
                            <EuiFlexItem grow={false}>
                              {isSelected ? (
                                <EuiButtonIcon
                                  iconType="check"
                                  aria-label={`${field.name} is selected`}
                                  size="s"
                                  color="success"
                                  onClick={(e: React.MouseEvent) => {
                                    e.stopPropagation();
                                    onRemoveField(field);
                                  }}
                                />
                              ) : (
                                <EuiButtonIcon
                                  iconType="plus"
                                  aria-label={`Add ${field.name}`}
                                  onClick={(e: React.MouseEvent) => {
                                    e.stopPropagation();
                                    onAddField(field);
                                  }}
                                  size="s"
                                />
                              )}
                            </EuiFlexItem>
                          </EuiFlexGroup>
                        }
                        size="s"
                        onClick={() => {
                          setPopoverField(isPopoverOpen ? null : field);
                        }}
                        style={{ cursor: 'pointer' }}
                      />
                    }
                    isOpen={isPopoverOpen}
                    closePopover={() => setPopoverField(null)}
                    anchorPosition="rightCenter"
                    panelPaddingSize="s"
                    style={{ width: '100%' }}
                  >
                    <div style={{ minWidth: '300px', maxWidth: '400px', maxHeight: '400px', overflowY: 'auto' }}>
                      <EuiText size="s" style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                        {field.name}
                        {field.uniqueValueCount !== undefined && (
                          <EuiText size="xs" color="subdued" style={{ marginLeft: '8px', fontWeight: 'normal' }}>
                            ({field.uniqueValueCount > 100 ? '100+' : field.uniqueValueCount} values)
                          </EuiText>
                        )}
                      </EuiText>
                      <EuiText size="xs" color="subdued" style={{ marginBottom: '12px' }}>
                        Top 10 values (click to add to query)
                      </EuiText>
                      {field.topValues.length > 0 ? (
                        <EuiListGroup gutterSize="none">
                          {field.topValues.map((item, index) => (
                            <EuiListGroupItem
                              key={`${field.name}-${index}`}
                              label={
                                <EuiFlexGroup justifyContent="spaceBetween" alignItems="center" gutterSize="s">
                                  <EuiFlexItem grow={true}>
                                    <EuiText size="xs" style={{ wordBreak: 'break-word' }}>
                                      {item.value.length > 100 ? `${item.value.substring(0, 100)}...` : item.value}
                                    </EuiText>
                                  </EuiFlexItem>
                                  <EuiFlexItem grow={false}>
                                    <EuiBadge color="hollow">{item.count}</EuiBadge>
                                  </EuiFlexItem>
                                </EuiFlexGroup>
                              }
                              size="xs"
                              onClick={() => onAddFilter(field.name, item.value)}
                              style={{ cursor: 'pointer' }}
                            />
                          ))}
                        </EuiListGroup>
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

