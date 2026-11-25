export async function openRouterCompletion(messages, schema, signal, { apiKey, model, fetchImpl = fetch }) {
  const response = await fetchImpl('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    redirect: 'error',
    headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model, messages,
      temperature: 0, max_tokens: 1600, provider: { require_parameters: true },
      response_format: { type: 'json_schema', json_schema: { name: 'paper_query', strict: true, schema } },
    }),
    signal,
  });
  if (!response.ok || !response.body) {
    await response.body?.cancel();
    throw new Error('Translation provider unavailable');
  }
  const chunks = [];
  let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.length;
    if (bytes > 32_768) throw new Error('Translation response is too large');
    chunks.push(chunk);
  }
  const choice = JSON.parse(Buffer.concat(chunks).toString('utf8')).choices?.[0];
  if (choice?.finish_reason !== 'stop' || choice.message?.refusal || typeof choice.message?.content !== 'string') {
    throw new Error('Incomplete translation');
  }
  return JSON.parse(choice.message.content);
}
