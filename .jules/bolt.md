## 2024-09-28 - Virtual Scroller Over-Rendering
**Learning:** `VirtualScroller` instances are repainting elements on *every* scroll pixel adjustment, ignoring whether new data enters the viewport. For a large array, repeatedly generating `document.createDocumentFragment()` without verifying if the displayed segment has shifted destroys the entire benefit of virtualization.
**Action:** When working with virtualization in similar un-memoized vanilla JS layers, cache start/end parameters to intercept layout loops early. The container `scrollTop` natively drives sub-item visual displacement without requiring code intervention until `startIndex` mutates.

## 2025-03-01 - [Pre-calculation for array sorting]
**Learning:** Found a specific performance bottleneck in `app.js` during category/search sorting. It called `getWatchProgressForSort` for each item dynamically in the `sort()` function, leading to O(N^2) complexity because `getWatchProgressForSort` loops over the whole dictionary (`Object.values(wp)`) for each item.
**Action:** When sorting large arrays of objects, specially those that require looking up external data structures with O(N) operations, pre-calculate that data into a `Map` *before* calling `.sort()` to bring the complexity down to O(N).


## 2025-03-01 - [publishRemoteState High-Frequency Array Operations]
**Learning:** Found a major performance bottleneck in `app.js` inside the `publishRemoteState` function, which is called very frequently via `setInterval` every 2s. The previous implementation used multiple `.filter()` calls, `.replace()` with Regular Expressions to sanitize IDs, and spread operators `[...a, ...b]` on potentially massive arrays (like `liveChannels`, `movies`, `series`) resulting in high CPU usage and garbage collection overhead.
**Action:** For frequently executed loops that process large arrays with slicing (e.g. max 2000 items), replace `.filter()` and array spread operations with single-pass loops utilizing eager bounds checking (halting when limits are reached). Also, replace repetitive Regular Expression checks (`.replace(/.../)`) with faster string manipulation methods such as `.startsWith()` and `.slice()`.
