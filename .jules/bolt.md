
## 2025-03-01 - [Pre-calculation for array sorting]
**Learning:** Found a specific performance bottleneck in `app.js` during category/search sorting. It called `getWatchProgressForSort` for each item dynamically in the `sort()` function, leading to O(N^2) complexity because `getWatchProgressForSort` loops over the whole dictionary (`Object.values(wp)`) for each item.
**Action:** When sorting large arrays of objects, specially those that require looking up external data structures with O(N) operations, pre-calculate that data into a `Map` *before* calling `.sort()` to bring the complexity down to O(N).

## 2024-05-18 - Repeated Object.values() O(N) Array Loops
**Learning:** `getWatchProgressForSort` iterates over `Object.values(state.watchProgress)` which executes in O(N). If this function is called inside an array `.filter()` or `.sort()` loop over thousands of items (like in `filterAndRenderItems` or `renderCategoryPills`), it drastically compounds into an O(N*M) time complexity resulting in heavy blocking / UI freezing.
**Action:** When filtering or sorting large lists that require deep-scanning configuration objects, always pre-calculate a lookup `Map` before the array loop starts so lookups execute in O(1) reducing complexity to O(N+M).
