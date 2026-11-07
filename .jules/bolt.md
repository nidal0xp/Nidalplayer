## 2024-09-28 - Virtual Scroller Over-Rendering
**Learning:** `VirtualScroller` instances are repainting elements on *every* scroll pixel adjustment, ignoring whether new data enters the viewport. For a large array, repeatedly generating `document.createDocumentFragment()` without verifying if the displayed segment has shifted destroys the entire benefit of virtualization.
**Action:** When working with virtualization in similar un-memoized vanilla JS layers, cache start/end parameters to intercept layout loops early. The container `scrollTop` natively drives sub-item visual displacement without requiring code intervention until `startIndex` mutates.

## 2025-03-01 - [Pre-calculation for array sorting]
**Learning:** Found a specific performance bottleneck in `app.js` during category/search sorting. It called `getWatchProgressForSort` for each item dynamically in the `sort()` function, leading to O(N^2) complexity because `getWatchProgressForSort` loops over the whole dictionary (`Object.values(wp)`) for each item.
**Action:** When sorting large arrays of objects, specially those that require looking up external data structures with O(N) operations, pre-calculate that data into a `Map` *before* calling `.sort()` to bring the complexity down to O(N).

## 2026-11-07 - [Optimize array filtering and spreading in high-frequency loops]
**Learning:** In high-frequency functions like `publishRemoteState` (called every 2s), doing multiple `.filter()` passes and then spreading the results into a new array (e.g., `[...arr.filter(cond), ...arr.filter(!cond)]`) causes massive memory allocation and CPU overhead, especially with arrays having tens of thousands of items.
**Action:** Replaced the double `.filter()` + spread operations with single-pass loops that eagerly populate the output arrays until the maximum length (2000) is reached. Deferred the `.map()` object transformation until after the array is bounded, further preventing O(N) memory allocations.
