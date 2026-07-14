// Inline HTML for the chat webview. No asset pipeline (matches the repo's
// minimal-tooling style) — the whole UI is one string with a CSP nonce.
// Theme-aware via VS Code's webview CSS variables.

export function chatHtml(nonce: string, cspSource: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; img-src ${cspSource} data:;">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style nonce="${nonce}">
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 0;
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    color: var(--vscode-foreground);
    background: var(--vscode-sideBar-background);
    display: flex; flex-direction: column; height: 100vh;
  }
  .brand {
    display: flex; align-items: center; gap: 8px;
    padding: 12px 14px; border-bottom: 1px solid var(--vscode-panel-border, rgba(128,128,128,0.25));
  }
  .brand svg { width: 26px; height: 26px; flex: none; }
  .brand .name { font-weight: 700; font-size: 1.05em; }
  .brand .name .accent { color: #F05033; }
  .brand .tag {
    margin-left: auto; font-size: 0.7em; letter-spacing: 0.05em; text-transform: uppercase;
    color: #F05033; border: 1px solid #F05033; border-radius: 4px; padding: 1px 6px; opacity: 0.9;
  }
  #onboarding { padding: 16px; display: none; }
  #onboarding.show { display: block; }
  #onboarding h3 { margin: 0 0 6px; }
  #onboarding p { margin: 0 0 12px; opacity: 0.85; line-height: 1.4; }
  .btn {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;
    font-size: var(--vscode-font-size);
  }
  .btn:hover { background: var(--vscode-button-hoverBackground); }
  .btn.secondary {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
  }
  input[type=password], input[type=text] {
    width: 100%; padding: 6px 8px; margin: 8px 0;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, transparent);
    border-radius: 4px;
  }
  #chat { flex: 1; overflow-y: auto; padding: 12px; display: none; }
  #chat.show { display: block; }
  .turn { margin: 0 0 18px; }
  .turn .who { font-weight: 600; font-size: 0.8em; opacity: 0.6; margin-bottom: 3px; }
  .turn.user { opacity: 0.9; }
  .turn.user .body { color: var(--vscode-textLink-foreground); }
  .answer { line-height: 1.5; margin-bottom: 8px; white-space: pre-wrap; word-wrap: break-word; }
  /* Commands card */
  .cmds {
    border: 1px solid var(--vscode-panel-border, rgba(128,128,128,0.3));
    border-radius: 8px; overflow: hidden; margin: 8px 0;
  }
  .cmd { padding: 8px 10px; border-top: 1px solid var(--vscode-panel-border, rgba(128,128,128,0.18)); }
  .cmd:first-child { border-top: none; }
  .cmd .top { display: flex; align-items: center; gap: 8px; }
  .cmd code {
    flex: 1; font-family: var(--vscode-editor-font-family, monospace); font-size: 0.92em;
    word-break: break-all; color: var(--vscode-textPreformat-foreground, inherit);
  }
  .cmd .why { font-size: 0.85em; opacity: 0.7; margin-top: 3px; }
  .cmd .run { flex: none; padding: 3px 12px; font-size: 0.85em; }
  .cmd .out {
    margin-top: 6px; padding: 6px 8px; border-radius: 4px; font-size: 0.85em;
    font-family: var(--vscode-editor-font-family, monospace); white-space: pre-wrap;
    max-height: 180px; overflow: auto; background: var(--vscode-textCodeBlock-background, rgba(128,128,128,0.12));
  }
  .cmd .out.fail { color: var(--vscode-errorForeground); }
  /* Terms */
  .terms { margin-top: 10px; padding: 8px 10px; border-radius: 8px;
    background: rgba(240,80,51,0.08); border: 1px solid rgba(240,80,51,0.25); }
  .terms .head { font-weight: 600; font-size: 0.85em; margin-bottom: 4px; }
  .terms .term { font-size: 0.88em; margin: 2px 0; }
  .terms .term b { color: #F05033; }
  .thinking { opacity: 0.6; font-style: italic; }
  .err { color: var(--vscode-errorForeground); }
  #composer {
    display: none; padding: 8px; gap: 6px;
    border-top: 1px solid var(--vscode-panel-border, rgba(128,128,128,0.3));
  }
  #composer.show { display: flex; }
  #composer textarea {
    flex: 1; resize: none; padding: 6px 8px; min-height: 34px; max-height: 120px;
    background: var(--vscode-input-background); color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, transparent); border-radius: 4px;
    font-family: var(--vscode-font-family); font-size: var(--vscode-font-size);
  }
  .thinking { opacity: 0.6; font-style: italic; }
  .rekey { margin-top: 6px; }
</style>
</head>
<body>
  <div class="brand">
    <svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg" aria-label="GitRescue">
      <rect width="128" height="128" rx="28" fill="#F05033"/>
      <path d="M64 23L96 37V65C96 84.5 83.5 98.5 64 110C44.5 98.5 32 84.5 32 65V37L64 23Z" fill="#FFFFFF"/>
      <path d="M52 45V83M52 64L78 50" stroke="#F05033" stroke-width="9.5" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="52" cy="45" r="7.5" fill="#F05033"/>
      <circle cx="52" cy="83" r="7.5" fill="#F05033"/>
      <circle cx="78" cy="50" r="7.5" fill="#F05033"/>
    </svg>
    <span class="name">Git<span class="accent">Rescue</span></span>
    <span class="tag">Ask AI</span>
  </div>

  <div id="onboarding">
    <h3>Ask GitRescue AI</h3>
    <p>Powered by Groq. Grab a <strong>free</strong> API key (no credit card), paste it below, and start asking.</p>
    <button class="btn" id="getKey">Get a free key →</button>
    <input type="password" id="keyInput" placeholder="Paste your Groq API key (gsk_…)" autocomplete="off" />
    <button class="btn" id="saveKey">Save &amp; start</button>
    <div id="onbErr" class="err"></div>
  </div>

  <div id="chat"></div>

  <div id="composer">
    <textarea id="input" placeholder="Ask about git… (Enter to send)"></textarea>
    <button class="btn" id="send">Send</button>
  </div>

