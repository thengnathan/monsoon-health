import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001';

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
const EXTRACTION_MODEL = 'claude-sonnet-4-6';
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

export async function claudeExtractFromPDF<T>(pdfBuffer: Buffer, prompt: string, systemPrompt?: string, maxTokens = EXTRACTION_MAX_TOKENS): Promise<T> {
    const stream = await client.messages.stream({
        model: EXTRACTION_MODEL,
        max_tokens: maxTokens,
        ...(systemPrompt ? { system: systemPrompt } : {}),
        messages: [{
            role: 'user',
            content: [
                {
                    type: 'document',
                    source: {
                        type: 'base64',
                        media_type: 'application/pdf',
                        data: pdfBuffer.toString('base64'),
                    },
                },
                { type: 'text', text: prompt },
            ],
        }],
    });
    const response = await stream.finalMessage();
    const block = response.content[0];
    if (block.type !== 'text') throw new Error('Claude returned non-text response');
    return parseJsonFromResponse(block.text) as T;
}
