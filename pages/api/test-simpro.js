// pages/api/test-simpro.js
import { SimproClient } from "../../lib/simpro-api";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { simproBaseUrl } = req.body;

    if (!simproBaseUrl) {
      return res.status(400).json({
        success: false,
        error: "SimPro base URL is required",
      });
    }

    const simpro = new SimproClient({
      baseUrl: simproBaseUrl,
      accessToken: process.env.SIMPRO_ACCESS_TOKEN,
    });

    const testResult = await simpro.testConnection();

    res.status(200).json(testResult);
  } catch (error) {
    console.error("SimPro connection test error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
