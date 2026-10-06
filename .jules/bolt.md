## 2024-09-28 - Virtual Scroller Over-Rendering
**Learning:** `VirtualScroller` instances are repainting elements on *every* scroll pixel adjustment, ignoring whether new data enters the viewport. For a large array, repeatedly generating `document.createDocumentFragment()` without verifying if the displayed segment has shifted destroys the entire benefit of virtualization.
**Action:** When working with virtualization in similar un-memoized vanilla JS layers, cache start/end parameters to intercept layout loops early. The container `scrollTop` natively drives sub-item visual displacement without requiring code intervention until `startIndex` mutates.

## 2025-03-01 - [Pre-calculation for array sorting]
**Learning:** Found a specific performance bottleneck in `app.js` during category/search sorting. It called `getWatchProgressForSort` for each item dynamically in the `sort()` function, leading to O(N^2) complexity because `getWatchProgressForSort` loops over the whole dictionary (`Object.values(wp)`) for each item.
**Action:** When sorting large arrays of objects, specially those that require looking up external data structures with O(N) operations, pre-calculate that data into a `Map` *before* calling `.sort()` to bring the complexity down to O(N).

## 2024-05-24 - Array spreading and multiple O(N) operations inside intervals
**Learning:** Functions running on an interval (like `publishRemoteState` running every 2s) can cause huge memory allocations and GC thrashing if they use `.filter()` multiple times and array spread operations `[...array1, ...array2]` on large data arrays (thousands of items). Similarly, using RegEx in high-frequency loops introduces significant overhead.
**Action:** Replace multiple passes and array spreads inside intervals with a single `for` loop, allocating and pushing to arrays cleanly. Replace repeated RegEx matches with simple string manipulations like `slice` or `startsWith` where possible.
