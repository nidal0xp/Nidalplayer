## 2024-09-28 - Virtual Scroller Over-Rendering
**Learning:** `VirtualScroller` instances are repainting elements on *every* scroll pixel adjustment, ignoring whether new data enters the viewport. For a large array, repeatedly generating `document.createDocumentFragment()` without verifying if the displayed segment has shifted destroys the entire benefit of virtualization.
**Action:** When working with virtualization in similar un-memoized vanilla JS layers, cache start/end parameters to intercept layout loops early. The container `scrollTop` natively drives sub-item visual displacement without requiring code intervention until `startIndex` mutates.

## 2025-03-01 - [Pre-calculation for array sorting]
**Learning:** Found a specific performance bottleneck in `app.js` during category/search sorting. It called `getWatchProgressForSort` for each item dynamically in the `sort()` function, leading to O(N^2) complexity because `getWatchProgressForSort` loops over the whole dictionary (`Object.values(wp)`) for each item.
**Action:** When sorting large arrays of objects, specially those that require looking up external data structures with O(N) operations, pre-calculate that data into a `Map` *before* calling `.sort()` to bring the complexity down to O(N).

## 2026-10-31 - Eager Bounding for Large Array Transformations
**Learning:** In frequently executed functions (like `publishRemoteState` running every 2s), chaining multiple `.filter()` calls, array spread operators `[...]`, and `.map()` on massive datasets (e.g., 50k+ items) causes severe memory allocation and garbage collection spikes. The previous implementation mapped *all* items only to discard them via a `.slice(0, 2000)` later.
**Action:** When filtering and transforming large datasets with a known limit, use single-pass `for` loops with eager bounding checks (e.g., stopping when the limit is reached) and defer object transformations until *after* the array is sliced to prevent processing discarded items. Replace repeated regex evaluations with native string manipulation like `.startsWith()` and `.slice()` for better speed.
