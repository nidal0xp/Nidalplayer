## 2024-09-28 - Virtual Scroller Over-Rendering
**Learning:** `VirtualScroller` instances are repainting elements on *every* scroll pixel adjustment, ignoring whether new data enters the viewport. For a large array, repeatedly generating `document.createDocumentFragment()` without verifying if the displayed segment has shifted destroys the entire benefit of virtualization.
**Action:** When working with virtualization in similar un-memoized vanilla JS layers, cache start/end parameters to intercept layout loops early. The container `scrollTop` natively drives sub-item visual displacement without requiring code intervention until `startIndex` mutates.

## 2025-03-01 - [Pre-calculation for array sorting]
**Learning:** Found a specific performance bottleneck in `app.js` during category/search sorting. It called `getWatchProgressForSort` for each item dynamically in the `sort()` function, leading to O(N^2) complexity because `getWatchProgressForSort` loops over the whole dictionary (`Object.values(wp)`) for each item.
**Action:** When sorting large arrays of objects, specially those that require looking up external data structures with O(N) operations, pre-calculate that data into a `Map` *before* calling `.sort()` to bring the complexity down to O(N).

## 2025-03-01 - Garbage Collection Thrashing in State Publishing
**Learning:** Found a specific performance bottleneck in `app.js` during the remote state synchronization (`publishRemoteState`) executed every 2 seconds. The function created multiple arrays using double `.filter()` passes and array spreads `[...arr]` for `liveChannels`, `movies`, and `series`, causing high memory allocation and Garbage Collection thrashing on intervals. It also utilized repeated Regex evaluations (`.replace()`) on strings to strip ID prefixes.
**Action:** When implementing high-frequency interval functions like state synchronization over large item lists, avoid double filters, array spreads, and Regex. Instead, use a single-pass loop (e.g., `for` loop pushing to categorised arrays) and native string manipulation (`startsWith` + `slice`) to significantly reduce memory allocation overhead and execution time.
