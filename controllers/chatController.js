const RAGService = require('../services/ragService');
const ragService = new RAGService();

class ChatController {
  async sendMessage(req, res) {
    try {
      const { message, sessionId } = req.body;
      
      if (!message || !sessionId) {
        return res.status(400).json({ error: 'Message and sessionId are required' });
      }

      const result = await ragService.processQuery(message);
      
      // Store in Redis (you'll need to implement this)
      // await storeMessage(sessionId, 'user', message);
      // await storeMessage(sessionId, 'assistant', result.response);
      
      res.json({
        response: result.response,
        sources: result.sources
      });
    } catch (error) {
      console.error('Error processing message:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getChatHistory(req, res) {
    try {
      const { sessionId } = req.params;
      
      // Retrieve from Redis (you'll need to implement this)
      // const history = await getChatHistory(sessionId);
      
      res.json({ history: [] }); // Placeholder
    } catch (error) {
      console.error('Error retrieving chat history:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async clearChatHistory(req, res) {
    try {
      const { sessionId } = req.params;
      
      // Clear from Redis (you'll need to implement this)
      // await clearChatHistory(sessionId);
      
      res.json({ message: 'Chat history cleared' });
    } catch (error) {
      console.error('Error clearing chat history:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = ChatController;