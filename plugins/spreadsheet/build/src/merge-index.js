const BLOCK_ROWS = 64

/**
 * Finds merged areas by cell or by window without scanning every merge. Each merge is filed under
 * the 64-row blocks it touches.
 */
export function createMergeIndex(merges) {
  const blocks = new Map()
  for (const merge of merges) {
    for (let block = Math.floor(merge.s.r / BLOCK_ROWS); block <= Math.floor(merge.e.r / BLOCK_ROWS); block++) {
      let list = blocks.get(block)
      if (!list) blocks.set(block, (list = []))
      list.push(merge)
    }
  }

  /** The merge containing the cell, or null. */
  function at(row, column) {
    const list = blocks.get(Math.floor(row / BLOCK_ROWS))
    if (!list) return null
    for (const merge of list) {
      if (row >= merge.s.r && row <= merge.e.r && column >= merge.s.c && column <= merge.e.c) return merge
    }
    return null
  }

  /** Every merge overlapping rows r0..r1 and columns c0..c1, once each. */
  function inWindow(r0, r1, c0, c1) {
    const found = new Set()
    for (let block = Math.floor(r0 / BLOCK_ROWS); block <= Math.floor(r1 / BLOCK_ROWS); block++) {
      for (const merge of blocks.get(block) ?? []) {
        if (merge.e.r >= r0 && merge.s.r <= r1 && merge.e.c >= c0 && merge.s.c <= c1) found.add(merge)
      }
    }
    return [...found]
  }

  return { at, inWindow, isEmpty: merges.length === 0 }
}

/** Grows a range until every merge it touches lies wholly inside it, as Excel's selection does. */
export function expandRangeToMerges(range, mergeIndex) {
  if (mergeIndex.isEmpty) return range
  let { r0, c0, r1, c1 } = range
  for (let changed = true; changed; ) {
    changed = false
    for (const merge of mergeIndex.inWindow(r0, r1, c0, c1)) {
      if (merge.s.r < r0) (r0 = merge.s.r), (changed = true)
      if (merge.s.c < c0) (c0 = merge.s.c), (changed = true)
      if (merge.e.r > r1) (r1 = merge.e.r), (changed = true)
      if (merge.e.c > c1) (c1 = merge.e.c), (changed = true)
    }
  }
  return { r0, c0, r1, c1 }
}
