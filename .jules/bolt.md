## 2024-09-28 - Virtual Scroller Over-Rendering
**Learning:** `VirtualScroller` instances are repainting elements on *every* scroll pixel adjustment, ignoring whether new data enters the viewport. For a large array, repeatedly generating `document.createDocumentFragment()` without verifying if the displayed segment has shifted destroys the entire benefit of virtualization.
**Action:** When working with virtualization in similar un-memoized vanilla JS layers, cache start/end parameters to intercept layout loops early. The container `scrollTop` natively drives sub-item visual displacement without requiring code intervention until `startIndex` mutates.

## 2025-03-01 - [Pre-calculation for array sorting]
**Learning:** Found a specific performance bottleneck in `app.js` during category/search sorting. It called `getWatchProgressForSort` for each item dynamically in the `sort()` function, leading to O(N^2) complexity because `getWatchProgressForSort` loops over the whole dictionary (`Object.values(wp)`) for each item.
**Action:** When sorting large arrays of objects, specially those that require looking up external data structures with O(N) operations, pre-calculate that data into a `Map` *before* calling `.sort()` to bring the complexity down to O(N).


## 2025-03-01 - O(N) Array Bounding in publishRemoteState
**Learning:** For frequently executed functions like `publishRemoteState` (running every 2s), using multiple `.filter()` calls and array spread operators on large data sets (e.g., `liveChannels`, `movies`, `series`) causes massive CPU overhead and garbage collection pauses. Object mappings (`.map()`) before slicing further degrade memory.
**Action:** Use single-pass loops with eager bounding checks (e.g., stopping when limits like 2000 are reached), and defer object transformations until *after* the array is bounded/sliced to prevent severe memory allocation regressions. Avoid regex for simple prefix removal.
