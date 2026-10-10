## 2024-09-28 - Virtual Scroller Over-Rendering
**Learning:** `VirtualScroller` instances are repainting elements on *every* scroll pixel adjustment, ignoring whether new data enters the viewport. For a large array, repeatedly generating `document.createDocumentFragment()` without verifying if the displayed segment has shifted destroys the entire benefit of virtualization.
**Action:** When working with virtualization in similar un-memoized vanilla JS layers, cache start/end parameters to intercept layout loops early. The container `scrollTop` natively drives sub-item visual displacement without requiring code intervention until `startIndex` mutates.

## 2025-03-01 - [Pre-calculation for array sorting]
**Learning:** Found a specific performance bottleneck in `app.js` during category/search sorting. It called `getWatchProgressForSort` for each item dynamically in the `sort()` function, leading to O(N^2) complexity because `getWatchProgressForSort` loops over the whole dictionary (`Object.values(wp)`) for each item.
**Action:** When sorting large arrays of objects, specially those that require looking up external data structures with O(N) operations, pre-calculate that data into a `Map` *before* calling `.sort()` to bring the complexity down to O(N).


## 2025-03-02 - [Interval functions and array spreading]
**Learning:** High-frequency interval functions like `publishRemoteState` (which runs every 2s) can cause massive CPU spikes and UI freezes if they iterate over large arrays (like media items) multiple times using `.filter()`, `.map()`, array spread operators (`[...a, ...b]`), or expensive operations like Regular Expressions.
**Action:** When extracting data subsets in high-frequency loops from large arrays, avoid `.filter` cascades and array spreading. Instead, use a single-pass `for` loop to manually categorize items, breaking early when limits are reached, and use native string manipulation (`startsWith`/`slice`) instead of Regex for ID parsing.
