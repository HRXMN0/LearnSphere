import { InsightsData } from '../types/analytics';

/**
 * Frontend API client for analytics/insights.
 * Calls backend endpoints that aggregate real event data.
 */
class FrontendAnalyticsService {
  async getInsights(): Promise<InsightsData | null> {
    try {
      const response = await fetch('/api/insights');
      if (!response.ok) {
        console.warn('[AnalyticsService] Failed to fetch insights:', response.status);
        return null;
      }
      return await response.json();
    } catch (err) {
      console.warn('[AnalyticsService] Insights fetch error:', err);
      return null;
    }
  }
}

export const frontendAnalyticsService = new FrontendAnalyticsService();
