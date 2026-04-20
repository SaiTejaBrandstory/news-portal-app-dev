import axios, { AxiosInstance, AxiosError } from 'axios';
import { getAPIBaseURL } from './config';
import { withRetry, isTransientError } from './retry';

class RPApi {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      withCredentials: true,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  private getBaseURL() {
    return getAPIBaseURL();
  }

  async getCurrentUser() {
    try {
      const response = await withRetry(
        () => this.client.get(`${this.getBaseURL()}/api/v1/auth/me`),
        {
          label: 'auth.getCurrentUser',
          shouldRetry: (error) => {
            const axiosErr = error as AxiosError;
            // Don't retry 401 — that's expected "not logged in"
            if (axiosErr.response?.status === 401) return false;
            return isTransientError(error);
          },
        }
      );
      return response.data;
    } catch (error) {
      const axiosErr = error as AxiosError;

      if (axiosErr.response?.status === 401) {
        return null;
      }

      // After retries exhausted, treat transient errors gracefully
      if (isTransientError(error)) {
        console.error(
          '[Auth] Could not reach auth service after retries. Treating as unauthenticated.',
          axiosErr.message
        );
        return null;
      }

      throw new Error(
        (axiosErr.response?.data as { detail?: string })?.detail ||
          'Failed to get user info'
      );
    }
  }

  async login() {
    try {
      const response = await withRetry(
        () => this.client.get(`${this.getBaseURL()}/api/v1/auth/login`),
        { label: 'auth.login' }
      );
      window.location.href = response.data.redirect_url;
    } catch (error) {
      const axiosErr = error as AxiosError;
      throw new Error(
        (axiosErr.response?.data as { detail?: string })?.detail ||
          'Failed to initiate login. Please try again.'
      );
    }
  }

  async logout() {
    try {
      const response = await withRetry(
        () => this.client.get(`${this.getBaseURL()}/api/v1/auth/logout`),
        { label: 'auth.logout' }
      );
      window.location.href = response.data.redirect_url;
    } catch (error) {
      const axiosErr = error as AxiosError;
      throw new Error(
        (axiosErr.response?.data as { detail?: string })?.detail ||
          'Failed to logout. Please try again.'
      );
    }
  }
}

export const authApi = new RPApi();