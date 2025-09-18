// const { GoogleGenerativeAI } = require('@google/generative-ai');
// const SimpleVectorStore = require('./vectorStore');

// class RAGService {
//   constructor(newsFetcher) {
//     this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
//     this.newsFetcher = newsFetcher;
//     this.vectorStore = null;
//   }

//   async initialize() {
//     if (!this.vectorStore) {
//       const result = await this.newsFetcher.processAndStoreArticles();
//       if (result.success) {
//         this.vectorStore = result.vectorStore;
//       } else {
//         // Create a minimal vector store if initialization failed
//         this.vectorStore = new SimpleVectorStore();
//         console.log('Using fallback vector store');
//       }
//     }
//   }

//   async generateEmbedding(query) {
//     // Simple embedding function matching the newsFetcher
//     const embedding = new Array(50).fill(0);
//     let hash = 0;
    
//     for (let i = 0; i < query.length; i++) {
//       hash = query.charCodeAt(i) + ((hash << 5) - hash);
//     }
    
//     for (let i = 0; i < embedding.length; i++) {
//       embedding[i] = Math.sin(hash + i) * 0.1;
//     }
    
//     return embedding;
//   }

//   async retrieveRelevantDocuments(query, topK = 3) {
//     try {
//       await this.initialize();
//       const queryEmbedding = await this.generateEmbedding(query);
      
//       const results = this.vectorStore.similaritySearch(queryEmbedding, topK);

//       return results.map(result => ({
//         content: result.content,
//         metadata: result.metadata,
//         similarity: result.similarity
//       }));
//     } catch (error) {
//       console.error('Error retrieving documents:', error.message);
      
//       // Fallback data
//       return [
//         {
//           content: "Recent technology developments show promising advances in artificial intelligence and machine learning applications across various industries.",
//           metadata: { url: "#", title: "Technology Advancements", category: "tech" },
//           similarity: 0.85
//         },
//         {
//           content: "Global markets demonstrate resilience with technology sectors leading growth amid changing economic conditions and investor optimism.",
//           metadata: { url: "#", title: "Market Analysis", category: "business" },
//           similarity: 0.78
//         }
//       ];
//     }
//   }

//   async generateResponse(query, context) {
//     try {
//       // Check if Gemini API key is available
//       if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
//         throw new Error('Gemini API key not configured');
//       }

//       const model = this.genAI.getGenerativeModel({ model: "gemini-pro" });
      
//       const prompt = `
//         You are a helpful news assistant. Based on the following news context, answer the user's question.
//         Provide a comprehensive and informative response.
        
//         Context:
//         ${context.map((doc, i) => `Source ${i+1}: ${doc.content}`).join('\n')}
        
//         Question: ${query}
        
//         Answer helpfully:
//       `;

//       const result = await model.generateContent(prompt);
//       const response = await result.response;
//       return response.text();
//     } catch (error) {
//       console.error('Error generating response with Gemini:', error.message);
      
//       // Fallback response based on query
//       const responses = {
//         technology: "Recent technology news includes breakthroughs in AI research, quantum computing advancements, and improved cybersecurity measures. Companies are investing heavily in digital transformation.",
//         business: "Business sectors are showing positive trends with strong market performance, increased startup funding, and corporate earnings exceeding expectations. Economic indicators remain favorable.",
//         world: "Global developments include international cooperation on climate initiatives, diplomatic efforts to address regional challenges, and humanitarian responses to natural disasters.",
//         health: "Healthcare innovations are improving patient outcomes through new medical treatments, digital health solutions, and public health initiatives that address community needs.",
//         default: `I understand you're asking about "${query}". Based on recent news, there have been significant developments across technology, business, and global sectors. Technology continues to advance rapidly, business markets are adapting well to economic changes, and international cooperation is addressing important global challenges.`
//       };
      
//       const lowerQuery = query.toLowerCase();
//       if (lowerQuery.includes('tech') || lowerQuery.includes('ai') || lowerQuery.includes('computer')) {
//         return responses.technology;
//       } else if (lowerQuery.includes('business') || lowerQuery.includes('market') || lowerQuery.includes('economy')) {
//         return responses.business;
//       } else if (lowerQuery.includes('world') || lowerQuery.includes('global') || lowerQuery.includes('international')) {
//         return responses.world;
//       } else if (lowerQuery.includes('health') || lowerQuery.includes('medical') || lowerQuery.includes('care')) {
//         return responses.health;
//       } else {
//         return responses.default;
//       }
//     }
//   }

//   async processQuery(query) {
//     try {
//       const relevantDocs = await this.retrieveRelevantDocuments(query);
//       const context = relevantDocs.map(doc => doc.content).join('\n\n');
//       const response = await this.generateResponse(query, relevantDocs);
      
//       return {
//         response,
//         sources: relevantDocs.map(doc => doc.metadata.url)
//       };
//     } catch (error) {
//       console.error('Error processing query:', error.message);
//       return {
//         response: "I'm here to help answer your questions about recent news. Please ask me about technology developments, business trends, world events, or other current topics.",
//         sources: []
//       };
//     }
//   }
// }

// module.exports = RAGService;

const axios = require('axios');
const SimpleVectorStore = require('./vectorStore');

class RAGService {
  constructor(newsFetcher) {
    this.newsFetcher = newsFetcher;
    this.vectorStore = null;
    this.geminiApiKey = process.env.GEMINI_API_KEY || 'AIzaSyDMHJWgrlYUNLYdX3mm-Mc-miCSd6aP5so';
    this.geminiBaseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
  }

