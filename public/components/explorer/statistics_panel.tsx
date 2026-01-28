/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  EuiPanel,
  EuiFlexGroup,
  EuiFlexItem,
  EuiStat,
} from '@elastic/eui';

interface StatisticsPanelProps {
  totalHits: number;
  startTime: string;
  endTime: string;
  isLoading: boolean;
}

export const StatisticsPanel: React.FC<StatisticsPanelProps> = ({
  totalHits,
  startTime,
  endTime,
  isLoading,
}) => {
  return (
    <EuiPanel paddingSize="s">
      <EuiFlexGroup gutterSize="l">
        <EuiFlexItem grow={false}>
          <EuiStat
            title={isLoading ? '...' : totalHits.toLocaleString()}
            description="Количество событий"
            titleSize="s"
            textAlign="left"
          />
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiStat
            title={startTime}
            description="От"
            titleSize="xs"
            textAlign="left"
          />
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiStat
            title={endTime}
            description="До"
            titleSize="xs"
            textAlign="left"
          />
        </EuiFlexItem>
      </EuiFlexGroup>
    </EuiPanel>
  );
};

