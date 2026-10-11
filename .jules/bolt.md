## 2024-09-28 - Virtual Scroller Over-Rendering
**Learning:** `VirtualScroller` instances are repainting elements on *every* scroll pixel adjustment, ignoring whether new data enters the viewport. For a large array, repeatedly generating `document.createDocumentFragment()` without verifying if the displayed segment has shifted destroys the entire benefit of virtualization.
**Action:** When working with virtualization in similar un-memoized vanilla JS layers, cache start/end parameters to intercept layout loops early. The container `scrollTop` natively drives sub-item visual displacement without requiring code intervention until `startIndex` mutates.

## 2025-03-01 - [Pre-calculation for array sorting]
**Learning:** Found a specific performance bottleneck in `app.js` during category/search sorting. It called `getWatchProgressForSort` for each item dynamically in the `sort()` function, leading to O(N^2) complexity because `getWatchProgressForSort` loops over the whole dictionary (`Object.values(wp)`) for each item.
**Action:** When sorting large arrays of objects, specially those that require looking up external data structures with O(N) operations, pre-calculate that data into a `Map` *before* calling `.sort()` to bring the complexity down to O(N).


## 2025-03-01 - Avoid complex array spread and regex in high-frequency functions
**Learning:** `publishRemoteState` in `src/app.js` executes every 2 seconds to synchronize state with the remote control interface. Previously, it processed potentially massive item arrays (live, movies, series) by calling `.filter()` twice per array, spreading the results with `[...arr1, ...arr2]`, running an inline regular expression `replace()` on item IDs, and then running `.slice()` and `.map()`. This caused massive unnecessary memory allocations, creating rapid garbage collection spikes which could induce UI stutter.
**Action:** When working on high-frequency interval functions that process large state arrays:
1. Replace regular expression executions (like `id.replace(/^(?:series|movie|live)-/, '')`) with faster native string methods (`startsWith` and `slice`).
2. Eliminate multi-pass array iterations (`.filter()`) and spread operators for concatenation (`[...a, ...b]`) by using a single-pass `for` loop that partitions data and short-circuits accumulation when bounds (like a maximum item cap of 2000) are met.
