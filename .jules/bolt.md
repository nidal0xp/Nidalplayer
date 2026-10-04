## 2024-09-28 - Virtual Scroller Over-Rendering
**Learning:** `VirtualScroller` instances are repainting elements on *every* scroll pixel adjustment, ignoring whether new data enters the viewport. For a large array, repeatedly generating `document.createDocumentFragment()` without verifying if the displayed segment has shifted destroys the entire benefit of virtualization.
**Action:** When working with virtualization in similar un-memoized vanilla JS layers, cache start/end parameters to intercept layout loops early. The container `scrollTop` natively drives sub-item visual displacement without requiring code intervention until `startIndex` mutates.

## 2025-03-01 - [Pre-calculation for array sorting]
**Learning:** Found a specific performance bottleneck in `app.js` during category/search sorting. It called `getWatchProgressForSort` for each item dynamically in the `sort()` function, leading to O(N^2) complexity because `getWatchProgressForSort` loops over the whole dictionary (`Object.values(wp)`) for each item.
**Action:** When sorting large arrays of objects, specially those that require looking up external data structures with O(N) operations, pre-calculate that data into a `Map` *before* calling `.sort()` to bring the complexity down to O(N).

## 2024-05-18 - Functional Array Operations Overheads
**Learning:** `publishRemoteState` runs repeatedly via `setInterval` every 2000ms. Iterating over massive arrays (e.g. `liveChannels`, `movies`, `series`) using sequential `.filter()` and array spread operations (e.g. `[...arr.filter(cond), ...arr.filter(!cond)]`) caused significant CPU and garbage collection overheads by recreating large intermediate arrays in every cycle.
**Action:** When working with periodic updates over large arrays, replace functional array operations with single-pass loops (`for`) and mutable accumulator arrays to construct final objects. Avoid spread operators and multiple iterations on the same list.
