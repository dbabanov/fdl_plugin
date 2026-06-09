/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo } from 'react';
import { useUiSetting$ } from '../../../../src/plugins/opensearch_dashboards_react/public';
import { FdlThemeColors, getFdlThemeColors } from '../utils/fdl_theme';

export const useFdlTheme = (): FdlThemeColors => {
  const [isDarkMode] = useUiSetting$<boolean>('theme:darkMode', false);
  return useMemo(() => getFdlThemeColors(!!isDarkMode), [isDarkMode]);
};
