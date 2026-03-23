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
  endTime: string;
}

export const StatisticsPanel: React.FC<StatisticsPanelProps> = ({ endTime }) => {
  return (
    <EuiPanel paddingSize="s">
      <EuiFlexGroup gutterSize="l">
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

