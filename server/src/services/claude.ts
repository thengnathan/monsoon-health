import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001';

export async function claudeChat(prompt: string, systemPrompt?: string, model?: string): Promise<string> {
    const response = await client.messages.create({
        model: model ?? MODEL,
        max_tokens: 8192,
        ...(systemPrompt ? { system: systemPrompt } : {}),
        messages: [{ role: 'user', content: prompt }],
    });

    const block = response.content[0];
    if (block.type !== 'text') throw new Error('Claude returned non-text response');
    return block.text;
}

export async function claudeExtract<T>(prompt: string, systemPrompt?: string): Promise<T> {
    const raw = await claudeChat(prompt, systemPrompt);

    // 1. Try extracting JSON from inside a code fence (handles extra text before/after)
    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    // 2. Try extracting the first JSON object or array from the raw text
    const inlineMatch = raw.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);

    const candidate = fenceMatch?.[1]?.trim() ?? inlineMatch?.[1]?.trim() ?? raw.trim();

    try {
        return JSON.parse(candidate) as T;
    } catch {
        throw new Error(`Claude returned non-JSON response: ${raw.slice(0, 200)}`);
    }
}
