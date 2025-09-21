import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import redis from 'redis';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';


// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);


// Correct CORS configuration for Socket.IO
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});


const corsOptions = {
  origin: [process.env.FRONTEND_URL, 'http://localhost:3001'], // Allow Netlify + local dev
  credentials: true,
};
app.use(cors(corsOptions));


// Correct CORS configuration for Express
app.use(cors({
  origin: "http://localhost:3000",
  credentials: true
}));

app.use(express.json());

// Redis client setup with fallback
let redisClient;
let redisConnected = false;

// Create a simple in-memory store as fallback
const memoryStore = new Map();
const mockRedisClient = {
  lPush: async (key, value) => {
    if (!memoryStore.has(key)) {
      memoryStore.set(key, []);
    }
    memoryStore.get(key).unshift(value);
    return memoryStore.get(key).length;
  },
  lRange: async (key, start, stop) => {
    return memoryStore.get(key) || [];
  },
  del: async (key) => {
    memoryStore.delete(key);
    return 1;
  },
  isOpen: true
};

// Import services - use dynamic imports to handle potential ESM issues
let NewsFetcher, RAGService;

try {
  // Try to import the real implementations first
  const newsFetcherModule = await import('./scripts/realNewsFetcher.js');
  NewsFetcher = newsFetcherModule.default;
  
  const ragServiceModule = await import('./services/ragServiceWithJina.js');
  RAGService = ragServiceModule.default;
  
  console.log('Loaded real news fetcher and RAG service with Jina');
} catch (error) {
  console.log('Falling back to simple implementations due to:', error.message);
  
  // Fallback to simple implementations
  const simpleNewsFetcherModule = await import('./scripts/simpleNewsFetcher.js');
  NewsFetcher = simpleNewsFetcherModule.default;
  
  const simpleRagServiceModule = await import('./services/simpleRAGService.js');
  RAGService = simpleRagServiceModule.default;
  
  console.log('Loaded simple news fetcher and RAG service');
}

// Create instances
const newsFetcher = new NewsFetcher();
const ragService = new RAGService(newsFetcher);

// Initialize Redis connection
try {
  redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: {
      connectTimeout: 5000,
      timeout: 5000
    }
  });

  redisClient.on('error', (err) => {
    console.log('Redis Client Error', err);
    redisConnected = false;
  });
  
  await redisClient.connect();
  redisConnected = true;
  console.log('Connected to Redis');
  
  // Test Redis connection
  await redisClient.set('test', 'connection_ok');
  const testResult = await redisClient.get('test');
  console.log('Redis test result:', testResult);
  
} catch (error) {
  console.log('Redis connection failed, using in-memory storage only:', error.message);
  redisConnected = false;
  redisClient = mockRedisClient;
}

// Initialize news data on server start
try {
  console.log('Initializing news data...');
  const result = await newsFetcher.processAndStoreArticles();
  
  if (result.success) {
    console.log('News data initialization complete');
  } else {
    console.log('News data initialization completed with some errors, but server will continue');
    if (result.error) {
      console.log('Error:', result.error);
    }
  }
} catch (error) {
  console.error('Error in news data initialization, but continuing server startup:', error.message);
}

// Routes
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is running',
    redis: redisConnected ? 'connected' : 'disconnected'
  });
});

// Chat history routes with Redis fallback
app.get('/api/chat/history/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    let history = [];
    
    if (redisConnected) {
      history = await redisClient.lRange(`chat:${sessionId}`, 0, -1);
      history = history.map(item => JSON.parse(item)).reverse();
    }
    
    res.json({ history });
  } catch (error) {
    console.error('Error retrieving chat history:', error);
    res.json({ history: [] });
  }
});

app.delete('/api/chat/history/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    if (redisConnected) {
      await redisClient.del(`chat:${sessionId}`);
    }
    
    res.json({ message: 'Chat history cleared' });
  } catch (error) {
    console.error('Error clearing chat history:', error);
    res.json({ message: 'Chat history cleared' });
  }
});

// Test endpoint for direct API calls
app.post('/api/test/query', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    console.log(`Testing query: "${query}"`);
    const result = await ragService.processQuery(query);
    
    res.json({
      success: true,
      query: query,
      response: result.response,
      sources: result.sources
    });
  } catch (error) {
    console.error('Test query error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Socket.io for real-time communication
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', (sessionId) => {
    socket.join(sessionId);
    console.log(`Socket ${socket.id} joined session ${sessionId}`);
  });

  socket.on('send_message', async (data) => {
    try {
      const { message, sessionId } = data;
      
      console.log(`Received message: "${message}" for session: ${sessionId}`);
      
      if (!message || !sessionId) {
        socket.emit('error', { message: 'Missing message or sessionId' });
        return;
      }
      
      // Store user message immediately
      const userMessage = { 
        role: 'user', 
        content: message, 
        timestamp: new Date().toISOString() 
      };
      
      if (redisConnected) {
        await redisClient.lPush(`chat:${sessionId}`, JSON.stringify(userMessage));
      }
      
      // Emit user message back to the specific client that sent it
      socket.emit('receive_message', userMessage);
      
      // Process message with RAG
      console.log(`Processing message with RAG: "${message}"`);
      const result = await ragService.processQuery(message);
      console.log(`RAG processing completed for: "${message}"`);
      
      // Store assistant response
      const assistantMessage = { 
        role: 'assistant', 
        content: result.response, 
        sources: result.sources,
        timestamp: new Date().toISOString()
      };
      
      if (redisConnected) {
        await redisClient.lPush(`chat:${sessionId}`, JSON.stringify(assistantMessage));
      }
      
      // Send response back to the specific client that sent the message
      console.log(`Sending response to client for: "${message}"`);
      socket.emit('receive_message', assistantMessage);
      console.log(`Response sent successfully for: "${message}"`);
      
    } catch (error) {
      console.error('Error processing message:', error);
      
      // Send error message to the specific client that sent the message
      const errorMessage = {
        role: 'error',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        timestamp: new Date().toISOString()
      };
      
      socket.emit('receive_message', errorMessage);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`CORS enabled for: http://localhost:3000`);
});

