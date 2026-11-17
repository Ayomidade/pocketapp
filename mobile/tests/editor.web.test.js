/** @jest-environment node */
import { JSDOM, VirtualConsole } from 'jsdom';
import { buildCodeMirrorHtml } from '../src/features/editor/codeMirrorHtml';

test('the bundled editor loads and edits a file without a network connection', () => {
  const messages = [];
  const dom = new JSDOM(buildCodeMirrorHtml({ isDark: true }), {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: new VirtualConsole(),
    beforeParse(window) {
      window.ReactNativeWebView = { postMessage: (value) => messages.push(JSON.parse(value)) };
      window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
    },
  });
  const { window } = dom;
  const send = (type, payload = {}) => window.dispatchEvent(new window.MessageEvent('message', {
    data: JSON.stringify({ v: '1.0', type, payload }),
  }));
  expect(messages).toContainEqual(expect.objectContaining({ type: 'READY', payload: { engine: 'codemirror6' } }));
  send('LOAD_FILE', { filePath: 'example.js', content: 'const value = 1;' });
  expect(window.document.querySelector('.cm-content').textContent).toContain('const value = 1;');
  send('FIND', { query: 'value' });
  expect(messages).toContainEqual(expect.objectContaining({ type: 'SEARCH_RESULT', payload: { current: 1, total: 1 } }));
  send('FIND', { query: 'missing' });
  expect(messages).toContainEqual(expect.objectContaining({ type: 'SEARCH_RESULT', payload: { current: 0, total: 0 } }));
  send('LOAD_FILE', { filePath: 'example.js', content: 'value value' });
  send('FIND', { query: 'value' });
  send('FIND', { query: 'value' });
  expect(messages).toContainEqual(expect.objectContaining({ type: 'SEARCH_RESULT', payload: { current: 2, total: 2 } }));
  send('LOAD_FILE', { filePath: 'example.js', content: 'const value = 1;' });
  send('INSERT_TEXT', { text: 'X' });
  expect(messages).toContainEqual(expect.objectContaining({ type: 'CONTENT_CHANGED', payload: { content: 'Xconst value = 1;' } }));
  send('UNDO');
  expect(messages).toContainEqual(expect.objectContaining({ type: 'CONTENT_CHANGED', payload: { content: 'const value = 1;' } }));
  send('INSERT_TEXT', { text: 'Y' });
  send('LOAD_FILE', { filePath: 'other.py', content: 'print(1)' });
  send('UNDO');
  expect(window.document.querySelector('.cm-content').textContent).toContain('print(1)');
  dom.window.close();
});
