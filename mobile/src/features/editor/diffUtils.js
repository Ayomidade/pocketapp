// Line-by-line LCS diff generator for mobile Diff Review (ED-06) & Conflict Reconciliation (ED-07)

export function computeLineDiff(originalText = '', modifiedText = '') {
  const a = String(originalText).split('\n');
  const b = String(modifiedText).split('\n');
  const m = a.length;
  const n = b.length;

  // Guard against huge files in mobile memory
  if (m * n > 250000) {
    return [
      { type: 'context', oldLine: 1, newLine: 1, text: `Diff preview truncated (${m} -> ${n} lines)` },
    ];
  }

  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i -= 1) {
    for (let j = n - 1; j >= 0; j -= 1) {
      dp[i][j] = a[i] === b[j] ? 1 + dp[i + 1][j + 1] : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const result = [];
  let i = 0;
  let j = 0;
  let oldNum = 1;
  let newNum = 1;

  while (i < m && j < n) {
    if (a[i] === b[j]) {
      result.push({ type: 'context', oldLine: oldNum++, newLine: newNum++, text: a[i] });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      result.push({ type: 'removed', oldLine: oldNum++, newLine: null, text: a[i] });
      i += 1;
    } else {
      result.push({ type: 'added', oldLine: null, newLine: newNum++, text: b[j] });
      j += 1;
    }
  }

  while (i < m) {
    result.push({ type: 'removed', oldLine: oldNum++, newLine: null, text: a[i++] });
  }
  while (j < n) {
    result.push({ type: 'added', oldLine: null, newLine: newNum++, text: b[j++] });
  }

  return result;
}

export function summarizeDiff(diffLines) {
  let additions = 0;
  let deletions = 0;
  for (const line of diffLines) {
    if (line.type === 'added') additions += 1;
    if (line.type === 'removed') deletions += 1;
  }
  return { additions, deletions };
}
