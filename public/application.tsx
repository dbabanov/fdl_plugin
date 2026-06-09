import React from 'react';
import ReactDOM from 'react-dom';
import { AppMountParameters, CoreStart } from '../../../src/core/public';
import { OpenSearchDashboardsContextProvider } from '../../../src/plugins/opensearch_dashboards_react/public';
import { AppPluginStartDependencies } from './types';
import { Explorer } from './components/explorer/explorer';

export const renderApp = (
  core: CoreStart,
  { navigation }: AppPluginStartDependencies,
  { element }: AppMountParameters
) => {
  ReactDOM.render(
    <OpenSearchDashboardsContextProvider services={core}>
      <Explorer http={core.http} notifications={core.notifications} />
    </OpenSearchDashboardsContextProvider>,
    element
  );

  return () => ReactDOM.unmountComponentAtNode(element);
};
