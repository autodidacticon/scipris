import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function cliEnvironment(provider, env) {
  const names = ['HOME', 'USER', 'PATH', 'TMPDIR', 'LANG', 'SystemRoot', 'USERPROFILE', 'APPDATA',
    'LOCALAPPDATA', 'TEMP', 'HTTPS_PROXY', 'HTTP_PROXY', 'NO_PROXY', 'SSL_CERT_FILE', 'NODE_EXTRA_CA_CERTS'];
  const auth = provider === 'codex'
    ? ['CODEX_HOME', 'OPENAI_API_KEY', 'CODEX_API_KEY']
    : ['CLAUDE_CONFIG_DIR', 'CLAUDE_CODE_OAUTH_TOKEN', 'ANTHROPIC_API_KEY'];
  return Object.fromEntries([...names, ...auth].filter(key => env[key] !== undefined).map(key => [key, env[key]]));
}

function run(command, args, input, { cwd, env, signal }) {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const group = process.platform !== 'win32';
    const child = spawn(command, args, { cwd, env, detached: group, stdio: ['pipe', 'pipe', 'ignore'] });
    const chunks = [];
    let size = 0;
    const stop = () => {
      if (!child.pid) return;
      try { process.kill(group ? -child.pid : child.pid, 'SIGKILL'); }
      catch (error) { if (error.code !== 'ESRCH') reject(error); }
    };
    signal.addEventListener('abort', stop, { once: true });
    child.stdout.on('data', chunk => {
      size += chunk.length;
      if (size > 32_768) stop();
      else chunks.push(chunk);
    });
    child.on('error', reject);
    child.once('close', code => {
      signal.removeEventListener('abort', stop);
      if (signal.aborted || code !== 0 || size > 32_768) reject(new Error('Local drafting provider failed'));
      else resolve(Buffer.concat(chunks).toString('utf8').trim());
    });
    // A CLI can exit before it reads stdin (for example, when a login expires).
    child.stdin.on('error', error => { if (error.code !== 'EPIPE') stop(); });
    child.stdin.end(input);
  });
}

export function localProvider(provider, settings) {
  const env = cliEnvironment(provider, settings);
  const model = settings.NLP_MODEL?.trim();
  const modelArgs = model ? ['--model', model] : [];
  return {
    async available() {
      const args = provider === 'codex' ? ['login', 'status'] : ['auth', 'status', '--json'];
      try {
        const status = await run(provider, args, '', { cwd: tmpdir(), env, signal: AbortSignal.timeout(5000) });
        return provider === 'codex' || JSON.parse(status).loggedIn === true;
      } catch {
        return false;
      }
    },

    async complete(messages, schema, signal) {
      const cwd = await mkdtemp(join(tmpdir(), 'scipris-draft-'));
      try {
        const instructions = [
          messages[0].content, 'Use only the supplied description, calendar and examples. Do not use tools.',
          'Return only one JSON object conforming to this schema:',
          JSON.stringify(schema), 'Example exchanges:', JSON.stringify(messages.slice(1, -1)),
        ].join('\n');
        const input = JSON.stringify({ description: messages.at(-1).content });
        let args;
        if (provider === 'codex') {
          const schemaFile = join(cwd, 'response-schema.json');
          await writeFile(schemaFile, JSON.stringify(schema));
          args = ['-a', 'never', 'exec', '--ephemeral', '--ignore-user-config', '--skip-git-repo-check',
            '--sandbox', 'read-only', '--disable', 'shell_tool', '--disable', 'unified_exec',
            '--disable', 'apps', '--disable', 'plugins', '--disable', 'hooks', '--disable', 'multi_agent',
            '-c', 'web_search="disabled"', '-c', 'project_doc_max_bytes=0',
            '-c', 'developer_instructions=' + JSON.stringify(instructions), '--output-schema', schemaFile,
            ...modelArgs, '-'];
        } else {
          args = ['--print', '--restricted', '--tools', '', '--strict-mcp-config', '--disable-slash-commands',
            '--permission-mode', 'dontAsk', '--no-session-persistence', '--system-prompt', instructions, ...modelArgs];
        }
        const output = await run(provider, args, input, { cwd, env, signal });
        return JSON.parse(output);
      } finally {
        await rm(cwd, { recursive: true, force: true });
      }
    },
  };
}
