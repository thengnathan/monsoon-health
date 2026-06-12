import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';

export async function claudeChat(prompt: string, systemPrompt?: string, model?: string, maxTokens = 8192): Promise<string> {
    const response = await client.messages.create({
        model: model ?? MODEL,
        max_tokens: maxTokens,
        ...(systemPrompt ? { system: systemPrompt } : {}),
        messages: [{ role: 'user', content: prompt }],
    });

    const block = response.content[0];
    if (block.type !== 'text') throw new Error('Claude returned non-text response');
    return block.text;
}

// Protocol extraction uses Sonnet with streaming + native PDF support
export const EXTRACTION_MODEL = 'claude-sonnet-4-6';
const EXTRACTION_MAX_TOKENS = 32000;

function parseJsonFromResponse(raw: string): unknown {
    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    const inlineMatch = raw.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    const candidate = fenceMatch?.[1]?.trim() ?? inlineMatch?.[1]?.trim() ?? raw.trim();
    try {
        return JSON.parse(candidate);
    } catch {
        throw new Error(`Claude returned non-JSON response: ${raw.slice(0, 200)}`);
    }
}

export async function claudeExtract<T>(prompt: string, systemPrompt?: string): Promise<T> {
    const stream = await client.messages.stream({
        model: EXTRACTION_MODEL,
        max_tokens: EXTRACTION_MAX_TOKENS,
        ...(systemPrompt ? { system: systemPrompt } : {}),
        messages: [{ role: 'user', content: prompt }],
    });
    const response = await stream.finalMessage();
    const block = response.content[0];
    if (block.type !== 'text') throw new Error('Claude returned non-text response');
    return parseJsonFromResponse(block.text) as T;
}

// Build the cached PDF content block — adding cache_control means the document
// is stored server-side for 5 min. Call 1 warms the cache; Call 2 (SoA) and any
// parallel cohort calls get an instant cache hit on the same PDF bytes.
function buildCachedPdfBlock(pdfBuffer: Buffer): Anthropic.Messages.DocumentBlockParam {
    return {
        type: 'document',
        source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: pdfBuffer.toString('base64'),
        },
        cache_control: { type: 'ephemeral' },
    } as Anthropic.Messages.DocumentBlockParam;
}

// Text-response extraction (Call 1 — protocol metadata). Streaming kept for
// progressive UI feedback via the onCall1Complete callback.
export async function claudeExtractFromPDF<T>(pdfBuffer: Buffer, prompt: string, systemPrompt?: string, maxTokens = EXTRACTION_MAX_TOKENS): Promise<T> {
    const stream = await client.messages.stream({
        model: EXTRACTION_MODEL,
        max_tokens: maxTokens,
        ...(systemPrompt ? { system: systemPrompt } : {}),
        messages: [{
            role: 'user',
            content: [
                buildCachedPdfBlock(pdfBuffer),
                { type: 'text', text: prompt },
            ],
        }],
    });
    const response = await stream.finalMessage();
    const block = response.content[0];
    if (block.type !== 'text') throw new Error('Claude returned non-text response');
    return parseJsonFromResponse(block.text) as T;
}

export interface ToolDefinition {
    name: string;
    description: string;
    input_schema: Record<string, unknown>;
}

// Tool-use extraction — forces Claude to populate a strict schema rather than
// returning free-text JSON. Eliminates parse failures and dropped fields.
// Used for SoA Call 2 where schema compliance is critical for accuracy.
export async function claudeExtractWithTool<T>(
    pdfBuffer: Buffer,
    tool: ToolDefinition,
    prompt: string,
    systemPrompt?: string,
    maxTokens = EXTRACTION_MAX_TOKENS,
): Promise<T> {
    const response = await client.messages.create({
        model: EXTRACTION_MODEL,
        max_tokens: maxTokens,
        ...(systemPrompt ? { system: systemPrompt } : {}),
        tools: [tool as Anthropic.Messages.Tool],
        tool_choice: { type: 'tool', name: tool.name },
        messages: [{
            role: 'user',
            content: [
                buildCachedPdfBlock(pdfBuffer),
                { type: 'text', text: prompt },
            ],
        }],
    });

    const toolBlock = response.content.find(b => b.type === 'tool_use');
    if (!toolBlock || toolBlock.type !== 'tool_use') {
        throw new Error('Claude did not return a tool_use block');
    }
    return toolBlock.input as T;
}
