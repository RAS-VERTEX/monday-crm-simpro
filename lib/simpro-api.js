// lib/simpro-api.js
export class SimproClient {
  constructor({ baseUrl, accessToken }) {
    this.baseUrl = this.normalizeUrl(baseUrl);
    this.accessToken = accessToken;
  }

  normalizeUrl(url) {
    // Remove trailing slashes and normalize SimPro Suite URL format
    url = url.replace(/\/+$/, "");

    // Ensure it's the correct format for SimPro Suite
    if (url.includes(".simprosuite.com")) {
      return url;
    }

    return url;
  }

  async apiRequest(endpoint, options = {}) {
    // For SimPro Suite, the API URL format is: https://[company].simprosuite.com/api/v1.0/
    const url = `${this.baseUrl}/api/v1.0${endpoint}`;

    console.log(`Making API request to: ${url}`);

    const response = await fetch(url, {
      ...options,
      headers: {
        // OAuth2 Bearer token format
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...options.headers,
      },
    });

    console.log(`Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Error Response: ${errorText}`);

      if (response.status === 401) {
        throw new Error(
          `Authentication failed (401). Your access token may be expired or invalid.`
        );
      }

      throw new Error(
        `SimPro API Error: ${response.status} - ${response.statusText}. Response: ${errorText}`
      );
    }

    return response.json();
  }

  async getQuotesList(companyId = 0, options = {}) {
    let endpoint = `/companies/${companyId}/quotes/`;

    // Add query parameters for filtering
    const params = new URLSearchParams();

    // Filter for active quotes only (not archived/closed)
    if (options.activeOnly !== false) {
      params.append("IsClosed", "false");
    }

    // Filter by quote stage
    if (options.stage !== undefined) {
      params.append("Stage", options.stage);
    }

    // Filter by status
    if (options.status) {
      params.append("Status", options.status);
    }

    if (params.toString()) {
      endpoint += "?" + params.toString();
    }

    return this.apiRequest(endpoint);
  }

  async getQuoteDetails(companyId = 0, quoteId) {
    // Get full quote details including customer, site, totals, etc.
    return this.apiRequest(`/companies/${companyId}/quotes/${quoteId}`);
  }

  async getQuotesWithDetails(companyId = 0, options = {}) {
    // Step 1: Get list of quote IDs
    const quotesList = await this.getQuotesList(companyId, options);
    const quotes = quotesList.data || quotesList;

    if (!quotes || quotes.length === 0) {
      return [];
    }

    console.log(`Found ${quotes.length} quotes, getting full details...`);

    // Step 2: Get full details for each quote
    const quotesWithDetails = [];
    for (const quote of quotes) {
      try {
        console.log(`Getting details for quote ${quote.ID}...`);
        const fullQuote = await this.getQuoteDetails(companyId, quote.ID);
        quotesWithDetails.push(fullQuote);
      } catch (error) {
        console.error(`Failed to get details for quote ${quote.ID}:`, error);
        // Include the basic quote data even if details fail
        quotesWithDetails.push(quote);
      }
    }

    return quotesWithDetails;
  }

  async getQuotes(companyId = 0, options = {}) {
    return this.getQuotesWithDetails(companyId, options);
  }

  async getActiveQuotes(companyId = 0) {
    return this.getQuotesWithDetails(companyId, { activeOnly: true });
  }

  async getInProgressQuotes(companyId = 0) {
    return this.getQuotesWithDetails(companyId, {
      activeOnly: true,
      stage: "InProgress",
    });
  }

  // Get list of companies (needed to find company ID)
  async getCompanies() {
    return this.apiRequest("/companies/");
  }

  // Test connection method
  async testConnection() {
    try {
      const companies = await this.apiRequest("/companies/");
      if (companies && companies.length > 0) {
        return {
          success: true,
          message: `Connection successful. Found ${companies.length} companies.`,
          companies: companies,
        };
      } else {
        return { success: false, message: "No companies found" };
      }
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}
