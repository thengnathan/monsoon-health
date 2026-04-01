import OpenAI from 'openai';
import { Pool } from 'pg';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const EMBEDDING_MODEL = 'text-embedding-3-small';
const CHUNK_SIZE = 800;      // tokens (approx ~600 words)
const CHUNK_OVERLAP = 100;   // overlap between chunks to preserve context

/**
 * Split text into overlapping chunks by word count (rough token proxy).
 */
export function chunkText(text: string, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    const chunks: string[] = [];

    let start = 0;
    while (start < words.length) {
        const end = Math.min(start + chunkSize, words.length);
        chunks.push(words.slice(start, end).join(' '));
        if (end === words.length) break;
        start += chunkSize - overlap;
    }

    return chunks;
}

/**
 * Generate an embedding vector for a single piece of text.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
    const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: text.replace(/\n+/g, ' ').trim(),
    });
    return response.data[0].embedding;
}

/**
 * Chunk, embed, and store a document in the document_chunks table.
 * Deletes any existing chunks for this document before inserting.
 */
export async function embedAndStoreDocument(
    db: Pool,
    documentId: string,
    documentType: 'protocol' | 'patient',
    siteId: string,
    text: string,
    metadata: Record<string, unknown> = {}
): Promise<void> {
    // Remove old chunks for this document
    await db.query(
        'DELETE FROM document_chunks WHERE document_id = $1 AND site_id = $2',
        [documentId, siteId]
    );

    const chunks = chunkText(text);
    console.log(`[Embeddings] Embedding ${chunks.length} chunks for ${documentType} ${documentId}`);

    for (let i = 0; i < chunks.length; i++) {
        const embedding = await generateEmbedding(chunks[i]);
        await db.query(
            `INSERT INTO document_chunks (document_id, document_type, site_id, chunk_index, content, embedding, metadata)
             VALUES ($1, $2, $3, $4, $5, $6::vector, $7)`,
            [documentId, documentType, siteId, i, chunks[i], JSON.stringify(embedding), metadata]
        );
    }

    console.log(`[Embeddings] Stored ${chunks.length} chunks for ${documentType} ${documentId}`);
}

/**
 * Search for chunks semantically similar to a query.
 * Optionally filter by document_type, site_id, or document_id.
 */
export async function searchChunks(
    db: Pool,
    query: string,
    options: {
        siteId: string;
        documentType?: 'protocol' | 'patient';
        documentId?: string;
        limit?: number;
    }
): Promise<{ content: string; document_id: string; document_type: string; similarity: number }[]> {
    const { siteId, documentType, documentId, limit = 5 } = options;
    const queryEmbedding = await generateEmbedding(query);

    const conditions: string[] = ['site_id = $2'];
    const params: unknown[] = [JSON.stringify(queryEmbedding), siteId];
    let paramIdx = 3;

    if (documentType) {
        conditions.push(`document_type = $${paramIdx++}`);
        params.push(documentType);
    }
    if (documentId) {
        conditions.push(`document_id = $${paramIdx++}`);
        params.push(documentId);
    }

    const where = conditions.join(' AND ');
    const rows = await db.query(
        `SELECT content, document_id, document_type,
                1 - (embedding <=> $1::vector) AS similarity
         FROM document_chunks
         WHERE ${where}
         ORDER BY embedding <=> $1::vector
         LIMIT $${paramIdx}`,
        [...params, limit]
    );

    return rows.rows;
}
