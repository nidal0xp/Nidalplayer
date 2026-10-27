## 2024-09-28 - Virtual Scroller Over-Rendering
**Learning:** `VirtualScroller` instances are repainting elements on *every* scroll pixel adjustment, ignoring whether new data enters the viewport. For a large array, repeatedly generating `document.createDocumentFragment()` without verifying if the displayed segment has shifted destroys the entire benefit of virtualization.
**Action:** When working with virtualization in similar un-memoized vanilla JS layers, cache start/end parameters to intercept layout loops early. The container `scrollTop` natively drives sub-item visual displacement without requiring code intervention until `startIndex` mutates.

## 2025-03-01 - [Pre-calculation for array sorting]
**Learning:** Found a specific performance bottleneck in `app.js` during category/search sorting. It called `getWatchProgressForSort` for each item dynamically in the `sort()` function, leading to O(N^2) complexity because `getWatchProgressForSort` loops over the whole dictionary (`Object.values(wp)`) for each item.
**Action:** When sorting large arrays of objects, specially those that require looking up external data structures with O(N) operations, pre-calculate that data into a `Map` *before* calling `.sort()` to bring the complexity down to O(N).


## 2024-05-18 - Single-Pass Bounding for Frequent O(N) Processing
**Learning:** In frequently executing functions (like `publishRemoteState` running every 2s), processing large arrays using consecutive `.filter()` calls and spreading them (`[...a, ...b]`) creates massive intermediate memory allocations and stalls the main thread. Regex evaluations per item multiply this cost.
**Action:** When filtering and bounding large data sets, use a single-pass loop with greedy bounding checks (stopping at limits) and native string methods instead of regex. Critically, defer mapping operations until after slicing the array to limit the number of processed objects.
