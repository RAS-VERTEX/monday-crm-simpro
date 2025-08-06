// pages/index.js
import { useState, useEffect } from "react";

export default function Home() {
  const [boards, setBoards] = useState([]);
  const [accountsBoardId, setAccountsBoardId] = useState("");
  const [contactsBoardId, setContactsBoardId] = useState("");
  const [dealsBoardId, setDealsBoardId] = useState("");
  const [simproBaseUrl, setSimproBaseUrl] = useState("");
  const [syncResult, setSyncResult] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  useEffect(() => {
    fetchBoards();
  }, []);

  const fetchBoards = async () => {
    try {
      const response = await fetch("/api/get-boards");
      const data = await response.json();
      if (data.success) {
        setBoards(data.boards);
      }
    } catch (error) {
      console.error("Error fetching boards:", error);
    }
  };

  const testSimproConnection = async () => {
    if (!simproBaseUrl) {
      alert("Please enter your SimPro base URL first");
      return;
    }

    setTestingConnection(true);
    setTestResult(null);

    try {
      const response = await fetch("/api/test-simpro", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          simproBaseUrl: simproBaseUrl,
        }),
      });

      const result = await response.json();
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        error: error.message,
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSync = async (e) => {
    e.preventDefault();

    if (
      !accountsBoardId ||
      !contactsBoardId ||
      !dealsBoardId ||
      !simproBaseUrl
    ) {
      alert(
        "Please select accounts, contacts, and deals boards, and enter your SimPro base URL"
      );
      return;
    }

    setLoading(true);
    setSyncResult(null);

    try {
      const response = await fetch("/api/sync-quotes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accountsBoardId: accountsBoardId,
          contactsBoardId: contactsBoardId,
          dealsBoardId: dealsBoardId,
          simproBaseUrl: simproBaseUrl,
        }),
      });

      const result = await response.json();
      setSyncResult(result);
    } catch (error) {
      setSyncResult({
        success: false,
        error: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "900px", margin: "0 auto" }}>
      <h1>SimPro to Monday CRM Complete Sync</h1>
      <p>
        <strong>Creates:</strong> Customer Accounts + Contacts + Quote Deals
        with proper CRM relationships
      </p>

      <form onSubmit={handleSync}>
        <div style={{ marginBottom: "20px" }}>
          <label htmlFor="simproUrl">SimPro Suite Base URL:</label>
          <input
            id="simproUrl"
            type="text"
            value={simproBaseUrl}
            onChange={(e) => setSimproBaseUrl(e.target.value)}
            placeholder="https://yourcompany.simprosuite.com"
            style={{ width: "100%", padding: "8px", marginTop: "5px" }}
            required
          />
          <small>Enter your SimPro Suite URL</small>

          <div style={{ marginTop: "10px" }}>
            <button
              type="button"
              onClick={testSimproConnection}
              disabled={testingConnection || !simproBaseUrl}
              style={{
                padding: "8px 16px",
                backgroundColor: "#28a745",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: testingConnection ? "not-allowed" : "pointer",
              }}
            >
              {testingConnection ? "Testing..." : "Test Connection"}
            </button>
          </div>
        </div>

        {testResult && (
          <div
            style={{
              marginBottom: "20px",
              padding: "10px",
              border: "1px solid #ccc",
              borderRadius: "4px",
              backgroundColor: testResult.success ? "#d4edda" : "#f8d7da",
              color: testResult.success ? "#155724" : "#721c24",
            }}
          >
            {testResult.success ? (
              <p>✅ {testResult.message}</p>
            ) : (
              <p>❌ {testResult.error || testResult.message}</p>
            )}
          </div>
        )}

        <div style={{ marginBottom: "20px" }}>
          <label htmlFor="accountsBoard">Monday CRM Accounts Board:</label>
          <select
            id="accountsBoard"
            value={accountsBoardId}
            onChange={(e) => setAccountsBoardId(e.target.value)}
            style={{ width: "100%", padding: "8px", marginTop: "5px" }}
            required
          >
            <option value="">Choose accounts board...</option>
            {boards.map((board) => (
              <option key={board.id} value={board.id}>
                {board.name}
              </option>
            ))}
          </select>
          <small>Customer companies (Mercure Kawana Waters, etc.)</small>
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label htmlFor="contactsBoard">Monday CRM Contacts Board:</label>
          <select
            id="contactsBoard"
            value={contactsBoardId}
            onChange={(e) => setContactsBoardId(e.target.value)}
            style={{ width: "100%", padding: "8px", marginTop: "5px" }}
            required
          >
            <option value="">Choose contacts board...</option>
            {boards.map((board) => (
              <option key={board.id} value={board.id}>
                {board.name}
              </option>
            ))}
          </select>
          <small>Customer contacts + site contacts from quotes</small>
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label htmlFor="dealsBoard">Monday CRM Deals Board:</label>
          <select
            id="dealsBoard"
            value={dealsBoardId}
            onChange={(e) => setDealsBoardId(e.target.value)}
            style={{ width: "100%", padding: "8px", marginTop: "5px" }}
            required
          >
            <option value="">Choose deals board...</option>
            {boards.map((board) => (
              <option key={board.id} value={board.id}>
                {board.name}
              </option>
            ))}
          </select>
          <small>Individual quotes with values and stages</small>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "12px 24px",
            backgroundColor: "#0070f3",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: loading ? "not-allowed" : "pointer",
            fontSize: "16px",
          }}
        >
          {loading
            ? "Syncing Complete CRM..."
            : "Sync Accounts + Contacts + Deals"}
        </button>
      </form>

      {syncResult && (
        <div
          style={{
            marginTop: "20px",
            padding: "15px",
            border: "1px solid #ccc",
            borderRadius: "4px",
            backgroundColor: syncResult.success ? "#f0f8ff" : "#fff0f0",
          }}
        >
          <h3>Complete CRM Sync Result</h3>
          {syncResult.success ? (
            <div>
              <p
                style={{ color: "green", fontSize: "18px", fontWeight: "bold" }}
              >
                ✅ {syncResult.message}
              </p>

              {syncResult.quotesProcessed && (
                <div
                  style={{
                    marginBottom: "15px",
                    padding: "10px",
                    backgroundColor: "#e7f3ff",
                    borderRadius: "4px",
                  }}
                >
                  <h4>Quotes Processed:</h4>
                  <p>
                    📊 <strong>{syncResult.quotesProcessed.total}</strong> total
                    quotes found
                  </p>
                  <p>
                    🎯 <strong>{syncResult.quotesProcessed.active}</strong>{" "}
                    active quotes with your stages
                  </p>
                </div>
              )}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: "15px",
                }}
              >
                {syncResult.accounts && (
                  <div
                    style={{
                      padding: "10px",
                      backgroundColor: "#f8f9fa",
                      borderRadius: "4px",
                    }}
                  >
                    <h4>🏢 Accounts</h4>
                    <p>
                      <strong>{syncResult.accounts.created}</strong> customer
                      companies created
                    </p>
                  </div>
                )}

                {syncResult.contacts && (
                  <div
                    style={{
                      padding: "10px",
                      backgroundColor: "#f8f9fa",
                      borderRadius: "4px",
                    }}
                  >
                    <h4>👥 Contacts</h4>
                    <p>
                      <strong>{syncResult.contacts.created}</strong> customer +
                      site contacts created
                    </p>
                  </div>
                )}

                {syncResult.deals && (
                  <div
                    style={{
                      padding: "10px",
                      backgroundColor: "#f8f9fa",
                      borderRadius: "4px",
                    }}
                  >
                    <h4>💼 Deals</h4>
                    <p>
                      <strong>{syncResult.deals.created}</strong> quote deals
                      created with values
                    </p>
                  </div>
                )}
              </div>

              {syncResult.deals?.results && (
                <div style={{ marginTop: "15px" }}>
                  <details>
                    <summary style={{ cursor: "pointer", fontWeight: "bold" }}>
                      View Deal Details ({syncResult.deals.results.length}{" "}
                      deals)
                    </summary>
                    <div
                      style={{
                        maxHeight: "300px",
                        overflowY: "auto",
                        marginTop: "10px",
                      }}
                    >
                      {syncResult.deals.results.map((result, index) => (
                        <div
                          key={index}
                          style={{
                            padding: "8px",
                            margin: "4px 0",
                            backgroundColor: result.success
                              ? "#d4edda"
                              : "#f8d7da",
                            borderRadius: "4px",
                            fontSize: "14px",
                          }}
                        >
                          {result.success
                            ? `✅ ${result.dealName} - $${result.dealValue} (${result.stage}) - ${result.salesperson}`
                            : `❌ Quote ${result.simproQuoteId}: ${result.error}`}
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              )}
            </div>
          ) : (
            <p style={{ color: "red" }}>❌ Error: {syncResult.error}</p>
          )}
        </div>
      )}

      <div
        style={{
          marginTop: "40px",
          padding: "15px",
          backgroundColor: "#f9f9f9",
          borderRadius: "4px",
        }}
      >
        <h3>Active Quote Stages Synced:</h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "10px",
          }}
        >
          <ul style={{ margin: 0 }}>
            <li>Quote: To Be Assigned</li>
            <li>Quote: To Be Scheduled</li>
            <li>Quote: To Write</li>
            <li>Quote: Visit Scheduled</li>
          </ul>
          <ul style={{ margin: 0 }}>
            <li>Quote: In Progress</li>
            <li>Quote: Won</li>
            <li>Quote: On Hold</li>
            <li>Quote: Quote Due Date Reached</li>
          </ul>
        </div>

        <h4>Complete CRM Structure:</h4>
        <p>
          🏢 <strong>Accounts:</strong> Customer companies (unique)
        </p>
        <p>
          👥 <strong>Contacts:</strong> CustomerContact + SiteContact from
          quotes
        </p>
        <p>
          💼 <strong>Deals:</strong> Individual quotes with values, stages, and
          salespeople
        </p>
        <p>
          🔗 <strong>Relationships:</strong> Deals linked to Accounts, Contacts
          linked to Accounts
        </p>
      </div>
    </div>
  );
}
