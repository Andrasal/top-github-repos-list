import type { ChatTool } from '../chat';
import { AiError } from './errors';
import { validate, type Schema } from './validate';

/**
 * Run one model-requested tool call (SPEC §25.3). The input is checked against the tool's
 * schema first; a bad input or a tool failure comes back as an error result for the model.
 */
export async function execToolCall(tool: ChatTool | undefined, name: string, input: unknown, signal?: AbortSignal): Promise<{ content: string; isError: boolean }> {
  if (!tool) return { content: `Unknown tool "${name}".`, isError: true };
  const problems = validate(input, tool.inputSchema as Schema | undefined);
  if (problems.length) return { content: JSON.stringify({ INVALID_JSON: JSON.stringify(input), problems }), isError: true };
  try {
    const out = await tool.execute(input as Record<string, unknown>, { signal });
    return { content: JSON.stringify(out ?? null), isError: false };
  } catch (e) {
    if (signal?.aborted) throw new AiError('cancelled', 'Stopped by the user');
    return { content: (e as Error).message || 'Tool failed', isError: true };
  }
}
