type Operator = 'AND' | 'OR' | 'NOT';

export type QuerySegment =
  | { kind: 'text' | 'parenthesis'; text: string }
  | { kind: 'operator'; text: string; operator: Operator };

const binaryAliases = new Map<string, Operator>([['&&', 'AND'], ['||', 'OR']]);

export function splitQuery(query: string): QuerySegment[] {
  // Match quotes and escapes as whole tokens before recognizing operators or grouping.
  const tokens = query.match(/\\.|"(?:\\.|[^"\\])*"?|[()]|&+|\|+|!=|!+|[^\s\\"()&|!]+|\s+|./gu) ?? [];
  const segments: QuerySegment[] = [];

  for (const [index, text] of tokens.entries()) {
    const left = tokens[index - 1];
    const operator = text === '!' && isBoundary(left) ? 'NOT'
      : binaryAliases.get(text) ?? wordOperator(text, left, tokens[index + 1]);
    const previous = segments.at(-1);
    if (operator) {
      segments.push({ kind: 'operator', text, operator });
    } else if (text === '(' || text === ')') {
      segments.push({ kind: 'parenthesis', text });
    } else if (previous?.kind === 'text') {
      previous.text += text;
    } else {
      segments.push({ kind: 'text', text });
    }
  }

  return segments;
}

export function highlightQuery(query: string) {
  const segments = splitQuery(query);
  const openings: number[] = [];
  const matched = new Set<number>();
  for (const [index, segment] of segments.entries()) {
    if (segment.kind !== 'parenthesis') continue;
    if (segment.text === '(') {
      openings.push(index);
    } else {
      const opening = openings.pop();
      if (opening !== undefined) matched.add(opening);
    }
  }

  // Only matched openings start a background, even while the user is mid-edit.
  let depth = 0;
  return segments.map(({ kind, text }, index) => {
    if (matched.has(index)) depth++;
    const part = { kind, text, depth };
    if (kind === 'parenthesis' && text === ')' && depth > 0) depth--;
    return part;
  });
}

export function normalizeQuery(query: string): string {
  const segments = splitQuery(query);
  return segments.map((segment, index) => {
    if (segment.kind !== 'operator') return segment.text;

    const previous = segments[index - 1];
    const next = segments[index + 1];
    // Symbolic operators can touch their operands. Insert only the separators CORE needs.
    const before = previous && previous.kind !== 'operator' && previous.text !== '(' && !/\s$/u.test(previous.text) ? ' ' : '';
    const after = next && next.text !== ')' && !/^\s/u.test(next.text) ? ' ' : '';
    return before + segment.operator + after;
  }).join('');
}

function wordOperator(text: string, previous?: string, next?: string): Operator | undefined {
  const word = text.toUpperCase();
  if (
    (word === 'AND' || word === 'OR' || word === 'NOT') &&
    isBoundary(previous) && isBoundary(next)
  ) return word;
  return undefined;
}

function isBoundary(token?: string): boolean {
  return token === undefined || /^[\s()]/u.test(token) || binaryAliases.has(token);
}
