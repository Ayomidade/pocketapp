import { computeLineDiff, summarizeDiff } from '../src/features/editor/diffUtils';
import { signalLight, signalDark, relayBrand } from '../src/theme/tokens';

describe('PocketOps Mobile Core Utilities', () => {
  test('computes accurate LCS line diff and additions/deletions summary', () => {
    const original = 'const port = 3000;\napp.listen(port);';
    const modified = 'const port = process.env.PORT || 3000;\napp.listen(port);\nconsole.log("ready");';
    const diff = computeLineDiff(original, modified);
    const stats = summarizeDiff(diff);

    expect(stats.additions).toBe(2);
    expect(stats.deletions).toBe(1);
    expect(diff.some((d) => d.type === 'removed' && d.text.includes('3000'))).toBe(true);
    expect(diff.some((d) => d.type === 'added' && d.text.includes('ready'))).toBe(true);
  });

  test('preserves Signalframe Light/Dark tokens separate from Relay brand colors', () => {
    expect(signalLight.primary).toBe('#236C7B');
    expect(signalDark.primary).toBe('#8BC7D1');
    expect(signalLight.critical).toBe('#A52F2A');
    expect(relayBrand.coralRelay).toBe('#FF7A59');
    expect(signalLight.primary).not.toBe(relayBrand.coralRelay);
  });
});
