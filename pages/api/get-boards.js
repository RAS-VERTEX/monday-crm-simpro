import { MondayClient } from '../../lib/monday-api';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const monday = new MondayClient(process.env.MONDAY_API_TOKEN);

    const data = await monday.getBoards();
    
    res.status(200).json({
      success: true,
      boards: data.boards
    });
  } catch (error) {
    console.error('Error fetching boards:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
