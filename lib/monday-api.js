// lib/monday-api.js
export class MondayClient {
  constructor(apiToken) {
    this.apiToken = apiToken;
    this.endpoint = "https://api.monday.com/v2";
  }

  async query(query, variables = {}) {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        Authorization: this.apiToken,
        "Content-Type": "application/json",
        "API-Version": "2024-04",
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    });

    const result = await response.json();

    if (result.errors) {
      throw new Error(`Monday.com API Error: ${result.errors[0].message}`);
    }

    return result.data;
  }

  // Create account in Monday CRM
  async createAccount(boardId, accountName, accountData = {}) {
    const mutation = `
      mutation createAccount($boardId: ID!, $itemName: String!, $columnValues: JSON!) {
        create_item(
          board_id: $boardId,
          item_name: $itemName,
          column_values: $columnValues
        ) {
          id
          name
          column_values {
            id
            text
          }
        }
      }
    `;

    const columnValues = {
      text: accountName, // Account name
      text8: accountData.industry || "", // Industry
      long_text: accountData.description || "", // Description
      // Add more account fields as needed
    };

    return this.query(mutation, {
      boardId,
      itemName: accountName,
      columnValues: JSON.stringify(columnValues),
    });
  }

  // Create deal in Monday CRM
  async createDeal(boardId, dealName, dealData = {}) {
    const mutation = `
      mutation createDeal($boardId: ID!, $itemName: String!, $columnValues: JSON!) {
        create_item(
          board_id: $boardId,
          item_name: $itemName,
          column_values: $columnValues
        ) {
          id
          name
          column_values {
            id
            text
          }
        }
      }
    `;

    return this.query(mutation, {
      boardId,
      itemName: dealName,
      columnValues: JSON.stringify(dealData),
    });
  }

  // Original createItem method (keeping for backward compatibility)
  async createItem(boardId, itemName, columnValues = {}) {
    const mutation = `
      mutation createItem($boardId: ID!, $itemName: String!, $columnValues: JSON!) {
        create_item(
          board_id: $boardId,
          item_name: $itemName,
          column_values: $columnValues
        ) {
          id
          name
          column_values {
            id
            text
          }
        }
      }
    `;

    return this.query(mutation, {
      boardId,
      itemName,
      columnValues: JSON.stringify(columnValues),
    });
  }

  // Get boards
  async getBoards() {
    const query = `
      query {
        boards {
          id
          name
          columns {
            id
            title
            type
          }
        }
      }
    `;

    return this.query(query);
  }

  // Delete item (for when quotes are won/archived)
  async deleteItem(itemId) {
    const mutation = `
      mutation deleteItem($itemId: ID!) {
        delete_item(item_id: $itemId) {
          id
        }
      }
    `;

    return this.query(mutation, { itemId });
  }

  // Update item (for stage changes)
  async updateItem(itemId, columnValues) {
    const mutation = `
      mutation updateItem($itemId: ID!, $columnValues: JSON!) {
        change_multiple_column_values(
          item_id: $itemId,
          column_values: $columnValues
        ) {
          id
          name
        }
      }
    `;

    return this.query(mutation, {
      itemId,
      columnValues: JSON.stringify(columnValues),
    });
  }
}
