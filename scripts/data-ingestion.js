const axios = require('axios');
const { parseString } = require('xml2js');
const { JinaAI } = require('jinaai');
const { ChromaClient } = require('chromadb');

// Initialize Jina AI
const jinaai = new JinaAI({
  secrets: {
    'promptperfect-secret': process.env.JINA_API_KEY,
  }
});

// Initialize ChromaDB
const chromaClient = new ChromaClient();

async function fetchNewsArticles() {
  try {
    // Fetch Reuters sitemap
    const response = await axios.get('https://www.reuters.com/arc/outboundfeeds/sitemap-index/?outputType=xml');
    
    parseString(response.data, async (err, result) => {
      if (err) {
        console.error('Error parsing XML:', err);
        return;
      }

      const sitemaps = result.sitemapindex.sitemap;
      const articleUrls = [];
      
      // Extract URLs from sitemaps (limit to 50 articles)
      for (const sitemap of sitemaps.slice(0, 5)) {
        try {
          const sitemapUrl = sitemap.loc[0];
          const sitemapResponse = await axios.get(sitemapUrl);
          
          parseString(sitemapResponse.data, (err, sitemapResult) => {
            if (err) {
              console.error('Error parsing sitemap XML:', err);
              return;
            }
            
            if (sitemapResult.urlset && sitemapResult.urlset.url) {
              sitemapResult.urlset.url.forEach(url => {
                if (articleUrls.length < 50) {
                  articleUrls.push(url.loc[0]);
                }
              });
            }
          });
        } catch (error) {
          console.error('Error fetching sitemap:', error);
        }
      }

      console.log(`Found ${articleUrls.length} article URLs`);
      
      // Process articles and create embeddings
      await processArticles(articleUrls);
    });
  } catch (error) {
    console.error('Error fetching sitemap index:', error);
  }
}

async function processArticles(urls) {
  const collection = await chromaClient.createCollection({ name: "news-articles" });
  
  for (const url of urls) {
    try {
      // In a real implementation, you would fetch and parse the article content
      // For now, we'll use a placeholder
      const articleContent = `Article from ${url}. This is placeholder content for demonstration.`;
      
      // Generate embeddings
      const embeddings = await jinaai.generateEmbeddings({
        input: articleContent,
        model: 'jina-embeddings-v2-base-en'
      });
      
      // Store in ChromaDB
      await collection.add({
        ids: [url],
        embeddings: [embeddings.data[0].embedding],
        metadatas: [{ url: url, content: articleContent }],
        documents: [articleContent]
      });
      
      console.log(`Processed article: ${url}`);
    } catch (error) {
      console.error(`Error processing article ${url}:`, error);
    }
  }
  
  console.log('Finished processing articles');
}

// Run the ingestion script
fetchNewsArticles();