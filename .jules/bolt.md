## 2024-09-28 - Virtual Scroller Over-Rendering
**Learning:** `VirtualScroller` instances are repainting elements on *every* scroll pixel adjustment, ignoring whether new data enters the viewport. For a large array, repeatedly generating `document.createDocumentFragment()` without verifying if the displayed segment has shifted destroys the entire benefit of virtualization.
**Action:** When working with virtualization in similar un-memoized vanilla JS layers, cache start/end parameters to intercept layout loops early. The container `scrollTop` natively drives sub-item visual displacement without requiring code intervention until `startIndex` mutates.

## 2025-03-01 - [Pre-calculation for array sorting]
**Learning:** Found a specific performance bottleneck in `app.js` during category/search sorting. It called `getWatchProgressForSort` for each item dynamically in the `sort()` function, leading to O(N^2) complexity because `getWatchProgressForSort` loops over the whole dictionary (`Object.values(wp)`) for each item.
**Action:** When sorting large arrays of objects, specially those that require looking up external data structures with O(N) operations, pre-calculate that data into a `Map` *before* calling `.sort()` to bring the complexity down to O(N).

## 2025-03-02 - [Interval Loop Overhead in state publishing]
**Learning:** Functions running on a high-frequency interval (`publishRemoteState` running every 2 seconds) used heavy array chains (`.filter()...spread().slice().map()`) combined with Regex parsing over thousands of elements, leading to excessive garbage collection and blocking the main thread.
**Action:** When filtering and capping large datasets for remote broadcasting or IPC, collapse array chains into a single-pass `for` loop and check bounding limits (`result.length < 2000`) eagerly. Use native string functions like `.startsWith()` and `.slice()` instead of `.replace(regex)` inside loops.
