const express = require('express');
const ChatController = require('../controllers/chatController');



const router = express.Router();
const chatController = new ChatController();

router.post('/message', chatController.sendMessage.bind(chatController));
router.get('/history/:sessionId', chatController.getChatHistory.bind(chatController));
router.delete('/history/:sessionId', chatController.clearChatHistory.bind(chatController));
router.post('/test', (req, res) => {
    res.json({ message: 'Chat endpoint working' });
});

module.exports = router;