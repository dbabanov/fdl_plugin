/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import dateMath from '@elastic/datemath';
import { Moment } from 'moment';
import isEmpty from 'lodash/isEmpty';

// Absolute timestamps for search earliest/latest and | where @timestamp (no fractional seconds).
export const PPL_DATE_FORMAT = 'YYYY-MM-DD HH:mm:ss';

/**
 * search earliest/latest modifiers require OpenSearch >= 3.3 (sql#4224).
 * Set false only when targeting older clusters that lack this feature.
 */
export const PPL_SUPPORTS_SEARCH_TIME_MODIFIERS = true;

export const PPL_NEWLINE_REGEX = /[\n\r]+/g;
export const PPL_TABLE_COMMAND_REGEX = /(\|\s*)table(\s+)/gi;
export const PPL_FIELDS_SEGMENT_REGEX = /(\|\s*fields\s+)([^|]+)/gi;

const PPL_SEARCH_PREFIX_REGEX = /^\s*search\b/i;
const PPL_SOURCE_REGEX = /\b(?:source|index)\s*=\s*([^\s|]+)/i;
const PPL_EARLIEST_REGEX = /\bearliest=(?:'[^']*'|"[^"]*"|\S+)/gi;
const PPL_LATEST_REGEX = /\blatest=(?:'[^']*'|"[^"]*"|\S+)/gi;
const PPL_RELATIVE_TIME_REGEX = /^now-(\d+)([smhdwMy])(?:\/.*)?$/;

