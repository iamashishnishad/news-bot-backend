const cosineSimilarity = require('compute-cosine-similarity');

class SimpleVectorStore {
  constructor() {
    this.vectors = [];
    this.metadata = [];
    this.documents = [];
  }

  addVectors(vectors, metadata, documents) {
    this.vectors.push(...vectors);
    this.metadata.push(...metadata);
    this.documents.push(...documents);
  }

  similaritySearch(vector, k = 3) {
    const similarities = this.vectors.map((v, i) => ({
      index: i,
      similarity: cosineSimilarity(vector, v)
    }));

    // Sort by similarity (descending)
    similarities.sort((a, b) => b.similarity - a.similarity);

    // Return top k results
    return similarities.slice(0, k).map(item => ({
      content: this.documents[item.index],
      metadata: this.metadata[item.index],
      similarity: item.similarity
    }));
  }

  clear() {
    this.vectors = [];
    this.metadata = [];
    this.documents = [];
  }
}

module.exports = SimpleVectorStore;