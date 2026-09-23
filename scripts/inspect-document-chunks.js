import { azureSearch } from '../server/services/azureSearchService.js';
import { ragPipeline } from '../server/services/ragPipeline.js';
import { config } from '../server/config.js';

async function inspectDoc() {
  const docs = await ragPipeline.getDocuments();
  const testDoc = docs.find((d) => d.name.includes('Physical Layer')) || docs[0];
  console.log(`Document: "${testDoc.name}" (${testDoc.id}, pages: ${testDoc.pages})\n`);

  const url = `${config.search.endpoint.replace(/\/+$/, '')}/indexes/${config.search.indexName}/docs?api-version=${config.search.apiVersion}&$filter=documentId eq '${testDoc.id}'&$select=id,documentId,documentName,pageNumber,chunkIndex,content&$top=1000&$orderby=pageNumber asc,chunkIndex asc`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'api-key': config.search.apiKey,
    },
  });

  const data = await res.json();
  const chunks = data.value || [];
  console.log(`Total chunks found in Azure AI Search: ${chunks.length}`);

  console.log('\nSample chunk pages and starting lines:');
  for (let i = 0; i < Math.min(chunks.length, 15); i++) {
    const c = chunks[i];
    const firstLine = c.content.split('\n')[0].substring(0, 80);
    console.log(`[Page ${c.pageNumber}, Chunk ${c.chunkIndex}, ID: ${c.id}] -> ${firstLine}`);
  }

  // Group by page
  const pageMap = new Map();
  for (const c of chunks) {
    if (!pageMap.has(c.pageNumber)) pageMap.set(c.pageNumber, []);
    pageMap.get(c.pageNumber).push(c);
  }
  console.log(`\nDistinct pages covered in index: ${pageMap.size} pages (range: Page ${Math.min(...pageMap.keys())} to Page ${Math.max(...pageMap.keys())})`);
}

inspectDoc().catch(console.error);
