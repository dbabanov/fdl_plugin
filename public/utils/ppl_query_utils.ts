/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import dateMath from '@elastic/datemath';
import { Moment } from 'moment';
import isEmpty from 'lodash/isEmpty';

// PPL date format: YYYY-MM-DD HH:mm:ss.SSS (matches core query_enhancements format)
export const PPL_DATE_FORMAT = 'YYYY-MM-DD HH:mm:ss.SSS';

// Regex to find insertion point for WHERE clause in PPL queries
// Matches: "source = index" or "search source = index" or "index = index"
export const PPL_INDEX_INSERT_POINT_REGEX = /(search source|source|index)\s*=\s*([^|\s]+)(.*)/i;
export const PPL_NEWLINE_REGEX = /[\n\r]+/g;
export const PPL_TABLE_COMMAND_REGEX = /(\|\s*)table(\s+)/gi;
export const PPL_FIELDS_SEGMENT_REGEX = /(\|\s*fields\s+)([^|]+)/gi;

const normalizeFieldsSegments = (query: string): string => {
  return query.replace(PPL_FIELDS_SEGMENT_REGEX, (_match, prefix: string, rawFields: string) => {
    const trimmed = rawFields.trim();
    if (!trimmed) return `${prefix}${rawFields}`;

    // If user already provided comma-separated fields, keep as is.
    if (trimmed.includes(',')) return `${prefix}${trimmed} `;

    // Split by whitespace while preserving backtick-wrapped field names.
    const parts = trimmed.match(/`[^`]+`|[^\s]+/g) || [];
    if (parts.length <= 1) return `${prefix}${trimmed} `;
    return `${prefix}${parts.join(', ')} `;
  });
};

/**
 * Converts a datetime string to PPL format
 * @param datetime - Time string (e.g., "now-15m", "2023-01-01", ISO string)
 * @param isStart - Whether this is the start time (true) or end time (false)
 * @returns Formatted date string in PPL format
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

/**
 * Preprocesses a PPL query by injecting time range filters
 * @param rawQuery - The original PPL query
 * @param startTime - Start time string (e.g., "now-15m")
 * @param endTime - End time string (e.g., "now")
 * @param timeField - The timestamp field name to filter on
 * @returns The query with time filters injected
 */
export const preprocessQuery = ({
  rawQuery,
  startTime,
  endTime,
  timeField,
}: {
  rawQuery: string;
  startTime: string;
  endTime: string;
  timeField?: string;
}): string => {
  let finalQuery = '';
  if (isEmpty(rawQuery) || !timeField) return rawQuery;
  const normalizedRawQuery = normalizeFieldsSegments(rawQuery.replace(PPL_TABLE_COMMAND_REGEX, '$1fields$2'));

  // Convert time strings to PPL format
  const start = convertDateTime(startTime, true);
  const end = convertDateTime(endTime, false);

  if (!start || !end) {
    // If time parsing fails, return original query
    return normalizedRawQuery;
  }

  // Remove newlines and find the insertion point
  const tokens = normalizedRawQuery
    .replaceAll(PPL_NEWLINE_REGEX, '')
    .match(PPL_INDEX_INSERT_POINT_REGEX);

  if (isEmpty(tokens) || !tokens) {
    // If we can't find the insertion point, try to append the WHERE clause
    // Check if query already has a WHERE clause
    const hasWhere = /\s+where\s+/i.test(normalizedRawQuery);
    if (hasWhere) {
      // Append to existing WHERE clause
      finalQuery = `${normalizedRawQuery.trim()} AND \`${timeField}\` >= '${start}' AND \`${timeField}\` <= '${end}'`;
    } else {
      // Add new WHERE clause
      finalQuery = `${normalizedRawQuery.trim()} | where \`${timeField}\` >= '${start}' AND \`${timeField}\` <= '${end}'`;
    }
  } else {
    // Insert a standalone time filter immediately after the source/index command.
    // tokens[1] = command (e.g. \"source\" or \"index\")
    // tokens[2] = index name
    // tokens[3] = rest of query (may start with a pipe or be empty)
    const restOfQuery = (tokens[3] || '').trim();
    const timeFilterClause = `\`${timeField}\` >= '${start}' AND \`${timeField}\` <= '${end}'`;

    if (restOfQuery) {
      // If restOfQuery already starts with a pipe, we just add a space so we don't create \"| |\".
      const needsSpaceOnly = restOfQuery.startsWith('|');
      const separator = needsSpaceOnly ? ' ' : ' | ';
      finalQuery = `${tokens[1]}=${tokens[2]} | where ${timeFilterClause}${separator}${restOfQuery}`;
    } else {
      // No additional pipeline, just source + time filter
      finalQuery = `${tokens[1]}=${tokens[2]} | where ${timeFilterClause}`;
    }
  }

  return finalQuery;
};