const normalizeFieldsSegments = (query: string): string => {
  return query.replace(PPL_FIELDS_SEGMENT_REGEX, (_match, prefix: string, rawFields: string) => {
    const trimmed = rawFields.trim();
    if (!trimmed) return `${prefix}${rawFields}`;

    if (trimmed.includes(',')) return `${prefix}${trimmed} `;

    const parts = trimmed.match(/`[^`]+`|[^\s]+/g) || [];
    if (parts.length <= 1) return `${prefix}${trimmed} `;
    return `${prefix}${parts.join(', ')} `;
  });
};

const splitHeadAndPipeline = (query: string): { head: string; pipeline: string } => {
  const pipeIndex = query.indexOf('|');
  if (pipeIndex < 0) {
    return { head: query.trim(), pipeline: '' };
  }
  return {
    head: query.slice(0, pipeIndex).trim(),
    pipeline: query.slice(pipeIndex).trim(),
  };
};

const stripTimeModifiers = (head: string): string =>
  head.replace(PPL_EARLIEST_REGEX, '').replace(PPL_LATEST_REGEX, '').replace(/\s+/g, ' ').trim();

const parseSearchHead = (
  head: string
): { index: string; searchExpression: string } | null => {
  let working = head.replace(PPL_SEARCH_PREFIX_REGEX, '').trim();
  working = stripTimeModifiers(working);

  const sourceMatch = working.match(PPL_SOURCE_REGEX);
  if (!sourceMatch) return null;

  const index = sourceMatch[1];
  const searchExpression = working.replace(PPL_SOURCE_REGEX, '').replace(/\s+/g, ' ').trim();

  return { index, searchExpression };
};

const toPplRelativeModifier = (datetime: string): string | null => {
  const trimmed = datetime.trim();
  if (trimmed === 'now') return 'now';

  const relativeMatch = trimmed.match(PPL_RELATIVE_TIME_REGEX);
  if (relativeMatch) {
    return `-${relativeMatch[1]}${relativeMatch[2]}`;
  }

  return null;
};

const formatTimeModifierValue = (value: string): string => {
  if (value === 'now' || value.startsWith('-') || value.startsWith('+') || /^-?\d+$/.test(value)) {
    return value;
  }
  return `'${value}'`;
};

const buildSearchTimeModifiers = ({
  startTime,
  endTime,
  earliest,
  latest,
}: {
  startTime: string;
  endTime: string;
  earliest: string;
  latest: string;
}): string => {
  const relativeStart = toPplRelativeModifier(startTime);
  const relativeEnd = toPplRelativeModifier(endTime);

  const earliestValue = relativeStart ?? earliest;
  const latestValue = relativeEnd ?? latest;

  return `earliest=${formatTimeModifierValue(earliestValue)} latest=${formatTimeModifierValue(latestValue)}`;
};

const buildTimestampWhereClause = (earliest: string, latest: string): string =>
  `| where \`@timestamp\` >= '${earliest}' AND \`@timestamp\` <= '${latest}'`;

const buildSearchQuery = ({
  index,
  searchExpression,
  startTime,
  endTime,
  earliest,
  latest,
  pipeline,
}: {
  index: string;
  searchExpression: string;
  startTime: string;
  endTime: string;
  earliest: string;
  latest: string;
  pipeline: string;
}): { finalQuery: string; strategy: PreprocessQueryStrategy } => {
  if (PPL_SUPPORTS_SEARCH_TIME_MODIFIERS) {
    const searchParts = [
      'search',
      buildSearchTimeModifiers({ startTime, endTime, earliest, latest }),
    ];
    if (searchExpression) {
      searchParts.push(searchExpression);
    }
    searchParts.push(`source=${index}`);

    const finalQuery = pipeline
      ? `${searchParts.join(' ')} ${pipeline}`
      : searchParts.join(' ');
    return { finalQuery, strategy: 'search_time_modifiers' };
  }

  const searchParts = ['search', `source=${index}`];
  if (searchExpression) {
    searchParts.push(searchExpression);
  }

  const timeFilter = buildTimestampWhereClause(earliest, latest);
  const finalQuery = pipeline
    ? `${searchParts.join(' ')} ${timeFilter} ${pipeline}`
    : `${searchParts.join(' ')} ${timeFilter}`;

  return { finalQuery, strategy: 'search_with_where_time' };
};

/**
 * Converts a datetime string to PPL absolute time format (no milliseconds).
 */
export const convertDateTime = (datetime: string, isStart: boolean = true): string => {
  let returnTime: Moment | null = null;

  if (isStart) {
    returnTime = dateMath.parse(datetime) || null;
  } else {
    returnTime = dateMath.parse(datetime, { roundUp: true }) || null;
  }

  if (!returnTime || !returnTime.isValid()) {
    return '';
  }

  return returnTime.utc().format(PPL_DATE_FORMAT);
};

export type PreprocessQueryStrategy =
  | 'search_time_modifiers'
  | 'search_with_where_time'
  | 'missing_source'
  | 'time_parse_failed'
  | 'empty_query';

export interface PreprocessQueryDetails {
  rawQuery: string;
  normalizedQuery: string;
  finalQuery: string;
  startTime: string;
  endTime: string;
  resolvedStart: string;
  resolvedEnd: string;
  strategy: PreprocessQueryStrategy;
}

/**
 * Normalizes and rewrites a PPL query to start with `search source=...`.
 * Time filtering uses search earliest/latest on OpenSearch >= 3.3, otherwise
 * `| where @timestamp ...` for compatibility with older clusters.
 */
export const preprocessQueryWithDetails = ({
  rawQuery,
  startTime,
  endTime,
}: {
  rawQuery: string;
  startTime: string;
  endTime: string;
}): PreprocessQueryDetails => {
  if (isEmpty(rawQuery.trim())) {
    return {
      rawQuery,
      normalizedQuery: '',
      finalQuery: '',
      startTime,
      endTime,
      resolvedStart: '',
      resolvedEnd: '',
      strategy: 'empty_query',
    };
  }

  const normalizedQuery = normalizeFieldsSegments(
    rawQuery.replace(PPL_TABLE_COMMAND_REGEX, '$1fields$2').replaceAll(PPL_NEWLINE_REGEX, ' ')
  );

  const earliest = convertDateTime(startTime, true);
  const latest = convertDateTime(endTime, false);

  if (!earliest || !latest) {
    return {
      rawQuery,
      normalizedQuery,
      finalQuery: normalizedQuery,
      startTime,
      endTime,
      resolvedStart: earliest,
      resolvedEnd: latest,
      strategy: 'time_parse_failed',
    };
  }

  const { head, pipeline } = splitHeadAndPipeline(normalizedQuery);
  const parsedHead = parseSearchHead(head);

  if (!parsedHead) {
    return {
      rawQuery,
      normalizedQuery,
      finalQuery: normalizedQuery,
      startTime,
      endTime,
      resolvedStart: earliest,
      resolvedEnd: latest,
      strategy: 'missing_source',
    };
  }

  const { finalQuery, strategy } = buildSearchQuery({
    index: parsedHead.index,
    searchExpression: parsedHead.searchExpression,
    startTime,
    endTime,
    earliest,
    latest,
    pipeline,
  });

  return {
    rawQuery,
    normalizedQuery,
    finalQuery,
    startTime,
    endTime,
    resolvedStart: earliest,
    resolvedEnd: latest,
    strategy,
  };
};

export const preprocessQuery = (params: {
  rawQuery: string;
  startTime: string;
  endTime: string;
}): string => preprocessQueryWithDetails(params).finalQuery;
