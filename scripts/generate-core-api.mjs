import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const version = '7.23.0';
const sha256 = 'cb087e40001e31eb08ef6140dd5de10938dbeb89016a1fe0481eaa25cd569026';
const jarName = `openapi-generator-cli-${version}.jar`;
const cache = resolve('.cache/openapi-generator');
const configuredJar = process.env['OPENAPI_GENERATOR_JAR'];
const jar = configuredJar ? resolve(configuredJar) : join(cache, jarName);
const destination = 'src/app/core/api/generated';

function verifyJar(bytes) {
  if (createHash('sha256').update(bytes).digest('hex') !== sha256) {
    throw new Error(`OpenAPI Generator ${version} checksum mismatch for ${jar}`);
  }
}

async function prepareJar() {
  try {
    verifyJar(await readFile(jar));
    return;
  } catch (error) {
    if (configuredJar || error.code !== 'ENOENT') throw error;
  }

  const url = `https://repo.maven.apache.org/maven2/org/openapitools/openapi-generator-cli/${version}/${jarName}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`Downloading ${jarName} failed with HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  verifyJar(bytes);

  await mkdir(cache, { recursive: true });
  const download = await mkdtemp(join(cache, 'download-'));
  try {
    const temporaryJar = join(download, jarName);
    await writeFile(temporaryJar, bytes);
    await rename(temporaryJar, jar);
  } finally {
    await rm(download, { recursive: true, force: true });
  }
}

await prepareJar();
const temporary = await mkdtemp(join(tmpdir(), 'scipris-core-api-'));
try {
  const generated = join(temporary, 'generator-output');
  const source = join(temporary, 'source');
  execFileSync('java', [
    '-jar', jar, 'generate', '-c', 'scripts/core-api-generator.json',
    '-o', generated, '--skip-operation-example',
  ], { stdio: 'inherit' });

  for (const file of await readdir(generated, { recursive: true })) {
    if (!file.endsWith('.ts')) continue;
    const content = await readFile(join(generated, file), 'utf8');
    const normalized = content.replace(/[ \t]+$/gm, '').trimEnd() + '\n';
    const output = join(source, file);
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, normalized);
  }

  // Replace the generated tree only after a successful run, including removal of stale files.
  await rm(destination, { recursive: true, force: true });
  await cp(source, destination, { recursive: true });
} finally {
  await rm(temporary, { recursive: true, force: true });
}
