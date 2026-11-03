## 2024-09-28 - Virtual Scroller Over-Rendering
**Learning:** `VirtualScroller` instances are repainting elements on *every* scroll pixel adjustment, ignoring whether new data enters the viewport. For a large array, repeatedly generating `document.createDocumentFragment()` without verifying if the displayed segment has shifted destroys the entire benefit of virtualization.
**Action:** When working with virtualization in similar un-memoized vanilla JS layers, cache start/end parameters to intercept layout loops early. The container `scrollTop` natively drives sub-item visual displacement without requiring code intervention until `startIndex` mutates.

## 2025-03-01 - [Pre-calculation for array sorting]
**Learning:** Found a specific performance bottleneck in `app.js` during category/search sorting. It called `getWatchProgressForSort` for each item dynamically in the `sort()` function, leading to O(N^2) complexity because `getWatchProgressForSort` loops over the whole dictionary (`Object.values(wp)`) for each item.
**Action:** When sorting large arrays of objects, specially those that require looking up external data structures with O(N) operations, pre-calculate that data into a `Map` *before* calling `.sort()` to bring the complexity down to O(N).


## 2025-03-01 - Single-pass bounding for frequent serialization
**Learning:** In high-frequency functions like `publishRemoteState` (running every 2s), utilizing double `.filter()` iterations, spread operators, and O(N) `.map()` calls on potentially massive unbounded arrays (e.g. `liveChannels`, `movies`) results in severe, repeated memory allocation spikes that freeze the main thread. Additionally, continuous regex evaluation for ID cleanup exacerbates the issue.
**Action:** Instead of applying `.filter()` and array spreads before `.slice(0, limit)`, use single-pass loops to populate target arrays, halting non-essential iterations (e.g., standard items) once the limit (like 2000) is hit. Substitute regex string replacements with simpler `startsWith`/`slice` operations, and importantly, execute `.map()` object transformation strictly after the slice/bounding has been finalized.
