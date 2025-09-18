const axios = require('axios');
const { parseString } = require('xml2js');
const SimpleVectorStore = require('../services/vectorStore');

class NewsFetcher {
  constructor() {
    this.vectorStore = new SimpleVectorStore();
  }

  async generateEmbedding(text) {
    // Simple embedding function for demonstration
    const embedding = new Array(50).fill(0); // Smaller dimension for demo
    let hash = 0;
    
    for (let i = 0; i < text.length; i++) {
      hash = text.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] = Math.sin(hash + i) * 0.1;
    }
    
    return embedding;
  }

  async fetchFromReuters() {
    try {
      console.log('Attempting to fetch news data...');
      
      // For demo purposes, we'll create mock data instead of scraping
      // This avoids the 404 errors from Reuters
      return {
        sitemapindex: {
          sitemap: [
            { loc: ['https://example.com/tech-news'] },
            { loc: ['https://example.com/business-news'] },
            { loc: ['https://example.com/world-news'] }
          ]
        }
      };
    } catch (error) {
      console.error('Error in fetchFromReuters:', error.message);
      return {
        sitemapindex: {
          sitemap: [
            { loc: ['https://example.com/tech-news'] },
            { loc: ['https://example.com/business-news'] }
          ]
        }
      };
    }
  }

  async extractArticleUrls(sitemapData, limit = 15) {
    console.log('Extracting article URLs from mock data...');
    
    // Create sample URLs for demonstration
    const sampleUrls = [
      'https://example.com/tech/ai-breakthrough',
      'https://example.com/tech/quantum-computing',
      'https://example.com/business/market-trends',
      'https://example.com/business/startup-funding',
      'https://example.com/world/climate-summit',
      'https://example.com/world/diplomatic-talks',
      'https://example.com/tech/cybersecurity',
      'https://example.com/business/economic-policy',
      'https://example.com/health/medical-research',
      'https://example.com/entertainment/film-industry'
    ];
    
    return sampleUrls.slice(0, limit);
  }

  async fetchArticleContent(url) {
    try {
      // Create realistic content based on URL category
      const category = url.split('/')[3] || 'general';
      
// Update the content templates to be more diverse
const contentTemplates = {
  tech: [
    "Apple unveiled its latest iPhone with breakthrough AI capabilities and extended battery life, setting new standards for smartphone innovation.",
    "Google announced major updates to its search algorithm, incorporating more AI-powered features to deliver more relevant results faster.",
    "Tesla revealed its new autonomous driving system that promises to reduce accidents by 40% through improved sensor technology."
  ],
  business: [
    "Wall Street reached record highs as tech stocks surged following positive earnings reports from major Silicon Valley companies.",
    "Amazon reported a 25% increase in quarterly revenue, exceeding analyst expectations due to strong cloud computing growth.",
    "Startup funding reached $50 billion this quarter, with artificial intelligence and clean energy sectors attracting the most investment."
  ],
  world: [
    "World leaders gathered at the UN Climate Summit, committing to reduce carbon emissions by 50% before 2030 through international cooperation.",
    "The G7 nations announced a new economic partnership aimed at stabilizing global markets and promoting sustainable development.",
    "International space agencies collaborated on a new Mars mission, planning to send the first crewed flight by 2030."
  ],
  health: [
    "Researchers at Harvard Medical School developed a new cancer treatment that shows 80% success rates in early clinical trials.",
    "The WHO approved a new malaria vaccine that could prevent millions of infections annually in affected regions.",
    "Breakthrough in gene therapy offers hope for treating rare genetic disorders that previously had no effective treatments."
  ],
  sports: [
    "The Olympics committee announced Paris as the host for the 2028 summer games, promising the most sustainable event in history.",
    "Soccer superstar Lionel Messi signed a record-breaking contract with Miami FC, bringing his talents to the American league.",
    "New research shows benefits of athletic training on mental health, with studies indicating reduced anxiety and depression among regular exercisers."
  ]
};
      
      const templates = contentTemplates[category] || contentTemplates.general;
      const content = templates[Math.floor(Math.random() * templates.length)];
      
      const titles = {
        tech: "Technology Advancements Break New Ground",
        business: "Business Sector Demonstrates Strong Performance", 
        world: "Global Developments Shape International Landscape",
        health: "Healthcare Innovations Improve Patient Outcomes",
        general: "Significant Progress Across Multiple Domains"
      };
      
      return {
        url,
        title: titles[category] || "Important News Development",
        content: content,
        published: new Date().toISOString(),
        category: category
      };
    } catch (error) {
      console.error(`Error creating article for ${url}:`, error.message);
      return null;
    }
  }

  async processAndStoreArticles() {
    try {
      console.log('Creating mock news data for demonstration...');
      
      // Clear any existing data
      this.vectorStore.clear();
      
      // Create sample articles
      const articles = [];
      const categories = ['tech', 'business', 'world', 'health'];
      
      for (let i = 0; i < 20; i++) {
        const category = categories[i % categories.length];
        const url = `https://example.com/${category}/article-${i+1}`;
        
        const article = await this.fetchArticleContent(url);
        if (article) {
          articles.push(article);
          console.log(`Created article: ${article.title}`);
        }
      }
      
      // Generate embeddings and store in vector store
      const embeddings = [];
      const metadata = [];
      const documents = [];
      
      for (const article of articles) {
        const embedding = await this.generateEmbedding(article.content);
        embeddings.push(embedding);
        metadata.push({
          url: article.url,
          title: article.title,
          published: article.published,
          category: article.category
        });
        documents.push(article.content);
      }
      
      this.vectorStore.addVectors(embeddings, metadata, documents);
      
      console.log(`Successfully created ${articles.length} mock articles`);
      return { success: true, count: articles.length, vectorStore: this.vectorStore };
    } catch (error) {
      console.error('Error in processAndStoreArticles:', error.message);
      return { success: false, error: error.message };
    }
  }

  getVectorStore() {
    return this.vectorStore;
  }
}

module.exports = NewsFetcher;