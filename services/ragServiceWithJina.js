const { ChromaClient } = require('chromadb');
const axios = require('axios');
const { JinaAI } = require('jinaai');

class RAGServiceWithJina {
  constructor() {
    this.chromaClient = new ChromaClient();
    this.geminiApiKey = process.env.GEMINI_API_KEY;
    this.geminiBaseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
    
    this.jinaai = new JinaAI({
      secrets: {
        'promptperfect-secret': process.env.JINA_API_KEY,
      }
    });
  }

  async initialize() {
    try {
      this.collection = await this.chromaClient.getCollection({ name: "news-articles" });
      console.log('ChromaDB collection loaded successfully');
    } catch (error) {
      console.error('Error loading ChromaDB collection:', error.message);
      throw error;
    }
  }

  async generateEmbeddingWithJina(query) {
    try {
      const embeddings = await this.jinaai.generateEmbeddings({
        input: query,
        model: 'jina-embeddings-v2-base-en'
      });
      
      return embeddings.data[0].embedding;
    } catch (error) {
      console.error('Error generating Jina embedding:', error.message);
      throw error;
    }
  }

  async retrieveRelevantDocuments(query, topK = 3) {
    try {
      await this.initialize();
      const queryEmbedding = await this.generateEmbeddingWithJina(query);
      
      const results = await this.collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: topK
      });

      if (results.documents && results.documents[0]) {
        return results.documents[0].map((doc, index) => ({
          content: doc,
          metadata: results.metadatas[0][index] || { url: '#', title: 'Unknown' },
          distance: results.distances[0][index] || 0
        }));
      }
      
      throw new Error('No documents found in vector store');
    } catch (error) {
      console.error('Error retrieving documents:', error.message);
      throw error;
    }
  }

  async generateResponseWithGemini(query, context) {
    try {
      if (!this.geminiApiKey) {
        throw new Error('Gemini API key not configured');
      }

      const prompt = `
        You are a helpful news assistant. Based on the following news context, provide a concise answer to the user's question.
        
        **Instructions:**
        - Provide a direct, conversational answer (under 100 words)
        - Focus on the key information from the context
        - If the context doesn't contain relevant information, say you don't know
        - Don't explain your reasoning process
        
        **News Context:**
        ${context.map((doc, i) => `• ${doc.content.substring(0, 200)}...`).join('\n')}
        
        **User Question:** ${query}
        
        **Your Answer:**
      `;

      const response = await axios.post(
        this.geminiBaseUrl,
        {
          contents: [
            {
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ],
          generationConfig: {
            maxOutputTokens: 200,
            temperature: 0.7,
            topP: 0.8
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-goog-api-key': this.geminiApiKey
          },
          timeout: 30000
        }
      );

      if (response.data && response.data.candidates && response.data.candidates[0]) {
        return response.data.candidates[0].content.parts[0].text;
      } else {
        throw new Error('Unexpected response format from Gemini API');
      }
    } catch (error) {
      console.error('Error generating response with Gemini API:', error.message);
      throw error;
    }
  }

  async processQuery(query) {
    try {
      const relevantDocs = await this.retrieveRelevantDocuments(query);
      const response = await this.generateResponseWithGemini(query, relevantDocs);
      
      return {
        response,
        sources: relevantDocs.map(doc => doc.metadata.url)
      };
    } catch (error) {
      console.error('Error processing query:', error.message);
      
      // Fallback response
      return {
        response: "I'm experiencing technical difficulties accessing the news database. Please try again later or ask about general news topics.",
        sources: []
      };
    }
  }
}

module.exports = RAGServiceWithJina;