<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  const el = (id) => document.getElementById(id);
  const chat = el('chat'), composer = el('composer'), onboarding = el('onboarding');

  function showChat(hasKey) {
    onboarding.classList.toggle('show', !hasKey);
    chat.classList.toggle('show', hasKey);
    composer.classList.toggle('show', hasKey);
  }

  function esc(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }

  let rowSeq = 0;
  const rows = {}; // rowId -> { command } for Copy fallback

  function addTurn(who, cls) {
    const div = document.createElement('div');
    div.className = 'turn ' + (cls || '');
    div.innerHTML = '<div class="who">' + esc(who) + '</div><div class="body"></div>';
    chat.appendChild(div); chat.scrollTop = chat.scrollHeight;
    return div.querySelector('.body');
  }

  // Render one structured answer: plain text -> command rows (with Run) -> terms.
  function renderAnswer(ans) {
    const body = addTurn('GitRescue');
    if (ans.answer) {
      const p = document.createElement('div');
      p.className = 'answer'; p.textContent = ans.answer;
      body.appendChild(p);
    }
    if (ans.commands && ans.commands.length) {
      const card = document.createElement('div'); card.className = 'cmds';
      ans.commands.forEach((c) => card.appendChild(renderCmd(c)));
      body.appendChild(card);
    }
    if (ans.terms && ans.terms.length) {
      const t = document.createElement('div'); t.className = 'terms';
      let html = '<div class="head">💡 Term to know</div>';
      ans.terms.forEach((x) => { html += '<div class="term"><b>' + esc(x.term) + '</b> — ' + esc(x.definition) + '</div>'; });
      t.innerHTML = html; body.appendChild(t);
    }
    chat.scrollTop = chat.scrollHeight;
  }

  function renderCmd(c) {
    const rowId = 'r' + (++rowSeq);
    const full = 'git ' + c.command;
    rows[rowId] = { command: c.command };
    const row = document.createElement('div'); row.className = 'cmd'; row.dataset.rowId = rowId;
    const blocked = c.klass === 'blocked';
    row.innerHTML =
      '<div class="top"><code>' + esc(full) + '</code>' +
      '<button class="btn ' + (blocked ? 'secondary' : '') + ' run">' + (blocked ? 'Copy' : 'Run') + '</button></div>' +
      (c.explanation ? '<div class="why">' + esc(c.explanation) + '</div>' : '');
    const btn = row.querySelector('.run');
    btn.addEventListener('click', () => {
      if (blocked) { vscode.postMessage({ type: 'copy', text: full }); btn.textContent = 'Copied'; return; }
      btn.disabled = true; btn.textContent = 'Running…';
      vscode.postMessage({ type: 'run', command: c.command, explanation: c.explanation || '', rowId });
    });
    return row;
  }

  function showRunResult(m) {
    const row = chat.querySelector('.cmd[data-row-id="' + m.rowId + '"]');
    if (!row) return;
    const btn = row.querySelector('.run');
    if (btn) { btn.disabled = false; btn.textContent = 'Run again'; }
    let out = row.querySelector('.out');
    if (!out) { out = document.createElement('div'); out.className = 'out'; row.appendChild(out); }
    out.classList.toggle('fail', !m.ok);
    out.textContent = m.output || (m.ok ? '(done)' : 'failed');
    chat.scrollTop = chat.scrollHeight;
  }

  let thinkingEl = null;
  function setThinking(on) {
    if (on && !thinkingEl) { thinkingEl = addTurn('GitRescue'); thinkingEl.innerHTML = '<span class="thinking">Thinking…</span>'; }
    else if (!on && thinkingEl) { thinkingEl.parentElement.remove(); thinkingEl = null; }
  }

  el('getKey').addEventListener('click', () => vscode.postMessage({ type: 'openKeyPage' }));
  el('saveKey').addEventListener('click', () => {
    const v = el('keyInput').value.trim();
    if (!v) { el('onbErr').textContent = 'Paste a key first.'; return; }
    vscode.postMessage({ type: 'saveKey', key: v });
  });
  el('send').addEventListener('click', send);
  el('input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });
  function send() {
    const t = el('input').value.trim();
    if (!t) return;
    const b = addTurn('You', 'user'); b.textContent = t;
    el('input').value = '';
    setThinking(true);
    vscode.postMessage({ type: 'ask', text: t });
  }

  window.addEventListener('message', (ev) => {
    const m = ev.data;
    switch (m.type) {
      case 'init': showChat(m.hasKey); break;
      case 'answer': setThinking(false); renderAnswer(m.answer); break;
      case 'runResult': showRunResult(m); break;
      case 'error': {
        setThinking(false);
        const body = addTurn('GitRescue');
        const p = document.createElement('div'); p.className = 'answer err'; p.textContent = m.message;
        body.appendChild(p);
        if (m.kind === 'auth') {
          const btn = document.createElement('button');
          btn.className = 'btn secondary'; btn.textContent = 'Update API key';
          btn.addEventListener('click', () => showChat(false));
          body.appendChild(btn);
        }
        break;
      }
      case 'keySaved': el('keyInput').value = ''; el('onbErr').textContent = ''; showChat(true); break;
    }
  });

  vscode.postMessage({ type: 'ready' });
</script>
</body>
</html>`
}
