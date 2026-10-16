## 2024-09-28 - Virtual Scroller Over-Rendering
**Learning:** `VirtualScroller` instances are repainting elements on *every* scroll pixel adjustment, ignoring whether new data enters the viewport. For a large array, repeatedly generating `document.createDocumentFragment()` without verifying if the displayed segment has shifted destroys the entire benefit of virtualization.
**Action:** When working with virtualization in similar un-memoized vanilla JS layers, cache start/end parameters to intercept layout loops early. The container `scrollTop` natively drives sub-item visual displacement without requiring code intervention until `startIndex` mutates.

## 2025-03-01 - [Pre-calculation for array sorting]
**Learning:** Found a specific performance bottleneck in `app.js` during category/search sorting. It called `getWatchProgressForSort` for each item dynamically in the `sort()` function, leading to O(N^2) complexity because `getWatchProgressForSort` loops over the whole dictionary (`Object.values(wp)`) for each item.
**Action:** When sorting large arrays of objects, specially those that require looking up external data structures with O(N) operations, pre-calculate that data into a `Map` *before* calling `.sort()` to bring the complexity down to O(N).


## 2025-03-05 - [Optimize tight intervals causing GC overhead]
**Learning:** Found a performance bottleneck in `publishRemoteState` which runs on a tight `setInterval` (2s). Iterating over large arrays using double `.filter()` passes and spreading them `[...prioritized, ...others]` caused O(2N) execution and significant memory allocation, putting pressure on the Garbage Collector. Also, running regex like `.replace(/^(?:series|movie|live)-/, '')` within these tight loops adds processing overhead.
**Action:** When filtering or transforming large datasets on tight intervals, replace chaining functional array operations (`.filter`, spreads) with single-pass `for...of` loops and pre-allocation patterns. Use eager bounding checks to stop adding elements when a limit (like 2000) is reached. Replace repeated Regex evaluations with native string operations (`startsWith` or `slice`/`indexOf`).
