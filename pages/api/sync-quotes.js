// pages/api/sync-quotes.js
import { SimproClient } from "../../lib/simpro-api";
import { MondayClient } from "../../lib/monday-api";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { simproBaseUrl, accountsBoardId, contactsBoardId, dealsBoardId } =
      req.body;

    // Initialize API clients
    const simpro = new SimproClient({
      baseUrl: simproBaseUrl,
      accessToken: process.env.SIMPRO_ACCESS_TOKEN,
    });

    const monday = new MondayClient(process.env.MONDAY_API_TOKEN);

    // Get company ID
    console.log("Getting company list from SimPro...");
    const companies = await simpro.getCompanies();

    if (!companies || companies.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No companies found in SimPro. Please check your API access.",
      });
    }

    const companyId = companies[0].ID;
    console.log(
      `Using company ID: ${companyId} (${companies[0].Name || "Unnamed"})`
    );

    // Fetch ALL quotes from SimPro
    console.log(`Fetching all quotes from SimPro...`);
    const allQuotes = await simpro.getQuotes(companyId);

    if (!allQuotes || allQuotes.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No quotes found",
        synced: 0,
      });
    }

    console.log(`Found ${allQuotes.length} total quotes`);

    // Filter for quotes in "Complete" or "Approved" STAGES with active STATUSES
    const validStages = ["Complete", "Approved"];
    const activeStatuses = [
      "Quote: To Be Assigned",
      "Quote: To Be Scheduled",
      "Quote: To Write",
      "Quote: Visit Scheduled",
      "Quote: In Progress",
      "Quote: Won",
      "Quote: On Hold",
      "Quote: Quote Due Date Reached",
    ];

    const activeQuotes = allQuotes.filter((quote) => {
      // Must be in Complete or Approved stage
      const validStage = validStages.includes(quote.Stage);

      // Must have active status
      const validStatus = activeStatuses.includes(quote.Status?.Name);

      console.log(
        `Quote ${quote.ID}: Stage=${quote.Stage}, Status=${
          quote.Status?.Name
        }, Valid=${validStage && validStatus}`
      );

      return validStage && validStatus;
    });

    console.log(
      `Found ${activeQuotes.length} quotes with valid stages and active statuses`
    );

    if (activeQuotes.length === 0) {
      return res.status(200).json({
        success: true,
        message:
          "No quotes found with Complete/Approved stages and active statuses",
        synced: 0,
        filtering: {
          totalQuotes: allQuotes.length,
          validStages: validStages,
          activeStatuses: activeStatuses,
          filteredQuotes: 0,
        },
      });
    }

    // Step 1: Extract unique customers from ACTIVE quotes only
    const customerMap = new Map();
    const contactMap = new Map();

    for (const quote of activeQuotes) {
      // Extract customer for account creation
      if (quote.Customer?.CompanyName && !customerMap.has(quote.Customer.ID)) {
        customerMap.set(quote.Customer.ID, {
          id: quote.Customer.ID,
          companyName: quote.Customer.CompanyName,
          givenName: quote.Customer.GivenName,
          familyName: quote.Customer.FamilyName,
        });
      }

      // Extract customer contact from active quotes only
      if (
        quote.CustomerContact?.GivenName ||
        quote.CustomerContact?.FamilyName
      ) {
        const contactKey = `customer_${quote.Customer.ID}_${quote.CustomerContact.ID}`;
        if (!contactMap.has(contactKey)) {
          contactMap.set(contactKey, {
            id: quote.CustomerContact.ID,
            customerId: quote.Customer.ID,
            givenName: quote.CustomerContact.GivenName || "",
            familyName: quote.CustomerContact.FamilyName || "",
            type: "customer",
            companyName: quote.Customer.CompanyName,
          });
        }
      }

      // Extract site contact from active quotes only
      if (quote.SiteContact?.GivenName || quote.SiteContact?.FamilyName) {
        const contactKey = `site_${quote.Site?.ID}_${quote.SiteContact.ID}`;
        if (!contactMap.has(contactKey)) {
          contactMap.set(contactKey, {
            id: quote.SiteContact.ID,
            customerId: quote.Customer.ID,
            givenName: quote.SiteContact.GivenName || "",
            familyName: quote.SiteContact.FamilyName || "",
            type: "site",
            companyName: quote.Customer.CompanyName,
            siteName: quote.Site?.Name || "",
          });
        }
      }
    }

    console.log(
      `Extracted ${customerMap.size} unique customers and ${contactMap.size} unique contacts from active quotes`
    );

    // Step 2: Create accounts for unique customers
    const accountResults = [];

    for (const [customerId, customerData] of customerMap) {
      try {
        const accountName = customerData.companyName;

        const accountColumnValues = {
          text: accountName, // Account name
          text8: "Building Services", // Industry
          long_text: `Customer ID: ${customerId}`, // Description
        };

        const accountResult = await monday.createItem(
          accountsBoardId,
          accountName,
          accountColumnValues
        );

        customerMap.set(customerId, {
          ...customerData,
          mondayAccountId: accountResult.create_item.id,
        });

        accountResults.push({
          simproCustomerId: customerId,
          mondayAccountId: accountResult.create_item.id,
          customerName: accountName,
          success: true,
        });

        console.log(`✅ Created account: ${accountName}`);
      } catch (error) {
        console.error(
          `❌ Failed to create account for ${customerData.companyName}:`,
          error
        );
        accountResults.push({
          simproCustomerId: customerId,
          success: false,
          error: error.message,
        });
      }
    }

    // Step 3: Create contacts from active quotes only
    const contactResults = [];

    for (const [contactKey, contactData] of contactMap) {
      try {
        const contactName =
          `${contactData.givenName} ${contactData.familyName}`.trim();
        const customer = customerMap.get(contactData.customerId);

        if (!customer?.mondayAccountId) {
          console.log(`⚠️  Skipping contact ${contactName} - no account found`);
          continue;
        }

        const contactColumnValues = {
          text: contactName, // Contact name
          text8: contactData.companyName, // Company
          text4: contactData.type, // Contact type (customer/site)
          long_text: contactData.siteName || "", // Site name for site contacts
        };

        const contactResult = await monday.createItem(
          contactsBoardId,
          contactName,
          contactColumnValues
        );

        contactResults.push({
          simproContactId: contactData.id,
          mondayContactId: contactResult.create_item.id,
          contactName: contactName,
          companyName: contactData.companyName,
          type: contactData.type,
          success: true,
        });

        console.log(
          `✅ Created contact: ${contactName} (${contactData.type}) for ${contactData.companyName}`
        );
      } catch (error) {
        console.error(
          `❌ Failed to create contact ${contactData.givenName} ${contactData.familyName}:`,
          error
        );
        contactResults.push({
          simproContactId: contactData.id,
          success: false,
          error: error.message,
        });
      }
    }

    // Step 4: Create deals for each active quote
    const dealResults = [];

    for (const quote of activeQuotes) {
      try {
        if (!quote.Customer?.ID || !customerMap.has(quote.Customer.ID)) {
          console.log(`⚠️  Skipping quote ${quote.ID} - no valid customer`);
          continue;
        }

        const customer = customerMap.get(quote.Customer.ID);

        // Clean up description - remove HTML tags
        let cleanDescription = (quote.Description || "")
          .replace(/<[^>]*>/g, "")
          .trim();
        if (cleanDescription.length > 50) {
          cleanDescription = cleanDescription.substring(0, 50) + "...";
        }

        // Use quote Name field if available, otherwise use cleaned Description
        const quoteName = quote.Name || cleanDescription || "Service";

        // Create clean deal name - NO HTML
        const dealName = `Quote #${quote.ID} - ${quoteName}`;

        // Use the actual SimPro status as the deal stage
        const dealStage = quote.Status?.Name || "Quote: To Be Assigned";

        // Extract deal data
        const dealValue = quote.Total?.ExTax || 0;
        const siteName = quote.Site?.Name || "";
        const salesperson = quote.Salesperson?.Name || "";
        const dateIssued =
          quote.DateIssued || new Date().toISOString().split("T")[0];
        const dueDate = quote.DueDate || dateIssued;

        // Map to Monday.com deal columns
        const dealColumnValues = {
          text: dealName, // Deal name (NO HTML)
          numbers: dealValue, // Deal value (Ex Tax)
          status: { label: dealStage }, // Actual SimPro status
          person: salesperson, // Owner/Salesperson
          date: dateIssued, // Date issued
          date4: dueDate, // Expected close date
          text8: siteName, // Site name
          text4: customer.companyName, // Account name
        };

        const dealResult = await monday.createItem(
          dealsBoardId,
          dealName,
          dealColumnValues
        );

        dealResults.push({
          simproQuoteId: quote.ID,
          mondayDealId: dealResult.create_item.id,
          customerName: customer.companyName,
          dealName: dealName,
          dealValue: dealValue,
          stage: dealStage,
          salesperson: salesperson,
          simproStage: quote.Stage,
          simproStatus: quote.Status?.Name,
          success: true,
        });

        console.log(
          `✅ Created deal: ${dealName} ($${dealValue}) - ${dealStage} (Stage: ${quote.Stage})`
        );
      } catch (error) {
        console.error(`❌ Failed to create deal for quote ${quote.ID}:`, error);
        dealResults.push({
          simproQuoteId: quote.ID,
          success: false,
          error: error.message,
        });
      }
    }

    const successfulAccounts = accountResults.filter((r) => r.success).length;
    const successfulContacts = contactResults.filter((r) => r.success).length;
    const successfulDeals = dealResults.filter((r) => r.success).length;

    res.status(200).json({
      success: true,
      message: `Created ${successfulAccounts} accounts, ${successfulContacts} contacts, and ${successfulDeals} deals from ${activeQuotes.length} active quotes`,
      filtering: {
        totalQuotes: allQuotes.length,
        filteredQuotes: activeQuotes.length,
        validStages: validStages,
        activeStatuses: activeStatuses,
      },
      accounts: {
        created: successfulAccounts,
        total: accountResults.length,
        results: accountResults,
      },
      contacts: {
        created: successfulContacts,
        total: contactResults.length,
        results: contactResults,
      },
      deals: {
        created: successfulDeals,
        total: dealResults.length,
        results: dealResults,
      },
      companyUsed: companies[0].Name || `Company ID ${companyId}`,
    });
  } catch (error) {
    console.error("Sync error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.stack,
    });
  }
}
