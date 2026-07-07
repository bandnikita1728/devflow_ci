import { ChromaClient, Collection } from 'chromadb';
import type { FeatureExtractionPipeline } from '@xenova/transformers';

const COLLECTION_NAME = 'pr_reviews';
const CHROMA_URL = process.env.CHROMA_URL || 'http://localhost:8000';
const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';

let client: ChromaClient | null = null;
let collection: Collection | null = null;
let embedder: FeatureExtractionPipeline | null = null;

// @xenova/transformers is ESM-only; a plain `import()` gets downleveled to
// `require()` by ts-jest's CommonJS output, which fails on an ESM package.
// Using `new Function` for the import keeps it a real dynamic import at runtime.
const dynamicImport = new Function('specifier', 'return import(specifier)') as (
  specifier: string
) => Promise<typeof import('@xenova/transformers')>;

async function getEmbedder(): Promise<FeatureExtractionPipeline> {
  if (!embedder) {
    const { pipeline } = await dynamicImport('@xenova/transformers');
    embedder = (await pipeline('feature-extraction', EMBEDDING_MODEL)) as FeatureExtractionPipeline;
  }
  return embedder;
}

export async function initializeRAG(): Promise<Collection> {
  if (collection) return collection;

  client = new ChromaClient({ path: CHROMA_URL });
  collection = await client.getOrCreateCollection({ name: COLLECTION_NAME });

  await getEmbedder();

  console.log(`[RAG] ChromaDB collection "${COLLECTION_NAME}" ready at ${CHROMA_URL}`);
  return collection;
}
