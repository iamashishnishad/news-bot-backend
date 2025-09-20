import axios from 'axios';
import { parseString } from 'xml2js';

class SimpleNewsFetcher {
  constructor() {
    this.articles = [];
  }

  async fetchNewsFromRSS() {
    try {
      console.log('Fetching news from RSS feeds...');
      
      // Simple RSS feeds that don't require complex parsing
      const rssFeeds = [
        'https://feeds.bbci.co.uk/news/technology/rss.xml',
        'https://feeds.bbci.co.uk/news/business/rss.xml',
        'https://feeds.bbci.co.uk/news/world/rss.xml'
      ];

      const articles = [];
      
      for (const feedUrl of rssFeeds) {
        try {
          const response = await axios.get(feedUrl, {
            timeout: 10000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          
          const parsed = await new Promise((resolve, reject) => {
            parseString(response.data, (err, result) => {
              if (err) reject(err);
              else resolve(result);
            });
          });
          
          if (parsed.rss && parsed.rss.channel && parsed.rss.channel[0].item) {
            const items = parsed.rss.channel[0].item.slice(0, 3);
            
            for (const item of items) {
              if (articles.length >= 15) break;
              
              const article = {
                url: item.link[0],
                title: item.title[0],
                content: item.description ? item.description[0] : 'No content available',
                published: item.pubDate ? item.pubDate[0] : new Date().toISOString(),
                source: 'BBC News'
              };
              
              articles.push(article);
              console.log(`✓ Added article: ${item.title[0]}`);
            }
          }
        } catch (feedError) {
          console.log(`Error processing feed ${feedUrl}: ${feedError.message}`);
          continue;
        }
      }
      
      return articles;
    } catch (error) {
      console.error('Error fetching news from RSS:', error.message);
      return this.getFallbackArticles();
    }
  }

  async processAndStoreArticles() {
    try {
      console.log('Starting news processing...');
      
      // Fetch news articles
      const articles = await this.fetchNewsFromRSS();
      console.log(`Fetched ${articles.length} news articles`);
      
      this.articles = articles;
      
      return { success: true, count: articles.length };
    } catch (error) {
      console.error('Error in processAndStoreArticles:', error.message);
      return { success: false, error: error.message };
    }
  }

  getArticles() {
    return this.articles;
  }

  getFallbackArticles() {
    return [
      {
        url: 'https://www.bbc.com/news/technology',
        title: 'AI assistants are becoming more capable',
        content: 'Artificial intelligence assistants are demonstrating improved capabilities in natural language understanding and task completion.',
        published: new Date().toISOString(),
        source: 'BBC'
      },
      {
        url: 'https://www.bbc.com/news/business',
        title: 'Global markets show resilience',
        content: 'Financial markets around the world are demonstrating remarkable resilience amid economic uncertainties.',
        published: new Date().toISOString(),
        source: 'BBC'
      }
    ];
  }
}

export default SimpleNewsFetcher;