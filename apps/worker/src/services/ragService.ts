import { ChromaClient, CloudClient, Collection } from 'chromadb';
import type { FeatureExtractionPipeline } from '@xenova/transformers';

const COLLECTION_NAME = 'pr_reviews';
const CHROMA_URL = process.env.CHROMA_URL || 'http://localhost:8000';
const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';

export interface PRData {
  repoFullName: string;
  prNumber: number;
  headSha: string;
  title: string;
  diff: string;
  summary?: string;
}

export interface SimilarPR {
  repoFullName: string;
  prNumber: number;
  headSha: string;
  title: string;
  summary: string;
  diff: string;
  distance: number | null;
}

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

async function embedText(text: string): Promise<number[]> {
  const model = await getEmbedder();
  const output = await model(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data as Float32Array);
}

function buildId(repoFullName: string, prNumber: number, headSha: string): string {
  return `${repoFullName}#${prNumber}@${headSha}`;
}

export async function initializeRAG(): Promise<Collection> {
  if (collection) return collection;

  const usingCloud = !!process.env.CHROMA_API_KEY;
  const endpoint = usingCloud ? 'Chroma Cloud' : CHROMA_URL;

  if (usingCloud) {
    client = new CloudClient({
      apiKey: process.env.CHROMA_API_KEY,
      tenant: process.env.CHROMA_TENANT,
      database: process.env.CHROMA_DATABASE,
    });
    console.log('[RAG] Connected to Chroma Cloud');
  } else {
    client = new ChromaClient({ path: CHROMA_URL });
    console.log('[RAG] Connected to local Chroma at ' + CHROMA_URL);
  }

  // We supply our own vectors via @xenova/transformers, so Chroma must never
  // embed anything. Passing embeddingFunction: null skips the default embedding
  // function; otherwise chromadb tries to construct DefaultEmbeddingFunction
  // (@chroma-core/default-embed) and throws when it isn't installed.
  collection = await client.getOrCreateCollection({
    name: COLLECTION_NAME,
    embeddingFunction: null,
  });

  await getEmbedder();

  console.log(`[RAG] ChromaDB collection "${COLLECTION_NAME}" ready at ${endpoint}`);
  return collection;
}

export async function embedAndStore(prData: PRData): Promise<string> {
  const col = collection ?? (await initializeRAG());
  const id = buildId(prData.repoFullName, prData.prNumber, prData.headSha);
  const embedding = await embedText(`${prData.title}\n\n${prData.diff}`);

  await col.upsert({
    ids: [id],
    embeddings: [embedding],
    documents: [prData.diff],
    metadatas: [{
      repoFullName: prData.repoFullName,
      prNumber: prData.prNumber,
      headSha: prData.headSha,
      title: prData.title,
      summary: prData.summary ?? '',
    }],
  });

  return id;
}

export async function searchSimilarPRs(newPRDiff: string, topK = 3): Promise<SimilarPR[]> {
  const col = collection ?? (await initializeRAG());
  const embedding = await embedText(newPRDiff);

  const results = await col.query({
    queryEmbeddings: [embedding],
    nResults: topK,
  });

  const ids = results.ids[0] ?? [];
  const documents = results.documents[0] ?? [];
  const metadatas = results.metadatas[0] ?? [];
  const distances = results.distances?.[0] ?? [];

  return ids.map((_, i) => {
    const meta = (metadatas[i] ?? {}) as Record<string, any>;
    return {
      repoFullName: meta.repoFullName,
      prNumber: meta.prNumber,
      headSha: meta.headSha,
      title: meta.title,
      summary: meta.summary ?? '',
      diff: documents[i] ?? '',
      distance: distances[i],
    };
  });
}
