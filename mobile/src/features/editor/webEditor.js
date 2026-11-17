/* global window, document */
import { basicSetup } from 'codemirror';
import { EditorState, Compartment } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { undo, redo } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { python } from '@codemirror/lang-python';
import { markdown } from '@codemirror/lang-markdown';

const VERSION = '1.0';
const language = new Compartment();
let view;
function post(type, payload = {}) {
  window.ReactNativeWebView?.postMessage(JSON.stringify({ v: VERSION, type, payload }));
}
function languageFor(path = '') {
  if (/\.(js|jsx|mjs|cjs|ts|tsx)$/i.test(path)) return javascript({ jsx: /\.[jt]sx$/i.test(path), typescript: /\.tsx?$/i.test(path) });
  if (/\.json$/i.test(path)) return json();
  if (/\.py$/i.test(path)) return python();
  if (/\.md$/i.test(path)) return markdown();
  return [];
}
function findMatch(text, query, position) {
  const source = text.toLowerCase();
  const needle = String(query || '').toLowerCase();
  if (!needle) return { index: -1, current: 0, total: 0 };
  const positions = [];
  for (let at = source.indexOf(needle); at !== -1; at = source.indexOf(needle, at + needle.length)) positions.push(at);
  const current = positions.findIndex((at) => at >= position);
  const selected = current === -1 ? 0 : current;
  return { index: positions.length ? positions[selected] : -1, current: positions.length ? selected + 1 : 0, total: positions.length };
}
function handle(msg) {
  if (!view || msg?.v !== VERSION) return;
  const p = msg.payload || {};
  switch (msg.type) {
    case 'LOAD_FILE':
      view.setState(createState(String(p.content || ''), p.filePath));
      post('CURSOR_STATE', { line: 1, col: 1 });
      break;
    case 'UNDO': undo(view); break;
    case 'REDO': redo(view); break;
    case 'INSERT_TEXT': {
      const selection = view.state.selection.main;
      const text = String(p.text || '');
      view.dispatch({ changes: { from: selection.from, to: selection.to, insert: text }, selection: { anchor: selection.from + text.length }, scrollIntoView: true });
      view.focus();
      break;
    }
    case 'GOTO_LINE': {
      const line = view.state.doc.line(Math.min(Math.max(1, Number(p.line) || 1), view.state.doc.lines));
      view.dispatch({ selection: { anchor: line.from }, scrollIntoView: true });
      view.focus();
      break;
    }
    case 'FIND': {
      const query = String(p.query || '');
      const result = findMatch(view.state.doc.toString(), query, view.state.selection.main.to);
      if (result.index >= 0) view.dispatch({ selection: { anchor: result.index, head: result.index + query.length }, scrollIntoView: true });
      post('SEARCH_RESULT', { current: result.current, total: result.total });
      view.focus();
      break;
    }
    default: break;
  }
}
function receive(event) { try { handle(JSON.parse(event.data)); } catch { /* Ignore malformed messages. */ } }
window.addEventListener('message', receive);
document.addEventListener('message', receive);
function createState(content, filePath) {
  return EditorState.create({ doc: content, extensions: [basicSetup, language.of(languageFor(filePath)), EditorView.lineWrapping, EditorView.updateListener.of((update) => {
    if (update.docChanged) post('CONTENT_CHANGED', { content: update.state.doc.toString() });
    if (update.selectionSet || update.docChanged) {
      const position = update.state.selection.main.head;
      const line = update.state.doc.lineAt(position);
      post('CURSOR_STATE', { line: line.number, col: position - line.from + 1 });
    }
  })] });
}
try {
  view = new EditorView({
    state: createState('', ''),
    parent: document.getElementById('editor'),
  });
  post('READY', { engine: 'codemirror6' });
} catch {
  document.getElementById('editor').style.display = 'none';
  const fallback = document.getElementById('fallback');
  fallback.style.display = 'block';
  fallback.addEventListener('input', () => post('CONTENT_CHANGED', { content: fallback.value }));
  function receiveFallback(event) {
    try {
      const msg = JSON.parse(event.data);
      if (msg.v !== VERSION) return;
      const payload = msg.payload || {};
      if (msg.type === 'LOAD_FILE') fallback.value = payload.content || '';
      if (msg.type === 'INSERT_TEXT') {
        fallback.setRangeText(String(payload.text || ''), fallback.selectionStart, fallback.selectionEnd, 'end');
        post('CONTENT_CHANGED', { content: fallback.value });
      }
      if (msg.type === 'UNDO' || msg.type === 'REDO') {
        fallback.focus();
        document.execCommand(msg.type.toLowerCase());
      }
      if (msg.type === 'FIND' && payload.query) {
        const query = String(payload.query);
        const result = findMatch(fallback.value, query, fallback.selectionEnd);
        if (result.index >= 0) { fallback.focus(); fallback.setSelectionRange(result.index, result.index + query.length); }
        post('SEARCH_RESULT', { current: result.current, total: result.total });
      }
      if (msg.type === 'GOTO_LINE') {
        const lines = fallback.value.split('\n');
        const count = Math.min(Math.max(1, Number(payload.line) || 1), lines.length) - 1;
        const offset = lines.slice(0, count).reduce((n, line) => n + line.length + 1, 0);
        fallback.focus(); fallback.setSelectionRange(offset, offset);
      }
    } catch { /* Ignore malformed messages. */ }
  }
  window.addEventListener('message', receiveFallback);
  document.addEventListener('message', receiveFallback);
  post('READY', { engine: 'fallback' });
  post('ERROR', { message: 'Syntax highlighting is unavailable; plain-text editing is active.' });
}
