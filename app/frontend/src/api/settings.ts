import { getAPIBaseURL } from '../lib/config';
import { fetchWithRetry } from '../lib/retry';

// Don't cache the getAPIBase() URL, get it dynamically
const getAPIBase = () => `${getAPIBaseURL()}/api/v1`;

export interface EnvVariable {
  key: string;
  value: string;
  description: string;
}

export interface EnvConfig {
  backend_vars: Record<string, EnvVariable>;
  frontend_vars: Record<string, EnvVariable>;
}

export interface EnvVariableUpdate {
  value: string;
}

export const settingsApi = {
  // Fetch all configurations
  async getConfig(): Promise<EnvConfig> {
    const response = await fetchWithRetry(
      `${getAPIBase()}/admin/settings/`,
      { credentials: 'include' },
      { label: 'settings.getConfig' }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch configuration');
    }

    return response.json();
  },

  // Update backend configuration
  async updateBackendConfig(
    key: string,
    value: string
  ): Promise<{ message: string }> {
    const response = await fetchWithRetry(
      `${getAPIBase()}/admin/settings/backend/${key}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ value }),
      },
      { label: 'settings.updateBackend' }
    );

    if (!response.ok) {
      throw new Error('Failed to update backend configuration');
    }

    return response.json();
  },

  // Update frontend configuration
  async updateFrontendConfig(
    key: string,
    value: string
  ): Promise<{ message: string }> {
    const response = await fetchWithRetry(
      `${getAPIBase()}/admin/settings/frontend/${key}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ value }),
      },
      { label: 'settings.updateFrontend' }
    );

    if (!response.ok) {
      throw new Error('Failed to update frontend configuration');
    }

    return response.json();
  },

  // Add backend configuration
  async addBackendConfig(
    key: string,
    value: string
  ): Promise<{ message: string }> {
    const response = await fetchWithRetry(
      `${getAPIBase()}/admin/settings/backend/${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ value }),
      },
      { label: 'settings.addBackend' }
    );

    if (!response.ok) {
      throw new Error('Failed to add backend configuration');
    }

    return response.json();
  },

  // Add frontend configuration
  async addFrontendConfig(
    key: string,
    value: string
  ): Promise<{ message: string }> {
    const response = await fetchWithRetry(
      `${getAPIBase()}/admin/settings/frontend/${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ value }),
      },
      { label: 'settings.addFrontend' }
    );

    if (!response.ok) {
      throw new Error('Failed to add frontend configuration');
    }

    return response.json();
  },

  // Delete backend configuration
  async deleteBackendConfig(key: string): Promise<{ message: string }> {
    const response = await fetchWithRetry(
      `${getAPIBase()}/admin/settings/backend/${key}`,
      {
        method: 'DELETE',
        credentials: 'include',
      },
      { label: 'settings.deleteBackend' }
    );

    if (!response.ok) {
      throw new Error('Failed to delete backend configuration');
    }

    return response.json();
  },

  // Delete frontend configuration
  async deleteFrontendConfig(key: string): Promise<{ message: string }> {
    const response = await fetchWithRetry(
      `${getAPIBase()}/admin/settings/frontend/${key}`,
      {
        method: 'DELETE',
        credentials: 'include',
      },
      { label: 'settings.deleteFrontend' }
    );

    if (!response.ok) {
      throw new Error('Failed to delete frontend configuration');
    }

    return response.json();
  },
};