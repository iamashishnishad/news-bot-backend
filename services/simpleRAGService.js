import axios from 'axios';

class SimpleRAGService {
  constructor(newsFetcher) {
    this.newsFetcher = newsFetcher;
    this.geminiApiKey = process.env.GEMINI_API_KEY;
    this.geminiBaseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
  }

  async retrieveRelevantDocuments(query, topK = 3) {
    try {
      const articles = this.newsFetcher.getArticles();
      if (articles.length === 0) {
        throw new Error('No articles available');
      }

      // Simple keyword-based matching (replace with proper embeddings later)
      const queryLower = query.toLowerCase();
      const relevantArticles = articles
        .filter(article => 
          article.title.toLowerCase().includes(queryLower) ||
          article.content.toLowerCase().includes(queryLower) ||
          queryLower.includes(article.source.toLowerCase())
        )
        .slice(0, topK);

      if (relevantArticles.length === 0) {
        // Fallback: return random articles
        return articles.slice(0, topK).map(article => ({
          content: article.content,
          metadata: {
            url: article.url,
            title: article.title,
            published: article.published,
            source: article.source
          },
          similarity: 0.5
        }));
      }

      return relevantArticles.map(article => ({
        content: article.content,
        metadata: {
          url: article.url,
          title: article.title,
          published: article.published,
          source: article.source
        },
        similarity: 0.8
      }));
    } catch (error) {
      console.error('Error retrieving documents:', error.message);
      
      // Fallback data
      return [
        {
          content: "Recent technology developments show promising advances in artificial intelligence and machine learning applications across various industries.",
          metadata: { url: "#", title: "Technology Advancements", source: "Tech News" },
          similarity: 0.85
        }
      ];
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
        response: "I'm experiencing technical difficulties. Please try again later or ask about general news topics.",
        sources: []
      };
    }
  }
}

export default SimpleRAGService;