  async initialize() {
    if (!this.vectorStore) {
      const result = await this.newsFetcher.processAndStoreArticles();
      if (result.success) {
        this.vectorStore = result.vectorStore;
      } else {
        // Create a minimal vector store if initialization failed
        this.vectorStore = new SimpleVectorStore();
        console.log('Using fallback vector store');
      }
    }
  }

  async generateEmbedding(query) {
    // Simple embedding function matching the newsFetcher
    const embedding = new Array(50).fill(0);
    let hash = 0;
    
    for (let i = 0; i < query.length; i++) {
      hash = query.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] = Math.sin(hash + i) * 0.1;
    }
    
    return embedding;
  }

  async retrieveRelevantDocuments(query, topK = 3) {
    try {
      await this.initialize();
      const queryEmbedding = await this.generateEmbedding(query);
      
      const results = this.vectorStore.similaritySearch(queryEmbedding, topK);

      return results.map(result => ({
        content: result.content,
        metadata: result.metadata,
        similarity: result.similarity
      }));
    } catch (error) {
      console.error('Error retrieving documents:', error.message);
      
      // Fallback data
      return [
        {
          content: "Recent technology developments show promising advances in artificial intelligence and machine learning applications across various industries.",
          metadata: { url: "#", title: "Technology Advancements", category: "tech" },
          similarity: 0.85
        },
        {
          content: "Global markets demonstrate resilience with technology sectors leading growth amid changing economic conditions and investor optimism.",
          metadata: { url: "#", title: "Market Analysis", category: "business" },
          similarity: 0.78
        }
      ];
    }
  }

  async generateResponseWithGemini(query, context) {
    try {
      if (!this.geminiApiKey || this.geminiApiKey === 'your_gemini_api_key_here') {
        throw new Error('Gemini API key not configured');
      }
  
      const prompt = `
        You are a helpful news assistant chatbot. Based on the following news context, provide a concise and helpful answer to the user's question.
        
        **Instructions:**
        - Provide a direct, conversational answer
        - Keep responses under 150 words
        - Focus on the key information from the context
        - Don't explain your reasoning process
        - If the context doesn't contain relevant information, say you don't know but offer to help with other news topics
        
        **News Context:**
        ${context.map((doc, i) => `• ${doc.content}`).join('\n')}
        
        **User Question:** ${query}
        
        **Your Answer:** (provide a concise, helpful response)
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
            maxOutputTokens: 300, // Limit response length
            temperature: 0.7,     // Balance creativity and focus
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
  
      // Extract the response text from the Gemini API response
      if (response.data && response.data.candidates && response.data.candidates[0]) {
        return response.data.candidates[0].content.parts[0].text;
      } else {
        throw new Error('Unexpected response format from Gemini API');
      }
    } catch (error) {
      console.error('Error generating response with Gemini API:', error.message);
      if (error.response) {
        console.error('Gemini API response error:', error.response.data);
      }
      throw error;
    }
  }

  async generateResponse(query, context) {
    try {
      return await this.generateResponseWithGemini(query, context);
    } catch (geminiError) {
      console.log('Falling back to local response generation due to Gemini API error');
      
      // Enhanced fallback response based on query context
      const lowerQuery = query.toLowerCase();
      const contextThemes = context.map(doc => {
        if (doc.metadata && doc.metadata.category) {
          return doc.metadata.category;
        }
        return '';
      }).filter(Boolean);
      
      // Determine primary theme from context
      const primaryTheme = contextThemes.length > 0 ? contextThemes[0] : 'general';
      
      const responses = {
        tech: `Based on recent technology news: ${context[0]?.content || 'There have been significant advancements in AI, quantum computing, and cybersecurity. Companies are investing heavily in digital transformation and innovative technologies.'}`,
        
        business: `Regarding business developments: ${context[0]?.content || 'Markets are showing positive trends with strong performance across sectors. Economic indicators suggest continued growth and investment opportunities.'}`,
        
        world: `From global news coverage: ${context[0]?.content || 'International cooperation continues on climate initiatives and diplomatic efforts. Global leaders are addressing regional challenges and humanitarian needs.'}`,
        
        health: `In healthcare news: ${context[0]?.content || 'Medical research is advancing with new treatments and digital health solutions. Public health initiatives are improving community outcomes and accessibility.'}`,
        
        general: `I understand you're asking about "${query}". Based on recent news developments: ${context.slice(0, 2).map(doc => doc.content).join(' ')}. For more detailed information, I recommend checking specific news sources.`
      };
      
      return responses[primaryTheme] || responses.general;
    }
  }



  // Add this to your RAGService.processQuery method for debugging
async processQuery(query) {
  try {
    console.log(`Processing query: "${query}"`);
    const relevantDocs = await this.retrieveRelevantDocuments(query);
    console.log(`Found ${relevantDocs.length} relevant documents`);
    
    const context = relevantDocs.map(doc => doc.content).join('\n\n');
    const response = await this.generateResponse(query, relevantDocs);
    
    console.log(`Generated response: ${response.substring(0, 100)}...`);
    
    return {
      response,
      sources: relevantDocs.map(doc => doc.metadata.url)
    };
  } catch (error) {
    console.error('Error processing query:', error.message);
    return {
      response: "I'm here to help answer your questions about recent news. Please ask me about technology developments, business trends, world events, or other current topics.",
      sources: []
    };
  }
}
}

module.exports = RAGService;