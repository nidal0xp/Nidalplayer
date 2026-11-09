## 2024-09-28 - Virtual Scroller Over-Rendering
**Learning:** `VirtualScroller` instances are repainting elements on *every* scroll pixel adjustment, ignoring whether new data enters the viewport. For a large array, repeatedly generating `document.createDocumentFragment()` without verifying if the displayed segment has shifted destroys the entire benefit of virtualization.
**Action:** When working with virtualization in similar un-memoized vanilla JS layers, cache start/end parameters to intercept layout loops early. The container `scrollTop` natively drives sub-item visual displacement without requiring code intervention until `startIndex` mutates.

## 2025-03-01 - [Pre-calculation for array sorting]
**Learning:** Found a specific performance bottleneck in `app.js` during category/search sorting. It called `getWatchProgressForSort` for each item dynamically in the `sort()` function, leading to O(N^2) complexity because `getWatchProgressForSort` loops over the whole dictionary (`Object.values(wp)`) for each item.
**Action:** When sorting large arrays of objects, specially those that require looking up external data structures with O(N) operations, pre-calculate that data into a `Map` *before* calling `.sort()` to bring the complexity down to O(N).


## 2023-10-27 - [Optimization of publishRemoteState array serialization]
**Learning:** Found a severe performance regression in `publishRemoteState` (which runs every 2s). The logic for constructing `channels`, `movies`, and `series` used multiple spread operations combined with repeated `.filter()` iterations and regex ID substitutions for each item. When data arrays contained tens to hundreds of thousands of items, this caused massive memory allocation spikes, O(N) redundant iterations, and blocked the main thread.
**Action:** When filtering, bounding, and mapping very large array sets for state snapshots on intervals, use a single-pass loop with eager array bounding (`slice` or pushing to bounded-length caches), replace repeated Regular Expressions with string manipulations (`startsWith`/`slice`), and defer `.map()` transformations until *after* the array is bounds-limited to avoid generating massive intermediate arrays.
