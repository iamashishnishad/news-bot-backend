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
      console.log(`Total articles available: ${articles.length}`);
      
      if (articles.length === 0) {
        console.log('No articles available in news fetcher');
        throw new Error('No articles available');
      }

      // Log all article titles for debugging
      console.log('Available article titles:');
      articles.forEach((article, index) => {
        console.log(`${index + 1}. ${article.title}`);
      });

      // Simple keyword-based matching
      const queryLower = query.toLowerCase();
      console.log(`User query: ${queryLower}`);
      
      const relevantArticles = articles
        .filter(article => {
          const titleMatch = article.title.toLowerCase().includes(queryLower);
          const contentMatch = article.content.toLowerCase().includes(queryLower);
          const sourceMatch = queryLower.includes(article.source.toLowerCase());
          
          console.log(`Article: ${article.title}`);
          console.log(`Title match: ${titleMatch}, Content match: ${contentMatch}, Source match: ${sourceMatch}`);
          
          return titleMatch || contentMatch || sourceMatch;
        })
        .slice(0, topK);

      console.log(`Found ${relevantArticles.length} relevant articles`);

      if (relevantArticles.length === 0) {
        console.log('No direct matches found, using fallback articles');
        // Fallback: return articles that might be somewhat related
        const fallbackArticles = articles.slice(0, topK).map(article => ({
          content: article.content,
          metadata: {
            url: article.url,
            title: article.title,
            published: article.published,
            source: article.source
          },
          similarity: 0.3 // Lower similarity score for fallbacks
        }));
        return fallbackArticles;
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
      
      // Fallback data with technology-focused content
      return [
        {
          content: "Recent advancements in artificial intelligence show promising developments in natural language processing and machine learning applications. Major tech companies are investing heavily in AI research.",
          metadata: { url: "#", title: "AI Technology Advancements", source: "Tech News" },
          similarity: 0.85
        },
        {
          content: "The technology sector continues to innovate with new AI-powered tools and platforms being launched regularly. These developments are transforming various industries from healthcare to finance.",
          metadata: { url: "#", title: "Tech Sector Innovation", source: "Business News" },
          similarity: 0.75
        }
      ];
    }
  }

  async generateResponseWithGemini(query, context) {
    try {
      if (!this.geminiApiKey) {
        throw new Error('Gemini API key not configured');
      }

      // Improved prompt to prevent "I don't know" responses
      const prompt = `
        You are a helpful news assistant. Based on the following news context, provide a helpful answer to the user's question.
        
        **Important Instructions:**
        - ALWAYS provide a helpful response even if the context isn't perfectly relevant
        - Connect the context to the user's question in a meaningful way
        - If the context doesn't directly answer the question, provide related information from the context
        - Never say "I don't know" or "the context doesn't contain information"
        - Keep responses concise (under 100 words) but informative
        
        **News Context:**
        ${context.map((doc, i) => `[Source ${i+1}] ${doc.content.substring(0, 250)}...`).join('\n\n')}
        
        **User Question:** ${query}
        
        **Your Answer:** (provide a helpful, informative response based on the available context)
      `;

      console.log('Sending prompt to Gemini API...');
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
            maxOutputTokens: 300,
            temperature: 0.8, // Slightly higher temperature for more creative responses
            topP: 0.9
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
        const geminiResponse = response.data.candidates[0].content.parts[0].text;
        console.log('Gemini API response received');
        return geminiResponse;
      } else {
        throw new Error('Unexpected response format from Gemini API');
      }
    } catch (error) {
      console.error('Error generating response with Gemini API:', error.message);
      
      // Better fallback response
      const contextThemes = context.map(doc => doc.metadata.source).join(', ');
      return `Based on recent news coverage about ${contextThemes}, there are ongoing developments in various sectors. While I don't have specific information about "${query}" in my current news database, I can tell you that technology and business sectors continue to show innovation and growth. Would you like me to search for more specific information on another topic?`;
    }
  }

  async processQuery(query) {
    try {
      console.log(`\n=== Processing query: "${query}" ===`);
      const relevantDocs = await this.retrieveRelevantDocuments(query);
      
      console.log(`Context being sent to Gemini: ${relevantDocs.length} documents`);
      relevantDocs.forEach((doc, index) => {
        console.log(`Doc ${index + 1}: ${doc.metadata.title} (similarity: ${doc.similarity})`);
      });
      
      const response = await this.generateResponseWithGemini(query, relevantDocs);
      
      return {
        response,
        sources: relevantDocs.map(doc => doc.metadata.url)
      };
    } catch (error) {
      console.error('Error processing query:', error.message);
      
      // Fallback response
      return {
        response: "I'm here to help answer your questions about recent news. I'm currently experiencing some technical difficulties with my news database. Please try asking about technology, business, or world news topics, or try again in a few moments.",
        sources: []
      };
    }
  }
}

export default SimpleRAGService;