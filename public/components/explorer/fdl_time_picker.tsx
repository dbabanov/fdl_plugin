/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import {
  EuiButton,
  EuiButtonEmpty,
  EuiDatePicker,
  EuiFieldText,
  EuiFlexGroup,
  EuiFlexItem,
  EuiFormRow,
  EuiPopover,
  EuiRadioGroup,
  EuiSpacer,
  EuiTab,
  EuiTabs,
  EuiText,
} from '@elastic/eui';
import dateMath from '@elastic/datemath';
import moment, { Moment } from 'moment';
import { useFdlTheme } from '../../hooks/use_fdl_theme';

export interface TimePreset {
  id: string;
  label: string;
  start: string;
  end: string;
}

export const FDL_TIME_PRESETS: TimePreset[] = [
  { id: '15m', label: 'Last 15 minutes', start: 'now-15m', end: 'now' },
  { id: '60m', label: 'Last 60 minutes', start: 'now-60m', end: 'now' },
  { id: '4h', label: 'Last 4 hours', start: 'now-4h', end: 'now' },
  { id: '24h', label: 'Last 24 hours', start: 'now-24h', end: 'now' },
  { id: '7d', label: 'Last 7 days', start: 'now-7d', end: 'now' },
  { id: '30d', label: 'Last 30 days', start: 'now-30d', end: 'now' },
  { id: 'yesterday', label: 'Yesterday', start: 'now/d-1d', end: 'now/d' },
];

type RangeMode = 'between' | 'before' | 'after';
type PickerTab = 'presets' | 'range';

const EARLIEST_OPEN_RANGE = 'now-100y';
const DATE_FORMAT = 'YYYY-MM-DD';
const DATETIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';
const TIME_FORMAT = 'HH:mm:ss';
const TIME_INPUT_PATTERN = /^([01]?\d|2[0-3]):([0-5]\d):([0-5]\d)$/;
const TIME_ERROR_MESSAGE = 'Time must be in HH:mm:ss format (e.g. 14:55:33)';

interface FdlTimePickerProps {
  start: string;
  end: string;
  onTimeChange: (start: string, end: string) => void;
}

const findMatchingPreset = (start: string, end: string): TimePreset | undefined =>
  FDL_TIME_PRESETS.find((preset) => preset.start === start && preset.end === end);

const parseToMoment = (value: string): Moment | null => {
  const parsed = dateMath.parse(value);
  return parsed && parsed.isValid() ? parsed : null;
};

const isValidTimeInput = (value: string): boolean => TIME_INPUT_PATTERN.test(value.trim());

const getTimeFieldError = (value: string): string | undefined =>
  isValidTimeInput(value) ? undefined : TIME_ERROR_MESSAGE;

const splitDateAndTime = (
  value: string,
  defaultTime: string
): { date: Moment | null; time: string } => {
  const parsed = parseToMoment(value);
  if (!parsed) {
    return { date: null, time: defaultTime };
  }
  return {
    date: parsed.clone().startOf('day'),
    time: parsed.format(TIME_FORMAT),
  };
};

const combineDateAndTime = (date: Moment | null, time: string): string | null => {
  if (!date || !isValidTimeInput(time)) {
    return null;
  }
  const [hours, minutes, seconds] = time.trim().split(':').map((part) => parseInt(part, 10));
  return date
    .clone()
    .hours(hours)
    .minutes(minutes)
    .seconds(seconds)
    .milliseconds(0)
    .utc()
    .format('YYYY-MM-DDTHH:mm:ss.SSS[Z]');
};

const formatRangeLabel = (start: string, end: string): string => {
  const preset = findMatchingPreset(start, end);
  if (preset) {
    return preset.label;
  }

  const startMoment = parseToMoment(start);
  const endMoment = parseToMoment(end);

  if (startMoment && endMoment) {
    if (start === EARLIEST_OPEN_RANGE) {
      return `Before ${endMoment.format(DATETIME_FORMAT)}`;
    }
    if (end === 'now') {
      return `After ${startMoment.format(DATETIME_FORMAT)}`;
    }
    return `${startMoment.format(DATETIME_FORMAT)} — ${endMoment.format(DATETIME_FORMAT)}`;
  }

  return `${start} — ${end}`;
};

