/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

export interface FdlThemeColors {
  isDarkMode: boolean;
  panelBackground: string;
  toolbarBackground: string;
  border: string;
  borderLight: string;
  borderMedium: string;
  textSubdued: string;
  textPrimary: string;
  textMuted: string;
  presetSelected: string;
  link: string;
}

export const getFdlThemeColors = (isDarkMode: boolean): FdlThemeColors => {
  if (isDarkMode) {
    return {
      isDarkMode: true,
      panelBackground: '#1D1E24',
      toolbarBackground: '#25262E',
      border: '#343741',
      borderLight: '#2B2C33',
      borderMedium: '#343741',
      textSubdued: '#98A2B3',
      textPrimary: '#DFE5EF',
      textMuted: '#69707D',
      presetSelected: '#184A70',
      link: '#1BA9F5',
    };
  }

  return {
    isDarkMode: false,
    panelBackground: '#ffffff',
    toolbarBackground: '#f5f7fa',
    border: '#d3dae6',
    borderLight: '#eef1f7',
    borderMedium: '#e5e9f0',
    textSubdued: '#69707d',
    textPrimary: '#343741',
    textMuted: '#98a2b3',
    presetSelected: '#d3e4ff',
    link: '#006BB4',
  };
};
