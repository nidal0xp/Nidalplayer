## 2024-09-28 - Virtual Scroller Over-Rendering
**Learning:** `VirtualScroller` instances are repainting elements on *every* scroll pixel adjustment, ignoring whether new data enters the viewport. For a large array, repeatedly generating `document.createDocumentFragment()` without verifying if the displayed segment has shifted destroys the entire benefit of virtualization.
**Action:** When working with virtualization in similar un-memoized vanilla JS layers, cache start/end parameters to intercept layout loops early. The container `scrollTop` natively drives sub-item visual displacement without requiring code intervention until `startIndex` mutates.

## 2025-03-01 - [Pre-calculation for array sorting]
**Learning:** Found a specific performance bottleneck in `app.js` during category/search sorting. It called `getWatchProgressForSort` for each item dynamically in the `sort()` function, leading to O(N^2) complexity because `getWatchProgressForSort` loops over the whole dictionary (`Object.values(wp)`) for each item.
**Action:** When sorting large arrays of objects, specially those that require looking up external data structures with O(N) operations, pre-calculate that data into a `Map` *before* calling `.sort()` to bring the complexity down to O(N).

## 2024-05-18 - Optimize high-frequency loops in publishRemoteState
**Learning:** The `publishRemoteState` function runs every 2s, but used multiple `.filter()` passes and array spreads `[...a, ...b]` on potentially massive datasets (e.g. 100k live channels). Combined with running `.replace()` regexes on every item's ID in the loop, this causes extreme garbage collection pressure and CPU lag.
**Action:** When filtering bounded subsets from large arrays in high-frequency loops, replace multiple passes/spreads with single-pass `for` loops utilizing eager bounding checks (`if (arr.length >= LIMIT) break;`), and swap regex evaluations for native string functions like `startsWith()` and `slice()`.
