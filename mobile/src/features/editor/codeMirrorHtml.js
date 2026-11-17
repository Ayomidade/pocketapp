export const BRIDGE_VERSION = '1.0';

export function buildCodeMirrorHtml({ isDark }) {
  const bg = isDark ? '#121D24' : '#FFFFFF';
  const fg = isDark ? '#E8EFF0' : '#192B32';
  const gutterBg = isDark ? '#10191F' : '#F3F6F5';
  const gutterFg = isDark ? '#A5B7BE' : '#526870';
  const border = isDark ? '#344750' : '#C8D5D8';
  const accent = isDark ? '#8BC7D1' : '#236C7B';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<style>
  html, body {
    margin: 0;
    padding: 0;
    height: 100%;
    background: ${bg};
    color: ${fg};
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    overflow: hidden;
  }
  #editor {
    height: 100%;
    width: 100%;
  }
  .cm-editor {
    height: 100%;
    font-size: 13.5px;
    background: ${bg};
    color: ${fg};
  }
  .cm-gutters {
    background: ${gutterBg};
    color: ${gutterFg};
    border-right: 1px solid ${border};
  }
  .cm-activeLine {
    background: ${isDark ? 'rgba(139, 199, 209, 0.08)' : 'rgba(35, 108, 123, 0.06)'};
  }
  .cm-cursor {
    border-left: 2px solid ${accent};
  }
  /* Offline fallback textarea if CDN modules are unreachable */
  #fallback {
    display: none;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    padding: 12px;
    border: none;
    outline: none;
    resize: none;
    background: ${bg};
    color: ${fg};
    font: 13.5px/1.5 ui-monospace, monospace;
  }
</style>
</head>
<body>
<div id="editor"></div>
<textarea id="fallback" spellcheck="false" autocapitalize="off" autocomplete="off"></textarea>
<script type="module">
  const VERSION = '${BRIDGE_VERSION}';
  let view = null;
  let cmUndo = null;
  let cmRedo = null;
  let currentContent = '';
  const fallbackEl = document.getElementById('fallback');

  function post(type, payload = {}) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ v: VERSION, type, payload }));
    }
  }

  function setEditorText(text) {
    currentContent = text || '';
    if (view) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: currentContent },
      });
    } else {
      fallbackEl.value = currentContent;
    }
  }

  function handleCommand(msg) {
    if (!msg || msg.v !== VERSION) return;
    const { type, payload = {} } = msg;
    switch (type) {
      case 'LOAD_FILE':
        setEditorText(payload.content || '');
        break;
      case 'UNDO':
        if (view && cmUndo) cmUndo(view);
        else { fallbackEl.focus(); document.execCommand('undo'); }
        break;
      case 'REDO':
        if (view && cmRedo) cmRedo(view);
        else { fallbackEl.focus(); document.execCommand('redo'); }
        break;
      case 'INSERT_TEXT':
        if (view) {
          const sel = view.state.selection.main;
          view.dispatch({
            changes: { from: sel.from, to: sel.to, insert: String(payload.text || '') },
            selection: { anchor: sel.from + String(payload.text || '').length },
          });
        } else {
          const start = fallbackEl.selectionStart || 0;
          fallbackEl.setRangeText(String(payload.text || ''), start, fallbackEl.selectionEnd || start, 'end');
          post('CONTENT_CHANGED', { content: fallbackEl.value });
        }
        break;
      case 'GOTO_LINE': {
        const lineNum = Math.max(1, Number(payload.line || 1));
        if (view) {
          const targetLine = Math.min(lineNum, view.state.doc.lines);
          const lineInfo = view.state.doc.line(targetLine);
          view.dispatch({ selection: { anchor: lineInfo.from }, scrollIntoView: true });
          view.focus();
        } else {
          const lines = fallbackEl.value.split('\\n');
          const offset = lines.slice(0, Math.min(lineNum - 1, lines.length - 1)).reduce((n, line) => n + line.length + 1, 0);
          fallbackEl.focus();
          fallbackEl.setSelectionRange(offset, offset);
        }
        break;
      }
      case 'FIND': {
        const query = String(payload.query || '');
        if (view && query) {
          const docText = view.state.doc.toString();
          const cur = view.state.selection.main.to;
          let idx = docText.toLowerCase().indexOf(query.toLowerCase(), cur);
          if (idx === -1) idx = docText.toLowerCase().indexOf(query.toLowerCase(), 0);
          if (idx !== -1) {
            view.dispatch({
              selection: { anchor: idx, head: idx + query.length },
              scrollIntoView: true,
            });
          }
        } else if (query) {
          const docText = fallbackEl.value;
          let idx = docText.toLowerCase().indexOf(query.toLowerCase(), fallbackEl.selectionEnd);
          if (idx === -1) idx = docText.toLowerCase().indexOf(query.toLowerCase());
          if (idx !== -1) {
            fallbackEl.focus();
            fallbackEl.setSelectionRange(idx, idx + query.length);
          }
        }
        break;
      }
      case 'DISPOSE':
        if (view) view.destroy();
        break;
      default:
        break;
    }
  }

  window.addEventListener('message', (e) => {
    try { handleCommand(JSON.parse(e.data)); } catch {}
  });
  document.addEventListener('message', (e) => {
    try { handleCommand(JSON.parse(e.data)); } catch {}
  });

  async function bootCodeMirror() {
    try {
      const [{ EditorView, basicSetup }, { EditorState }, { javascript }, { json }, { python }, { undo, redo }] =
        await Promise.all([
          import('https://esm.sh/codemirror@6.0.1'),
          import('https://esm.sh/@codemirror/state@6.5.0'),
          import('https://esm.sh/@codemirror/lang-javascript@6.2.2'),
          import('https://esm.sh/@codemirror/lang-json@6.0.1'),
          import('https://esm.sh/@codemirror/lang-python@6.1.6'),
          import('https://esm.sh/@codemirror/commands@6.7.1'),
        ]);
      cmUndo = undo;
      cmRedo = redo;

      view = new EditorView({
        state: EditorState.create({
          doc: currentContent,
          extensions: [
            basicSetup,
            javascript({ jsx: true }),
            EditorView.updateListener.of((update) => {
              if (update.docChanged) {
                const nextDoc = update.state.doc.toString();
                currentContent = nextDoc;
                post('CONTENT_CHANGED', { content: nextDoc });
              }
              if (update.selectionSet) {
                const pos = update.state.selection.main.head;
                const line = update.state.doc.lineAt(pos);
                post('CURSOR_STATE', { line: line.number, col: pos - line.from + 1 });
              }
            }),
          ],
        }),
        parent: document.getElementById('editor'),
      });
      post('READY', { engine: 'codemirror6' });
    } catch (err) {
      // Offline / sandboxed fallback preserves editing capability even without CDN
      document.getElementById('editor').style.display = 'none';
      fallbackEl.style.display = 'block';
      fallbackEl.value = currentContent;
      fallbackEl.addEventListener('input', () => {
        currentContent = fallbackEl.value;
        post('CONTENT_CHANGED', { content: currentContent });
      });
      post('READY', { engine: 'offline-fallback' });
    }
  }

  // The plain-text editor stays available offline and avoids incompatible CDN module versions.
  document.getElementById('editor').style.display = 'none';
  fallbackEl.style.display = 'block';
  fallbackEl.addEventListener('input', () => {
    currentContent = fallbackEl.value;
    post('CONTENT_CHANGED', { content: currentContent });
  });
  post('READY', { engine: 'offline-fallback' });
</script>
</body>
</html>`;
}
