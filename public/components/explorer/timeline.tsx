/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { EuiPanel, EuiText } from '@elastic/eui';
import moment from 'moment';
import {
  Chart,
  Axis,
  HistogramBarSeries,
  Position,
  ScaleType,
  Settings,
  TooltipType,
} from '@elastic/charts';

interface TimelineProps {
  data?: any[];
  timeField?: string;
}

export const Timeline: React.FC<TimelineProps> = ({ data, timeField }) => {
  // Process data to create time buckets for histogram
  const { chartData, dateFormat } = useMemo(() => {
    if (!data || data.length === 0 || !timeField) {
      return { chartData: [], dateFormat: 'MMM D, YYYY HH:mm' };
    }

    // Extract timestamps and find time range
    const timestamps: number[] = [];
    data.forEach((event) => {
      const timestamp = event[timeField];
      if (timestamp) {
        try {
          const time = moment(timestamp).valueOf();
          if (time && !isNaN(time)) {
            timestamps.push(time);
          }
        } catch (e) {
          // Ignore invalid timestamps
        }
      }
    });

    if (timestamps.length === 0) {
      return { chartData: [], dateFormat: 'MMM D, YYYY HH:mm' };
    }

    // Calculate time range
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);
    const calculatedTimeRange = maxTime - minTime;

    // Auto-calculate bucket size based on time range
    // Aim for approximately 50-100 buckets
    let bucketSizeMs: number;
    let format: string;
    if (calculatedTimeRange < 60000) {
      // Less than 1 minute - use 1 second buckets
      bucketSizeMs = 1000;
      format = 'MMM D, YYYY HH:mm:ss';
    } else if (calculatedTimeRange < 3600000) {
      // Less than 1 hour - use 1 minute buckets
      bucketSizeMs = 60000;
      format = 'MMM D, YYYY HH:mm';
    } else if (calculatedTimeRange < 86400000) {
      // Less than 1 day - use 1 hour buckets
      bucketSizeMs = 3600000;
      format = 'MMM D, YYYY HH:mm';
    } else if (calculatedTimeRange < 604800000) {
      // Less than 1 week - use 6 hour buckets
      bucketSizeMs = 21600000;
      format = 'MMM D, YYYY HH:mm';
    } else {
      // More than 1 week - use 1 day buckets
      bucketSizeMs = 86400000;
      format = 'MMM D, YYYY HH:mm';
    }

    // Adjust bucket size to get ~50-100 buckets
    const targetBuckets = 75;
    const currentBuckets = Math.ceil(calculatedTimeRange / bucketSizeMs);
    if (currentBuckets > targetBuckets * 2) {
      bucketSizeMs = Math.ceil(calculatedTimeRange / targetBuckets);
    }

    // Create buckets and count events
    const buckets: { [key: number]: number } = {};
    timestamps.forEach((timestamp) => {
      const bucket = Math.floor(timestamp / bucketSizeMs) * bucketSizeMs;
      buckets[bucket] = (buckets[bucket] || 0) + 1;
    });

    // Convert to chart data format
    const processedData = Object.entries(buckets)
      .map(([time, count]) => ({
        x: parseInt(time, 10),
        y: count,
      }))
      .sort((a, b) => a.x - b.x);

    return { chartData: processedData, dateFormat: format };
  }, [data, timeField]);

  // Format x-axis tick labels
  const formatXValue = (val: string | number): string => {
    const timestamp = typeof val === 'string' ? parseInt(val, 10) : val;
    return moment(timestamp).format(dateFormat);
  };

  if (!data || data.length === 0) {
    return (
      <EuiPanel paddingSize="s" style={{ height: '120px' }}>
        <EuiText size="s" color="subdued" textAlign="center">
          <p>Timeline visualization will appear here</p>
        </EuiText>
      </EuiPanel>
    );
  }

  if (!timeField || chartData.length === 0) {
    return (
      <EuiPanel paddingSize="s" style={{ height: '120px' }}>
        <EuiText size="s" color="subdued" textAlign="center">
          <p>Timeline: Event distribution over time</p>
          <p style={{ fontSize: '12px', marginTop: '8px' }}>
            {data.length} events in selected time range
          </p>
        </EuiText>
      </EuiPanel>
    );
  }

  return (
    <EuiPanel paddingSize="s" style={{ height: '120px', position: 'relative' }}>
      <div style={{ width: '100%', height: '100px', position: 'relative' }}>
        <Chart size={{ width: '100%', height: 100 }}>
          <Settings
            tooltip={{ type: TooltipType.VerticalCursor }}
            theme={{
              background: { color: 'transparent' },
            }}
          />
          <Axis
            id="bottom-axis"
            position={Position.Bottom}
            tickFormat={formatXValue}
            ticks={10}
          />
          <Axis
            id="left-axis"
            position={Position.Left}
            hide={true}
          />
          <HistogramBarSeries
            id="timeline"
            xScaleType={ScaleType.Time}
            yScaleType={ScaleType.Linear}
            xAccessor="x"
            yAccessors={['y']}
            data={chartData}
            minBarHeight={2}
          />
        </Chart>
      </div>
    </EuiPanel>
  );
};

