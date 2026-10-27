/** Positions along one grid axis: `start(i)` is where row or column i begins, in pixels. */
export function createAxis(sizes) {
  const count = sizes.length
  const starts = new Float64Array(count + 1)
  for (let index = 0; index < count; index++) starts[index + 1] = starts[index] + sizes[index]
  return {
    count,
    total: starts[count],
    start: (index) => starts[index],
    size: (index) => sizes[index],
    end: (index) => starts[index + 1],
    isHidden: (index) => sizes[index] === 0,
    /** The index under a pixel position, clamped to the axis. */
    indexAt(position) {
      if (count === 0) return -1
      if (position <= 0) return 0
      if (position >= starts[count]) return count - 1
      let low = 0
      let high = count - 1
      while (low < high) {
        const mid = (low + high + 1) >> 1
        if (starts[mid] <= position) low = mid
        else high = mid - 1
      }
      return low
    }
  }
}
