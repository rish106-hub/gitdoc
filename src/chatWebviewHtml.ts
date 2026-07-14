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
  .msg { margin: 0 0 12px; line-height: 1.45; white-space: pre-wrap; word-wrap: break-word; }
  .msg .who { font-weight: 600; font-size: 0.85em; opacity: 0.7; margin-bottom: 2px; }
  .msg.user .who { color: var(--vscode-textLink-foreground); }
  .card {
    border: 1px solid var(--vscode-panel-border, rgba(128,128,128,0.3));
    border-radius: 6px; padding: 8px 10px; margin: 6px 0;
    background: var(--vscode-editor-background);
  }
  .card.blocked { border-color: var(--vscode-errorForeground); }
  .card code {
    font-family: var(--vscode-editor-font-family, monospace);
    display: block; padding: 4px 0; word-break: break-all;
  }
  .card .label { font-size: 0.8em; opacity: 0.7; margin-bottom: 2px; }
  .card .out { opacity: 0.8; font-size: 0.9em; max-height: 160px; overflow: auto; }
  .card .copy { margin-top: 6px; }
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

  function addMsg(who, text, cls) {
    const div = document.createElement('div');
    div.className = 'msg ' + (cls || '');
    div.innerHTML = '<div class="who">' + esc(who) + '</div>' + esc(text);
    chat.appendChild(div); chat.scrollTop = chat.scrollHeight;
    return div;
  }

  function addCard(inner, cls) {
    const div = document.createElement('div');
    div.className = 'card ' + (cls || '');
    div.innerHTML = inner;
    chat.appendChild(div); chat.scrollTop = chat.scrollHeight;
    return div;
  }

  let thinkingEl = null;
  function setThinking(on) {
    if (on && !thinkingEl) { thinkingEl = addMsg('GitRescue', 'Thinking…', 'thinking'); }
    else if (!on && thinkingEl) { thinkingEl.remove(); thinkingEl = null; }
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
    addMsg('You', t, 'user');
    el('input').value = '';
    setThinking(true);
    vscode.postMessage({ type: 'ask', text: t });
  }

  window.addEventListener('message', (ev) => {
    const m = ev.data;
    switch (m.type) {
      case 'init': showChat(m.hasKey); break;
      case 'assistant': setThinking(false); addMsg('GitRescue', m.text); break;
      case 'ran': {
        setThinking(false);
        addCard('<div class="label">' + (m.ok ? 'ran' : 'failed') + '</div><code>' + esc(m.command) +
          '</code>' + (m.output ? '<div class="out">' + esc(m.output) + '</div>' : ''),
          m.ok ? '' : 'blocked');
        break;
      }
      case 'blocked': {
        setThinking(false);
        addCard('<div class="label err">not run — ' + esc(m.reason) + '</div><code>' + esc(m.command) +
          '</code><button class="btn secondary copy">Copy</button>', 'blocked');
        const c = chat.lastChild.querySelector('.copy');
        c.addEventListener('click', () => vscode.postMessage({ type: 'copy', text: m.command }));
        break;
      }
      case 'declined': setThinking(false); addMsg('GitRescue', 'Okay, I won\\'t run: ' + m.command); break;
      case 'error': {
        setThinking(false);
        const d = addMsg('GitRescue', m.message, 'err');
        if (m.kind === 'auth') {
          const b = document.createElement('button');
          b.className = 'btn secondary rekey'; b.textContent = 'Update API key';
          b.addEventListener('click', () => showChat(false));
          d.appendChild(document.createElement('br')); d.appendChild(b);
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
