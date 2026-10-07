## 2024-09-28 - Virtual Scroller Over-Rendering
**Learning:** `VirtualScroller` instances are repainting elements on *every* scroll pixel adjustment, ignoring whether new data enters the viewport. For a large array, repeatedly generating `document.createDocumentFragment()` without verifying if the displayed segment has shifted destroys the entire benefit of virtualization.
**Action:** When working with virtualization in similar un-memoized vanilla JS layers, cache start/end parameters to intercept layout loops early. The container `scrollTop` natively drives sub-item visual displacement without requiring code intervention until `startIndex` mutates.

## 2025-03-01 - [Pre-calculation for array sorting]
**Learning:** Found a specific performance bottleneck in `app.js` during category/search sorting. It called `getWatchProgressForSort` for each item dynamically in the `sort()` function, leading to O(N^2) complexity because `getWatchProgressForSort` loops over the whole dictionary (`Object.values(wp)`) for each item.
**Action:** When sorting large arrays of objects, specially those that require looking up external data structures with O(N) operations, pre-calculate that data into a `Map` *before* calling `.sort()` to bring the complexity down to O(N).


## 2024-10-07 - [Memory & GC Optimization for publishRemoteState]
**Learning:** Found a memory and GC bottleneck in `publishRemoteState` which executes every 2 seconds. The logic used multiple `.filter()` calls and spread operators (`[...a, ...b]`) on large datasets (live channels, movies, series up to 10k+ items), creating many unnecessary intermediate arrays and taxing the garbage collector. Additionally, it re-evaluated a Regex `replace` up to N times every 2s per feed.
**Action:** Replace multiple `.filter()` passes and spread operators on large arrays with single-pass `for` loops that manually accumulate into target arrays (`priority`, `others`) and early-exit when quotas are met (`others.length < 2000`). Replace frequent Regex checks in loops with highly optimized `String.prototype.startsWith()` and `.slice()`.
