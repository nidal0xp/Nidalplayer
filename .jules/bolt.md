
## 2025-03-01 - [Pre-calculation for array sorting]
**Learning:** Found a specific performance bottleneck in `app.js` during category/search sorting. It called `getWatchProgressForSort` for each item dynamically in the `sort()` function, leading to O(N^2) complexity because `getWatchProgressForSort` loops over the whole dictionary (`Object.values(wp)`) for each item.
**Action:** When sorting large arrays of objects, specially those that require looking up external data structures with O(N) operations, pre-calculate that data into a `Map` *before* calling `.sort()` to bring the complexity down to O(N).

## 2025-03-01 - [Avoid repetitive O(N) object lookups in loops]
**Learning:** `getWatchProgressForSort` had an O(N) iteration over `Object.values(state.watchProgress)` which was being called in a loop for EVERY library item during UI rendering (in `renderCategoryPills` for category counts and `filterAndRenderItems` for sorting). This led to severe UI freezes on large VOD libraries because the complexity was O(N*M) where N is library size and M is watch progress entries.
**Action:** Always pre-calculate maps/indexes before iterating over large collections. By extracting the series progress logic into a single O(M) `buildSeriesProgressMap` run before the O(N) main loop, the total complexity became O(N+M), restoring UI responsiveness.
