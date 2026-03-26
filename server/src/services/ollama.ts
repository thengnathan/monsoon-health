import * as http from 'http';

const OLLAMA_BASE_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen3.5';

function httpPost(url: string, body: string, timeoutMs: number): Promise<string> {
    return new Promise((resolve, reject) => {
        const parsed = new URL(url);
        const options = {
            hostname: parsed.hostname,
            port: parsed.port || 80,
            path: parsed.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
            },
        };

        const req = http.request(options, (res) => {
            const chunks: Buffer[] = [];
            res.on('data', (chunk: Buffer) => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
            res.on('error', reject);
        });

        req.setTimeout(timeoutMs, () => {
            req.destroy(new Error(`Ollama request timed out after ${timeoutMs}ms`));
        });

        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

export async function ollamaChat(prompt: string, systemPrompt?: string, timeoutMs = 300000): Promise<string> {
    const messages: { role: string; content: string }[] = [];

    if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const body = JSON.stringify({
        model: OLLAMA_MODEL,
        messages,
        stream: false,
        options: { num_ctx: 4096 },
    });

    const raw = await httpPost(`${OLLAMA_BASE_URL}/api/chat`, body, timeoutMs);
    const data = JSON.parse(raw) as { message?: { content: string }; error?: string };

    if (data.error) throw new Error(`Ollama error: ${data.error}`);
    if (!data.message?.content) throw new Error('Ollama returned no content');

    return data.message.content;
}

export async function ollamaExtract<T>(prompt: string, systemPrompt?: string): Promise<T> {
    const raw = await ollamaChat(prompt, systemPrompt);

    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();

    try {
        return JSON.parse(cleaned) as T;
    } catch {
        throw new Error(`Ollama returned non-JSON response: ${raw.slice(0, 200)}`);
    }
}

export async function isOllamaRunning(): Promise<boolean> {
    return new Promise((resolve) => {
        const parsed = new URL(`${OLLAMA_BASE_URL}/api/tags`);
        const req = http.request({ hostname: parsed.hostname, port: parsed.port || 80, path: parsed.pathname }, (res) => {
            res.resume();
            resolve(res.statusCode === 200);
        });
        req.setTimeout(3000, () => { req.destroy(); resolve(false); });
        req.on('error', () => resolve(false));
        req.end();
    });
}
