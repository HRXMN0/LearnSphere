import { config } from '../server/config.js';
import { ragPipeline } from '../server/services/ragPipeline.js';

async function listAllHeadings() {
  const docs = await ragPipeline.getDocuments();
  const testDoc = docs.find((d) => d.name.includes('Physical Layer')) || docs[0];

  const url = `${config.search.endpoint.replace(/\/+$/, '')}/indexes/${config.search.indexName}/docs?api-version=${config.search.apiVersion}&$filter=documentId eq '${testDoc.id}'&$select=id,pageNumber,chunkIndex,content&$top=1000&$orderby=pageNumber asc,chunkIndex asc`;

  const res = await fetch(url, {
    headers: { 'api-key': config.search.apiKey }
  });
  const data = await res.json();
  const chunks = data.value || [];

  console.log(`--- OUTLINE OF ALL ${chunks.length} CHUNKS ---`);
  for (const c of chunks) {
    const lines = c.content.split('\n').map(l => l.trim()).filter(Boolean);
    const title = lines[0] || 'Untitled';
    console.log(`P${c.pageNumber}: ${title.substring(0, 90)}`);
  }
}

listAllHeadings().catch(console.error);
