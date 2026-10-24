## 2024-09-28 - Virtual Scroller Over-Rendering
**Learning:** `VirtualScroller` instances are repainting elements on *every* scroll pixel adjustment, ignoring whether new data enters the viewport. For a large array, repeatedly generating `document.createDocumentFragment()` without verifying if the displayed segment has shifted destroys the entire benefit of virtualization.
**Action:** When working with virtualization in similar un-memoized vanilla JS layers, cache start/end parameters to intercept layout loops early. The container `scrollTop` natively drives sub-item visual displacement without requiring code intervention until `startIndex` mutates.

## 2025-03-01 - [Pre-calculation for array sorting]
**Learning:** Found a specific performance bottleneck in `app.js` during category/search sorting. It called `getWatchProgressForSort` for each item dynamically in the `sort()` function, leading to O(N^2) complexity because `getWatchProgressForSort` loops over the whole dictionary (`Object.values(wp)`) for each item.
**Action:** When sorting large arrays of objects, specially those that require looking up external data structures with O(N) operations, pre-calculate that data into a `Map` *before* calling `.sort()` to bring the complexity down to O(N).


## 2025-03-01 - Avoid repeated allocations in publishRemoteState
**Learning:** In highly frequent calls like `publishRemoteState` processing large arrays, avoiding `.filter().filter().map()` chains with array spread `[...a, ...b]` significantly reduces garbage collection and CPU overhead. Also, avoiding regular expressions (e.g., `String.replace`) inside the hot loop and using string manipulation (e.g. `startsWith` and `slice`) is much faster.
**Action:** Use a single `for` loop with bounded limits (e.g. early exit via `break` when target capacity is reached) for high-frequency iteration over large lists to avoid O(N) multi-pass complexity.
