// Crash reporter — submits to GitHub Issues + writes local log
// Requires a fine-grained GitHub PAT with issues:write on The-SMC-Trading-App
// Generate one at: https://github.com/settings/tokens?type=beta
// Then replace the string below with your token.

import fs   from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

const GITHUB_TOKEN = 'REPLACE_WITH_YOUR_FINE_GRAINED_PAT';
const GITHUB_OWNER = 'theeoneyedwonder';
const GITHUB_REPO  = 'The-SMC-Trading-App';

function logDir() {
  try {
    const dir = path.join(app.getPath('userData'), 'crash-reports');
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  } catch { return '.'; }
}

function writeLocalLog(data) {
  try {
    const ts   = new Date().toISOString().replace(/[:.]/g, '-');
    const file = path.join(logDir(), `crash-${ts}.json`);
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
    return file;
  } catch { return null; }
}

async function submitToGitHub(title, body) {
  if (!GITHUB_TOKEN || GITHUB_TOKEN.startsWith('REPLACE')) {
    return { ok: false, reason: 'GitHub token not configured' };
  }
  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues`,
      {
        method: 'POST',
        headers: {
          Authorization:          `Bearer ${GITHUB_TOKEN}`,
          Accept:                 'application/vnd.github+json',
          'Content-Type':         'application/json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent':           'SMC-Trading-App-Crash-Reporter/1.0',
        },
        body: JSON.stringify({ title, body, labels: ['crash-report'] }),
      }
    );
    const data = await res.json();
    return res.ok
      ? { ok: true, url: data.html_url }
      : { ok: false, reason: data.message ?? 'GitHub API error' };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

export async function reportCrash({ name, message, stack, version, platform, description }) {
  const ts    = new Date().toISOString();
  const title = `[Crash] ${name ?? 'Error'}: ${(message ?? 'Unknown error').slice(0, 80)}`;
  const body  = [
    `## Crash Report`,
    `**App version:** ${version}`,
    `**Platform:** ${platform}`,
    `**Time:** ${ts}`,
    ``,
    `### Error`,
    '```',
    stack ?? message ?? 'No stack trace available',
    '```',
    ``,
    `### What the user was doing`,
    description || '_No description provided_',
  ].join('\n');

  const logFile = writeLocalLog({ ts, version, platform, error: { name, message, stack }, description });
  const github  = await submitToGitHub(title, body);

  return { logFile, github };
}
