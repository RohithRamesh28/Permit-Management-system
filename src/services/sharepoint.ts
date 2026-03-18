import { Client } from '@microsoft/microsoft-graph-client';
import { getMsalInstance } from '../lib/msalConfig';

export interface SharePointListItem {
  id: string;
  fields: {
    Title: string;
    [key: string]: any;
  };
}

const getAuthenticatedClient = (): Client => {
  const msalInstance = getMsalInstance();
  const account = msalInstance.getAllAccounts()[0];

  if (!account) {
    throw new Error('No active account found. Please login first.');
  }

  return Client.init({
    authProvider: async (done) => {
      try {
        const response = await msalInstance.acquireTokenSilent({
          scopes: ['Sites.Read.All'],
          account: account,
        });
        done(null, response.accessToken);
      } catch (error) {
        console.error('Token acquisition error:', error);
        done(error as Error, null);
      }
    },
  });
};

export const getSharePointListItems = async (): Promise<string[]> => {
  try {
    const client = getAuthenticatedClient();
    const siteUrl = 'https://ontivity.sharepoint.com/sites/OntivityJobManagement';
    const listName = 'All Divisions Job List';

    const hostname = new URL(siteUrl).hostname;
    const sitePath = new URL(siteUrl).pathname;

    const response = await client
      .api(`/sites/${hostname}:${sitePath}:/lists/${listName}/items`)
      .expand('fields')
      .get();

    const titles = response.value.map((item: SharePointListItem) => item.fields.Title);
    return titles;
  } catch (error) {
    console.error('Error fetching SharePoint list items:', error);
    throw error;
  }
};
