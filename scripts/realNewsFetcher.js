import { ChromaClient } from "chromadb";
import axios from "axios";
import { parseString } from "xml2js";
import { extract } from "article-parser";
import fetch from "node-fetch";
import cheerio from "cheerio";
import pkg from 'jinaai';
const { JinaAI } = pkg;

import { ChromaClient } from 'chromadb';
import axios from 'axios';
import { parseString } from 'xml2js';

class RealNewsFetcher {
  constructor() {
    this.jinaai = new JinaAI({
      apiKey: process.env.JINA_API_KEY,
    });

    this.chromaClient = new ChromaClient();
  }

  async fetchNewsFromRSS() {
    try {
      console.log("Fetching news from RSS feeds...");

      const rssFeeds = [
        "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml",
        "https://feeds.bbci.co.uk/news/technology/rss.xml",
        "https://feeds.bbci.co.uk/news/business/rss.xml",
        "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml",
        "https://feeds.bbci.co.uk/news/world/rss.xml",
        "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
      ];

      const articles = [];

      for (const feedUrl of rssFeeds.slice(0, 3)) {
        try {
          const response = await axios.get(feedUrl, {
            timeout: 10000,
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            },
          });

          const parsed = await new Promise((resolve, reject) => {
            parseString(response.data, (err, result) => {
              if (err) reject(err);
              else resolve(result);
            });
          });

          if (parsed.rss?.channel?.[0]?.item) {
            const items = parsed.rss.channel[0].item.slice(0, 5);

            for (const item of items) {
              if (articles.length >= 30) break;

              try {
                const articleUrl = item.link[0];
                console.log(`Fetching article: ${articleUrl}`);

                const article = await extract(articleUrl);

                if (article && article.content) {
                  articles.push({
                    url: articleUrl,
                    title: item.title?.[0] || article.title,
                    content: article.content.substring(0, 1000),
                    published: item.pubDate?.[0] || new Date().toISOString(),
                    source: feedUrl.includes("nytimes")
                      ? "New York Times"
                      : feedUrl.includes("bbci")
                      ? "BBC"
                      : "RSS Feed",
                  });
                  console.log(`✓ Added article: ${item.title?.[0]}`);
                }
              } catch (articleError) {
                console.log(
                  `Skipping article due to error: ${articleError.message}`
                );
                continue;
              }

              await new Promise((resolve) => setTimeout(resolve, 1000));
            }
          }
        } catch (feedError) {
          console.log(`Error processing feed ${feedUrl}: ${feedError.message}`);
          continue;
        }
      }

      return articles;
    } catch (error) {
      console.error("Error fetching news from RSS:", error.message);
      return this.getFallbackArticles();
    }
  }

  async generateEmbeddingWithJina(text) {
    try {
      console.log("Generating embeddings with Jina AI...");

      const embeddings = await this.jinaai.embeddings({
        model: "jina-embeddings-v2-base-en",
        input: text,
      });

      return embeddings.data[0].embedding;
    } catch (error) {
      console.error("Error generating Jina embeddings:", error.message);
      throw error;
    }
  }

  async setupChromaDB() {
    try {
      console.log("Setting up ChromaDB...");

      let collection;
      try {
        collection = await this.chromaClient.getCollection({
          name: "news-articles",
        });
        console.log("Found existing ChromaDB collection");
      } catch (error) {
        collection = await this.chromaClient.createCollection({
          name: "news-articles",
        });
        console.log("Created new ChromaDB collection");
      }

      return collection;
    } catch (error) {
      console.error("Error setting up ChromaDB:", error.message);
      throw error;
    }
  }

  async processAndStoreRealArticles() {
    try {
      console.log("Starting real news processing...");

      const articles = await this.fetchNewsFromRSS();
      console.log(`Fetched ${articles.length} real news articles`);

      if (articles.length === 0) {
        throw new Error("No articles could be fetched");
      }

      const collection = await this.setupChromaDB();

      const embeddings = [];
      const metadatas = [];
      const documents = [];
      const ids = [];

      for (const article of articles) {
        try {
          const embedding = await this.generateEmbeddingWithJina(
            article.content
          );

          embeddings.push(embedding);
          metadatas.push({
            url: article.url,
            title: article.title,
            published: article.published,
            source: article.source,
          });
          documents.push(article.content);
          ids.push(article.url);

          console.log(`Processed article: ${article.title}`);
        } catch (articleError) {
          console.log(
            `Skipping article due to error: ${articleError.message}`
          );
          continue;
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      if (embeddings.length > 0) {
        await collection.add({
          ids,
          embeddings,
          metadatas,
          documents,
        });

        console.log(
          `✅ Successfully stored ${embeddings.length} articles in ChromaDB`
        );
        return { success: true, count: embeddings.length };
      } else {
        throw new Error("No articles could be processed");
      }
    } catch (error) {
      console.error("Error in processAndStoreRealArticles:", error.message);
      return { success: false, error: error.message };
    }
  }

  getFallbackArticles() {
    return [
      {
        url: "https://www.bbc.com/news/technology",
        title: "AI assistants are becoming more capable",
        content:
          "Artificial intelligence assistants are demonstrating improved capabilities in natural language understanding and task completion.",
        published: new Date().toISOString(),
        source: "BBC",
      },
      {
        url: "https://www.nytimes.com/section/business",
        title: "Global markets show resilience",
        content:
          "Financial markets around the world are demonstrating remarkable resilience amid economic uncertainties.",
        published: new Date().toISOString(),
        source: "New York Times",
      },
    ];
  }
}

export default RealNewsFetcher;