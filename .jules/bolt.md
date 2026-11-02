## 2024-09-28 - Virtual Scroller Over-Rendering
**Learning:** `VirtualScroller` instances are repainting elements on *every* scroll pixel adjustment, ignoring whether new data enters the viewport. For a large array, repeatedly generating `document.createDocumentFragment()` without verifying if the displayed segment has shifted destroys the entire benefit of virtualization.
**Action:** When working with virtualization in similar un-memoized vanilla JS layers, cache start/end parameters to intercept layout loops early. The container `scrollTop` natively drives sub-item visual displacement without requiring code intervention until `startIndex` mutates.

## 2025-03-01 - [Pre-calculation for array sorting]
**Learning:** Found a specific performance bottleneck in `app.js` during category/search sorting. It called `getWatchProgressForSort` for each item dynamically in the `sort()` function, leading to O(N^2) complexity because `getWatchProgressForSort` loops over the whole dictionary (`Object.values(wp)`) for each item.
**Action:** When sorting large arrays of objects, specially those that require looking up external data structures with O(N) operations, pre-calculate that data into a `Map` *before* calling `.sort()` to bring the complexity down to O(N).

## 2025-03-01 - Optimizing publishRemoteState array operations
**Learning:** High-frequency UI loop `publishRemoteState` running on every update uses multiple `.filter()` calls with array spreading `[...arr1, ...arr2]` before slicing, creating significant GC pressure due to intermediate arrays. It also repeatedly uses regular expressions `replace(/^(?:series|movie|live)-/, '')` in `isFavOrWatched` for thousands of items, significantly slowing down the process.
**Action:** When filtering/sorting arrays that only need the top N elements (like slicing to 2000), use a single-pass loop with eager bounding to avoid creating large intermediate arrays. Avoid regular expressions inside high-frequency loops; use faster native string manipulations like `startsWith` and `slice` or index lookups.
