import editorBundle from './editorBundle';

export const BRIDGE_VERSION = '1.0';

export function buildCodeMirrorHtml({ isDark }) {
  const bg = isDark ? '#121D24' : '#FFFFFF';
  const fg = isDark ? '#E8EFF0' : '#192B32';
  const border = isDark ? '#344750' : '#C8D5D8';
  const script = editorBundle.replace(/<\/script/gi, '<\\/script');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
html,body,#editor { margin:0; width:100%; height:100%; background:${bg}; color:${fg}; overflow:hidden; }
.cm-editor { height:100%; background:${bg}; color:${fg}; font: 13.5px/1.5 monospace; }
.cm-scroller { overflow:auto; font-family:monospace; }
.cm-gutters { background:${bg}; color:${isDark ? '#A5B7BE' : '#526870'}; border-right:1px solid ${border}; }
.cm-activeLine, .cm-activeLineGutter { background:${isDark ? '#21313A' : '#E8EFF0'}; }
.cm-cursor { border-left-color:${isDark ? '#8BC7D1' : '#236C7B'} !important; }
#fallback { display:none; width:100%; height:100%; box-sizing:border-box; padding:12px; background:${bg}; color:${fg}; font:13.5px/1.5 monospace; border:0; resize:none; }
</style></head><body><div id="editor"></div><textarea id="fallback" spellcheck="false" autocapitalize="off"></textarea><script>${script}</script></body></html>`;
}
