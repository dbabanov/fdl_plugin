/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  EuiDataGrid,
  EuiDataGridColumn,
  EuiDataGridSorting,
  EuiPanel,
  EuiText,
  EuiSpacer,
} from '@elastic/eui';
import moment from 'moment';

interface IField {
  name: string;
  type: string;
}

interface IExplorerFields {
  availableFields: IField[];
  selectedFields: IField[];
  queriedFields: IField[];
  unselectedFields: IField[];
}

interface DataGridProps {
  rows: any[];
  explorerFields: IExplorerFields;
  timeStampField: string;
  totalHits: number;
}

const DATE_DISPLAY_FORMAT = 'MMM D, YYYY @ HH:mm:ss.SSS';

export const DataGrid: React.FC<DataGridProps> = ({
  rows,
  explorerFields,
  timeStampField,
  totalHits,
}) => {
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 100 });
  const [sortingColumns, setSortingColumns] = useState<EuiDataGridSorting['columns']>([]);

  const selectedColumns = useMemo(() => {
    // If selectedFields are provided, use them; otherwise show all available fields
    if (explorerFields.selectedFields.length > 0) {
      return explorerFields.selectedFields;
    }
    // Show all available fields, with timestamp first if available
    const allFields = [...explorerFields.queriedFields];
    if (timeStampField) {
      const timestampIndex = allFields.findIndex((f) => f.name === timeStampField);
      if (timestampIndex > 0) {
        // Move timestamp to the beginning
        const timestampFieldObj = allFields[timestampIndex];
        allFields.splice(timestampIndex, 1);
        return [timestampFieldObj, ...allFields];
      } else if (timestampIndex === -1) {
        // Timestamp field not in queriedFields, add it at the beginning
        return [{ name: timeStampField, type: 'timestamp' }, ...allFields];
      }
    }
    return allFields;
  }, [explorerFields, timeStampField]);

  const dataGridColumns = useMemo((): EuiDataGridColumn[] => {
    return selectedColumns.map((field) => {
      if (field.name === timeStampField) {
        return {
          id: timeStampField,
          display: `Time (${timeStampField})`,
          isSortable: true,
        };
      } else if (field.name === '_source') {
        return {
          id: '_source',
          display: 'Source',
          isSortable: false,
        };
      } else {
        return {
          id: field.name,
          display: field.name,
          isSortable: true,
        };
      }
    });
  }, [selectedColumns, timeStampField]);

  const dataGridColumnVisibility = useMemo(() => {
    return {
      visibleColumns: selectedColumns.map((f) => f.name),
      setVisibleColumns: () => {},
    };
  }, [selectedColumns]);

  const renderCellValue = ({ rowIndex, columnId }: { rowIndex: number; columnId: string }) => {
    const trueIndex = rowIndex % pagination.pageSize;
    if (trueIndex < rows.length) {
      const row = rows[trueIndex];
      if (columnId === '_source') {
        return JSON.stringify(row, null, 2);
      }
      if (columnId === timeStampField && row[timeStampField]) {
        return moment(row[timeStampField]).format(DATE_DISPLAY_FORMAT);
      }
      return row[columnId] != null ? String(row[columnId]) : '';
    }
    return null;
  };

  const onChangePage = (pageIndex: number) => {
    setPagination((prev) => ({ ...prev, pageIndex }));
  };

  const onChangeItemsPerPage = (pageSize: number) => {
    setPagination({ pageIndex: 0, pageSize });
  };

  return (
    <EuiPanel paddingSize="s">
      <EuiText size="s" color="subdued">
        <strong>{totalHits}</strong> {totalHits === 1 ? 'result' : 'results'}
      </EuiText>
      <EuiSpacer size="s" />
      <div style={{ height: '600px' }}>
        <EuiDataGrid
          aria-labelledby="explorerDataGrid"
          data-test-subj="explorerDataGrid"
          columns={dataGridColumns}
          columnVisibility={dataGridColumnVisibility}
          rowCount={totalHits}
          renderCellValue={renderCellValue}
          pagination={{
            ...pagination,
            pageSizeOptions: [25, 50, 100],
            onChangePage,
            onChangeItemsPerPage,
          }}
          sorting={{
            columns: sortingColumns,
            onSort: setSortingColumns,
          }}
          toolbarVisibility={{
            showColumnSelector: {
              allowHide: false,
              allowReorder: true,
            },
            showFullScreenSelector: true,
            showStyleSelector: false,
          }}
        />
      </div>
    </EuiPanel>
  );
};

