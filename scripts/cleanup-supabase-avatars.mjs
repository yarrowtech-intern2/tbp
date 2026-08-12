import { existsSync, readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const BUCKET = 'avatars';
const PAGE_SIZE = 1000;
const REMOVE_BATCH_SIZE = 100;

const loadLocalEnv = () => {
  if (!existsSync('.env')) return;
  const lines = readFileSync('.env', 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const index = trimmed.indexOf('=');
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
};

const chunk = (items, size) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const joinPath = (prefix, name) => (prefix ? `${prefix}/${name}` : name);

const listFiles = async (storage, prefix = '') => {
  const files = [];
  let offset = 0;

  while (true) {
    const { data, error } = await storage.from(BUCKET).list(prefix, {
      limit: PAGE_SIZE,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw error;
    const rows = data || [];

    for (const item of rows) {
      const path = joinPath(prefix, item.name);
      if (item.id) {
        files.push(path);
      } else {
        files.push(...await listFiles(storage, path));
      }
    }

    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return files;
};

const main = async () => {
  loadLocalEnv();

  const execute = process.argv.includes('--execute');
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Set SUPABASE_URL or VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this script.');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const files = await listFiles(supabase.storage);
  console.log(`${execute ? 'Deleting' : 'Dry run:'} ${files.length} file(s) found in "${BUCKET}" bucket.`);
  for (const file of files) console.log(file);

  if (!execute) {
    console.log('\nNo files deleted. Re-run with --execute to delete these files.');
    return;
  }

  for (const group of chunk(files, REMOVE_BATCH_SIZE)) {
    const { error } = await supabase.storage.from(BUCKET).remove(group);
    if (error) throw error;
  }

  console.log(`Deleted ${files.length} file(s) from "${BUCKET}".`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