const buildCustomRange = (
  mode: RangeMode,
  fromDate: Moment | null,
  fromTime: string,
  toDate: Moment | null,
  toTime: string
): { start: string; end: string } | null => {
  if (mode === 'between') {
    const start = combineDateAndTime(fromDate, fromTime);
    const end = combineDateAndTime(toDate, toTime);
    if (!start || !end) {
      return null;
    }
    return { start, end };
  }
  if (mode === 'before') {
    const end = combineDateAndTime(toDate, toTime);
    if (!end) {
      return null;
    }
    return { start: EARLIEST_OPEN_RANGE, end };
  }
  const start = combineDateAndTime(fromDate, fromTime);
  if (!start) {
    return null;
  }
  return { start, end: 'now' };
};

const rangeModeOptions = [
  { id: 'between', label: 'Between' },
  { id: 'before', label: 'Before' },
  { id: 'after', label: 'After' },
];

export const FdlTimePicker: React.FC<FdlTimePickerProps> = ({
  start,
  end,
  onTimeChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<PickerTab>('presets');
  const [draftPresetId, setDraftPresetId] = useState<string | undefined>(
    findMatchingPreset(start, end)?.id
  );
  const [rangeMode, setRangeMode] = useState<RangeMode>('between');
  const [fromDate, setFromDate] = useState<Moment | null>(null);
  const [toDate, setToDate] = useState<Moment | null>(null);
  const [fromTime, setFromTime] = useState('00:00:00');
  const [toTime, setToTime] = useState('23:59:59');
  const [fromTimeTouched, setFromTimeTouched] = useState(false);
  const [toTimeTouched, setToTimeTouched] = useState(false);

  const theme = useFdlTheme();
  const triggerLabel = useMemo(() => formatRangeLabel(start, end), [start, end]);

  const fromTimeError = fromTimeTouched ? getTimeFieldError(fromTime) : undefined;
  const toTimeError = toTimeTouched ? getTimeFieldError(toTime) : undefined;

  const isCustomRangeValid = useMemo(() => {
    if (rangeMode === 'between') {
      return (
        !!fromDate &&
        !!toDate &&
        isValidTimeInput(fromTime) &&
        isValidTimeInput(toTime)
      );
    }
    if (rangeMode === 'before') {
      return !!toDate && isValidTimeInput(toTime);
    }
    return !!fromDate && isValidTimeInput(fromTime);
  }, [rangeMode, fromDate, toDate, fromTime, toTime]);

  const resetDraftFromProps = () => {
    setDraftPresetId(findMatchingPreset(start, end)?.id);
    const startParts = splitDateAndTime(start, '00:00:00');
    const endParts = splitDateAndTime(end, '23:59:59');
    setFromDate(startParts.date);
    setFromTime(startParts.time);
    setToDate(endParts.date);
    setToTime(endParts.time);
    setRangeMode('between');
    setActiveTab('presets');
    setFromTimeTouched(false);
    setToTimeTouched(false);
  };

  const openPopover = () => {
    resetDraftFromProps();
    setIsOpen(true);
  };

  const applyPreset = (preset: TimePreset) => {
    onTimeChange(preset.start, preset.end);
    setIsOpen(false);
  };

  const applyCustomRange = () => {
    if (!isCustomRangeValid) {
      return;
    }

    const range = buildCustomRange(rangeMode, fromDate, fromTime, toDate, toTime);
    if (!range) {
      return;
    }

    onTimeChange(range.start, range.end);
    setIsOpen(false);
  };

  const renderDateTimeInput = (
    dateLabel: string,
    timeLabel: string,
    dateValue: Moment | null,
    timeValue: string,
    timeError: string | undefined,
    onDateChange: (value: Moment | null) => void,
    onTimeChangeInput: (value: string) => void,
    onTimeTouch: () => void
  ) => (
    <>
      <EuiFormRow label={dateLabel} fullWidth>
        <EuiDatePicker
          selected={dateValue}
          onChange={onDateChange}
          showTimeSelect={false}
          dateFormat={DATE_FORMAT}
          maxDate={moment()}
          placeholder="Select date"
          fullWidth
        />
      </EuiFormRow>
      <EuiFormRow label={timeLabel} fullWidth error={timeError} isInvalid={!!timeError}>
        <EuiFieldText
          value={timeValue}
          onChange={(e) => {
            onTimeTouch();
            onTimeChangeInput(e.target.value);
          }}
          placeholder="HH:mm:ss"
          compressed
          fullWidth
          isInvalid={!!timeError}
          aria-invalid={!!timeError}
        />
      </EuiFormRow>
    </>
  );

  const renderRangeFields = () => (
    <>
      <EuiRadioGroup
        options={rangeModeOptions}
        idSelected={rangeMode}
        onChange={(id) => {
          setRangeMode(id as RangeMode);
          setFromTimeTouched(false);
          setToTimeTouched(false);
        }}
        name="fdl-time-range-mode"
      />
      <EuiSpacer size="m" />
      {rangeMode === 'between' && (
        <EuiFlexGroup gutterSize="m">
          <EuiFlexItem>
            {renderDateTimeInput(
              'From date',
              'From time',
              fromDate,
              fromTime,
              fromTimeError,
              setFromDate,
              setFromTime,
              () => setFromTimeTouched(true)
            )}
          </EuiFlexItem>
          <EuiFlexItem>
            {renderDateTimeInput(
              'To date',
              'To time',
              toDate,
              toTime,
              toTimeError,
              setToDate,
              setToTime,
              () => setToTimeTouched(true)
            )}
          </EuiFlexItem>
        </EuiFlexGroup>
      )}
      {rangeMode === 'before' &&
        renderDateTimeInput(
          'Before date',
          'Before time',
          toDate,
          toTime,
          toTimeError,
          setToDate,
          setToTime,
          () => setToTimeTouched(true)
        )}
      {rangeMode === 'after' &&
        renderDateTimeInput(
          'After date',
          'After time',
          fromDate,
          fromTime,
          fromTimeError,
          setFromDate,
          setFromTime,
          () => setFromTimeTouched(true)
        )}
    </>
  );

  const panel = (
    <div style={{ width: '460px' }}>
      <EuiTabs size="s">
        <EuiTab onClick={() => setActiveTab('presets')} isSelected={activeTab === 'presets'}>
          Presets
        </EuiTab>
        <EuiTab onClick={() => setActiveTab('range')} isSelected={activeTab === 'range'}>
          Date range
        </EuiTab>
      </EuiTabs>
      <EuiSpacer size="m" />
      {activeTab === 'presets' && (
        <div
          style={{
            border: `1px solid ${theme.border}`,
            borderRadius: '4px',
            overflow: 'hidden',
            backgroundColor: theme.panelBackground,
          }}
        >
          {FDL_TIME_PRESETS.map((preset) => {
            const isSelected = draftPresetId === preset.id;
            return (
              <EuiButtonEmpty
                key={preset.id}
                flush="left"
                size="s"
                onClick={() => {
                  setDraftPresetId(preset.id);
                  applyPreset(preset);
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '8px 12px',
                  backgroundColor: isSelected ? theme.presetSelected : 'transparent',
                  borderBottom: `1px solid ${theme.borderLight}`,
                  color: theme.textPrimary,
                }}
              >
                {preset.label}
              </EuiButtonEmpty>
            );
          })}
        </div>
      )}
      {activeTab === 'range' && renderRangeFields()}
      {activeTab === 'range' && (
        <>
          <EuiSpacer size="m" />
          <EuiFlexGroup justifyContent="flexEnd" gutterSize="s">
            <EuiFlexItem grow={false}>
              <EuiButtonEmpty size="s" onClick={() => setIsOpen(false)}>
                Cancel
              </EuiButtonEmpty>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiButton size="s" fill onClick={applyCustomRange} isDisabled={!isCustomRangeValid}>
                Apply
              </EuiButton>
            </EuiFlexItem>
          </EuiFlexGroup>
        </>
      )}
    </div>
  );

  return (
    <EuiPopover
      button={
        <EuiButtonEmpty
          size="s"
          iconType="calendar"
          iconSide="left"
          onClick={openPopover}
          flush="both"
          data-test-subj="fdlTimePickerButton"
        >
          <EuiText size="s">{triggerLabel}</EuiText>
        </EuiButtonEmpty>
      }
      isOpen={isOpen}
      closePopover={() => setIsOpen(false)}
      panelPaddingSize="m"
      anchorPosition="downRight"
    >
      {panel}
    </EuiPopover>
  );
};
