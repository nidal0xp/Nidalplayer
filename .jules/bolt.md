## 2024-09-28 - Virtual Scroller Over-Rendering
**Learning:** `VirtualScroller` instances are repainting elements on *every* scroll pixel adjustment, ignoring whether new data enters the viewport. For a large array, repeatedly generating `document.createDocumentFragment()` without verifying if the displayed segment has shifted destroys the entire benefit of virtualization.
**Action:** When working with virtualization in similar un-memoized vanilla JS layers, cache start/end parameters to intercept layout loops early. The container `scrollTop` natively drives sub-item visual displacement without requiring code intervention until `startIndex` mutates.

## 2025-03-01 - [Pre-calculation for array sorting]
**Learning:** Found a specific performance bottleneck in `app.js` during category/search sorting. It called `getWatchProgressForSort` for each item dynamically in the `sort()` function, leading to O(N^2) complexity because `getWatchProgressForSort` loops over the whole dictionary (`Object.values(wp)`) for each item.
**Action:** When sorting large arrays of objects, specially those that require looking up external data structures with O(N) operations, pre-calculate that data into a `Map` *before* calling `.sort()` to bring the complexity down to O(N).

## 2026-11-06 - Remote State Serialization Bottleneck
**Learning:** In `publishRemoteState` (which runs every 2s to sync LAN apps), parsing large media arrays (50K+ items) using multiple functional `.filter()` chains, rest spread operators `[...]`, and executing RegEx on strings generated massive O(N) memory allocations, starving the garbage collector and causing frame drops in the main UI thread.
**Action:** Replaced functional array manipulations with single-pass `for` loops with eager bounding (stopping at the 2000 item limit) and deferred object mutations (`.map()`) until the subset was finalized. Also replaced RegEx prefix stripping with faster `startsWith` and `slice`. This reduces array generation from 4+ arrays per collection down to 1 bounded result.
