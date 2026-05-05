import { readFile, writeFile } from 'node:fs/promises';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ALLOWED_CHAT_ID = String(process.env.ALLOWED_CHAT_ID);
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const STATE_PATH = '.telegram-state.json';
const SKILLS_PATH = 'skills-import.json';

const VALID_CATS = ['core','engineering','qa','devops','productivity','integrations','meta','data'];

async function tg(method, params) {
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(`Telegram ${method}: ${JSON.stringify(json)}`);
  return json.result;
}

async function notify(text) {
  try {
    await tg('sendMessage', { chat_id: ALLOWED_CHAT_ID, text, disable_web_page_preview: true });
  } catch (e) {
    console.error('notify failed:', e.message);
  }
}

async function fetchReadme(owner, repo) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, {
    headers: { 'Accept': 'application/vnd.github.raw', 'User-Agent': 'nice-skills-bot' },
  });
  if (!res.ok) return null;
  return await res.text();
}

async function askClaude(repoUrl, readme) {
  const prompt = `You are categorizing a Claude Code skill from a GitHub repo for a Hebrew/RTL skills catalog.

Repo URL: ${repoUrl}

README:
${readme.slice(0, 8000)}

Return ONLY a JSON object (no markdown fences, no commentary) with these exact fields:
{
  "name": "short skill name (English or Hebrew, as appropriate for the repo)",
  "cat": "one of: core, engineering, qa, devops, productivity, integrations, meta, data",
  "desc": "Hebrew, 1-2 sentences describing what the skill does",
  "why": "Hebrew, 2-3 sentences on why this is valuable for the team",
  "install": "exact installation command(s) from the README; use \\n for line breaks"
}

Category guide:
- core: coding methodology, discipline, foundational principles
- engineering: code quality, architecture, refactoring
- qa: testing, code review, validation
- devops: CI/CD, deployment, infrastructure
- productivity: writing, content creation, workflow speed
- integrations: external services, APIs, MCP servers
- meta: tools to manage Claude itself, skills, agents, plugins
- data: databases, analytics, ETL`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.content[0].text.trim();
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const parsed = JSON.parse(cleaned);

  if (!parsed.name || !parsed.desc || !parsed.why || !parsed.install) {
    throw new Error('Missing required fields in Claude response');
  }
  if (!VALID_CATS.includes(parsed.cat)) parsed.cat = 'productivity';
  return parsed;
}

function parseGithubUrl(url) {
  const m = url.match(/github\.com\/([^/\s]+)\/([^/\s?#]+)/i);
  if (!m) return null;
  return { owner: m[1], repo: m[2].replace(/\.git$/, '') };
}

function makeId(repo) {
  return 'sk-' + repo.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function extractUrls(text) {
  if (!text) return [];
  return (text.match(/https?:\/\/\S+/gi) || []).map(u => u.replace(/[).,!?]+$/, ''));
}

async function loadState() {
  try {
    return JSON.parse(await readFile(STATE_PATH, 'utf-8'));
  } catch {
    return { last_update_id: 0 };
  }
}

async function main() {
  const state = await loadState();
  const skillsData = JSON.parse(await readFile(SKILLS_PATH, 'utf-8'));
  const existingIds = new Set(skillsData.skills.map(s => s.id));

  const updates = await tg('getUpdates', {
    offset: state.last_update_id + 1,
    timeout: 0,
    allowed_updates: ['message'],
  });

  if (updates.length === 0) {
    console.log('No new updates.');
    return;
  }

  let maxUpdateId = state.last_update_id;
  let added = 0;

  for (const update of updates) {
    if (update.update_id > maxUpdateId) maxUpdateId = update.update_id;

    const msg = update.message;
    if (!msg || String(msg.chat.id) !== ALLOWED_CHAT_ID) continue;

    const githubUrls = extractUrls(msg.text).map(parseGithubUrl).filter(Boolean);

    for (const { owner, repo } of githubUrls) {
      const id = makeId(repo);
      if (existingIds.has(id)) {
        await notify(`⏭️ ${repo} כבר במאגר`);
        continue;
      }

      try {
        const readme = await fetchReadme(owner, repo);
        if (!readme) {
          await notify(`❌ ${repo}: לא נמצא README`);
          continue;
        }

        const repoUrl = `github.com/${owner}/${repo}`;
        const parsed = await askClaude(repoUrl, readme);

        skillsData.skills.push({
          id,
          name: parsed.name,
          cat: parsed.cat,
          desc: parsed.desc,
          why: parsed.why,
          source: repoUrl,
          install: parsed.install,
        });
        existingIds.add(id);
        added++;

        await notify(`✅ נוסף: ${parsed.name}\n📂 ${parsed.cat}\n${parsed.desc}`);
      } catch (e) {
        console.error(`Failed for ${owner}/${repo}:`, e);
        await notify(`❌ ${repo}: ${e.message}`);
      }
    }
  }

  state.last_update_id = maxUpdateId;
  await writeFile(STATE_PATH, JSON.stringify(state, null, 2) + '\n');

  if (added > 0) {
    skillsData.exported = new Date().toISOString();
    await writeFile(SKILLS_PATH, JSON.stringify(skillsData, null, 2) + '\n');
    console.log(`Added ${added} skill(s).`);
  }
}

main().catch(async (e) => {
  console.error(e);
  await notify(`❌ שגיאה בסבב היומי: ${e.message}`);
  process.exit(1);
});
