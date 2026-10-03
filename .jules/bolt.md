
## 2025-03-01 - [Pre-calculation for array sorting]
**Learning:** Found a specific performance bottleneck in `app.js` during category/search sorting. It called `getWatchProgressForSort` for each item dynamically in the `sort()` function, leading to O(N^2) complexity because `getWatchProgressForSort` loops over the whole dictionary (`Object.values(wp)`) for each item.
**Action:** When sorting large arrays of objects, specially those that require looking up external data structures with O(N) operations, pre-calculate that data into a `Map` *before* calling `.sort()` to bring the complexity down to O(N).
## 2025-03-01 - [Avoid multiple filters on large arrays]
**Learning:** Found a performance bottleneck in `publishRemoteState` which runs every 2s on large arrays. The original method used multiple `.filter` passes and array spreading which creates a lot of memory garbage.
**Action:** Replace multiple `.filter` and spread on large arrays with a single loop that stops early to save CPU and GC overhead.
