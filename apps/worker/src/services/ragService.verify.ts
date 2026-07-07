import 'dotenv/config';
import { initializeRAG, embedAndStore, searchSimilarPRs, PRData } from './ragService';

const samplePRs: PRData[] = [
  {
    repoFullName: 'devflow/api',
    prNumber: 101,
    headSha: 'sha-auth-1',
    title: 'Fix JWT token expiry validation',
    diff: `diff --git a/src/auth.ts b/src/auth.ts
- if (token.exp < Date.now())
+ if (token.exp * 1000 < Date.now())
   throw new Error('Token expired');`,
    summary: 'Fixed JWT expiry check using wrong time unit',
  },
  {
    repoFullName: 'devflow/api',
    prNumber: 102,
    headSha: 'sha-auth-2',
    title: 'Add refresh token rotation on login',
    diff: `diff --git a/src/auth.ts b/src/auth.ts
+ async function rotateRefreshToken(userId: string) {
+   await db.tokens.revoke(userId);
+   return issueRefreshToken(userId);
+ }`,
    summary: 'Adds refresh token rotation to auth service',
  },
  {
    repoFullName: 'devflow/dashboard',
    prNumber: 55,
    headSha: 'sha-ui-1',
    title: 'Fix table pagination off-by-one',
    diff: `diff --git a/src/components/Table.tsx b/src/components/Table.tsx
- const pageStart = page * pageSize;
+ const pageStart = (page - 1) * pageSize;`,
    summary: 'Fixed pagination math bug causing skipped rows',
  },
];

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${message}`);
  }
}

async function main() {
  console.log('[verify] Initializing RAG (ChromaDB + embedding model)...');
  await initializeRAG();

  console.log('[verify] Storing sample PRs...');
  for (const pr of samplePRs) {
    const id = await embedAndStore(pr);
    console.log(`  stored: ${id}`);
  }

  console.log('[verify] Searching for a diff similar to the JWT expiry fix...');
  const authQueryDiff = `diff --git a/src/auth.ts b/src/auth.ts
- if (session.expiresAt < now)
+ if (session.expiresAt * 1000 < now)
   throw new Error('Session expired');`;
  const authResults = await searchSimilarPRs(authQueryDiff, 3);

  console.log('  results:', authResults.map(r => ({
    pr: `${r.repoFullName}#${r.prNumber}`,
    distance: r.distance,
  })));

  assert(authResults.length === 3, 'returns 3 results');
  assert(authResults[0].repoFullName === 'devflow/api' && authResults[0].prNumber === 101,
    'top match is the JWT expiry PR (#101)');
  assert((authResults[0].distance as number) < (authResults[2].distance as number),
    'top match is closer than the least similar result');

  console.log('[verify] Searching for a diff similar to the pagination fix...');
  const uiQueryDiff = `diff --git a/src/components/Table.tsx b/src/components/Table.tsx
- const pageStart = page * pageSize;
+ const pageStart = (page - 1) * pageSize;`;
  const uiResults = await searchSimilarPRs(uiQueryDiff, 3);

  console.log('  results:', uiResults.map(r => ({
    pr: `${r.repoFullName}#${r.prNumber}`,
    distance: r.distance,
  })));

  assert(uiResults[0].repoFullName === 'devflow/dashboard' && uiResults[0].prNumber === 55,
    'top match is the pagination PR (#55)');

  if (process.exitCode === 1) {
    console.error('\n[verify] FAILED');
  } else {
    console.log('\n[verify] ALL CHECKS PASSED');
  }
}

main().catch((err) => {
  console.error('[verify] Unexpected error:', err);
  process.exit(1);
});
