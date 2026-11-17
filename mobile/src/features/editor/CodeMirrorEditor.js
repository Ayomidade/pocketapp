import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme } from '../../theme/ThemeProvider';
import { BRIDGE_VERSION, buildCodeMirrorHtml } from './codeMirrorHtml';

const ALLOWED_BRIDGE_TYPES = new Set(['READY', 'CONTENT_CHANGED', 'CURSOR_STATE', 'SEARCH_RESULT', 'ERROR']);

export function CodeMirrorEditor({
  filePath,
  content,
  onChangeContent,
  onCursorChange,
  onSearchResult,
  editorRef,
}) {
  const { isDark, colors, typography, radii } = useTheme();
  const webViewRef = useRef(null);
  const editorContent = useRef(null);
  const [ready, setReady] = useState(false);
  const [editorNotice, setEditorNotice] = useState('');

  const html = useMemo(() => buildCodeMirrorHtml({ isDark }), [isDark]);
  const source = useMemo(() => ({ html }), [html]);

  const sendCommand = (type, payload = {}) => {
    if (!webViewRef.current) return;
    webViewRef.current.postMessage(JSON.stringify({ v: BRIDGE_VERSION, type, payload }));
  };

  useEffect(() => {
    if (editorRef) {
      editorRef.current = {
        undo: () => sendCommand('UNDO'),
        redo: () => sendCommand('REDO'),
        find: (query) => sendCommand('FIND', { query }),
        goToLine: (line) => sendCommand('GOTO_LINE', { line }),
        insertText: (text) => sendCommand('INSERT_TEXT', { text }),
      };
    }
  }, [editorRef]);

  useEffect(() => {
    if (ready && editorContent.current !== content) {
      sendCommand('LOAD_FILE', { filePath, content });
      editorContent.current = content;
    }
  }, [ready, filePath, content]);

  const handleMessage = (event) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (!msg || msg.v !== BRIDGE_VERSION || !ALLOWED_BRIDGE_TYPES.has(msg.type)) {
        return;
      }
      if (msg.type === 'READY') {
        setReady(true);
        sendCommand('LOAD_FILE', { filePath, content });
        editorContent.current = content;
      } else if (msg.type === 'CONTENT_CHANGED') {
        editorContent.current = msg.payload?.content ?? '';
        onChangeContent?.(msg.payload?.content ?? '');
      } else if (msg.type === 'CURSOR_STATE') {
        onCursorChange?.(msg.payload);
      } else if (msg.type === 'SEARCH_RESULT') {
        onSearchResult?.(msg.payload);
      } else if (msg.type === 'ERROR') {
        setEditorNotice(msg.payload?.message || 'Editor unavailable.');
      }
    } catch {
      // Ignore malformed bridge payloads
    }
  };

  const quickKeys = ['  ', '{', '}', '(', ')', '=>', ';', '"'];

  return (
    <View style={styles.wrapper}>
      {editorNotice ? <Text accessibilityLiveRegion="polite" style={[typography.caption, { color: colors.warning }]}>{editorNotice}</Text> : null}
      <View
        style={[
          styles.editorBox,
          { borderColor: colors.border, borderRadius: radii.card, backgroundColor: colors.codeSurface },
        ]}
      >
        <WebView
          ref={webViewRef}
          originWhitelist={['about:blank', 'data:*']}
          source={source}
          onLoadStart={() => { setReady(false); editorContent.current = null; }}
          onMessage={handleMessage}
          javaScriptEnabled
          domStorageEnabled={false}
          allowFileAccess={false}
          style={styles.webview}
        />
      </View>

      {/* Mobile Developer Keyboard Accessory Bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.accessoryBar, { backgroundColor: colors.surface, borderColor: colors.border }]}
        contentContainerStyle={styles.accessoryContent}
      >
        <Pressable
          onPress={() => sendCommand('UNDO')}
          accessibilityLabel="Undo"
          style={[styles.keyBtn, { backgroundColor: colors.bannerMuted }]}
        >
          <Text style={[typography.caption, { color: colors.textPrimary }]}>Undo</Text>
        </Pressable>
        <Pressable
          onPress={() => sendCommand('REDO')}
          accessibilityLabel="Redo"
          style={[styles.keyBtn, { backgroundColor: colors.bannerMuted }]}
        >
          <Text style={[typography.caption, { color: colors.textPrimary }]}>Redo</Text>
        </Pressable>
        {quickKeys.map((k) => (
          <Pressable
            key={k}
            onPress={() => sendCommand('INSERT_TEXT', { text: k })}
            accessibilityLabel={`Insert ${k === '  ' ? 'Tab' : k}`}
            style={[styles.keyBtn, { backgroundColor: colors.bannerMuted }]}
          >
            <Text style={[typography.mono, { color: colors.textPrimary }]}>
              {k === '  ' ? 'Tab' : k}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  editorBox: {
    flex: 1,
    minHeight: 340,
    borderWidth: 1,
    overflow: 'hidden',
  },
  webview: { flex: 1, backgroundColor: 'transparent' },
  accessoryBar: {
    maxHeight: 52,
    borderTopWidth: 1,
    marginTop: 8,
    borderRadius: 10,
  },
  accessoryContent: {
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 6,
  },
  keyBtn: {
    minWidth: 44,
    minHeight: 38,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
