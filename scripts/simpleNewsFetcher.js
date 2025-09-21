import axios from 'axios';
import { parseString } from 'xml2js';

class SimpleNewsFetcher {
  constructor() {
    this.articles = [];
  }

  async fetchNewsFromRSS() {
    try {
      console.log('Fetching news from RSS feeds...');
      
      // RSS feeds with more technology-focused content
      const rssFeeds = [
        'https://feeds.bbci.co.uk/news/technology/rss.xml',
        'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml',
        'https://feeds.bbci.co.uk/news/business/rss.xml',
        'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml',
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
            const items = parsed.rss.channel[0].item.slice(0, 5); // Get more articles per feed
            
            for (const item of items) {
              if (articles.length >= 25) break; // Increase total articles
              
              try {
                // Try to get more content by fetching the actual article
                let content = item.description ? item.description[0] : 'No content available';
                
                // If it's a short description, try to get more content
                if (content.length < 100 && item.link && item.link[0]) {
                  try {
                    const articleResponse = await axios.get(item.link[0], {
                      timeout: 5000,
                      headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                      }
                    });
                    // Extract text content from HTML (simple version)
                    const textContent = articleResponse.data.replace(/<[^>]*>/g, ' ').substring(0, 500);
                    if (textContent.length > 100) {
                      content = textContent;
                    }
                  } catch (e) {
                    // If fetching fails, keep the original description
                    console.log(`Could not fetch full article from ${item.link[0]}`);
                  }
                }
                
                const article = {
                  url: item.link[0],
                  title: item.title[0],
                  content: content,
                  published: item.pubDate ? item.pubDate[0] : new Date().toISOString(),
                  source: feedUrl.includes('nytimes') ? 'New York Times' : 
                         feedUrl.includes('bbci') ? 'BBC News' : 'News Feed'
                };
                
                articles.push(article);
                console.log(`✓ Added article: ${item.title[0]}`);
              } catch (articleError) {
                console.log(`Skipping article due to error: ${articleError.message}`);
                continue;
              }
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
    // Better fallback articles with more technology content
    return [
      {
        url: 'https://www.bbc.com/news/technology',
        title: 'AI assistants are becoming more capable and integrated',
        content: 'Artificial intelligence assistants are demonstrating improved capabilities in natural language understanding and task completion. Recent advancements in large language models have enabled more sophisticated interactions between humans and machines across various applications.',
        published: new Date().toISOString(),
        source: 'BBC Technology'
      },
      {
        url: 'https://www.nytimes.com/section/technology',
        title: 'Tech companies invest billions in AI research and development',
        content: 'Major technology companies are allocating significant resources toward artificial intelligence research and development. New breakthroughs in machine learning algorithms are enabling applications that were previously considered science fiction, from advanced healthcare diagnostics to autonomous transportation systems.',
        published: new Date().toISOString(),
        source: 'New York Times Technology'
      },
      {
        url: 'https://www.bbc.com/news/business',
        title: 'Technology sector leads market growth with AI innovations',
        content: 'The technology sector continues to demonstrate strong performance in global markets, largely driven by innovations in artificial intelligence and cloud computing. Investors are showing increased confidence in companies that are effectively leveraging AI technologies to create new products and services.',
        published: new Date().toISOString(),
        source: 'BBC Business'
      },
      {
        url: 'https://www.nytimes.com/section/business',
        title: 'Global businesses adopt AI solutions for efficiency gains',
        content: 'Businesses worldwide are increasingly adopting artificial intelligence solutions to improve operational efficiency and gain competitive advantages. From automated customer service to predictive analytics, AI technologies are transforming traditional business models across multiple industries.',
        published: new Date().toISOString(),
        source: 'New York Times Business'
      }
    ];
  }
}

export default SimpleNewsFetcher;