## 2024-09-28 - Virtual Scroller Over-Rendering
**Learning:** `VirtualScroller` instances are repainting elements on *every* scroll pixel adjustment, ignoring whether new data enters the viewport. For a large array, repeatedly generating `document.createDocumentFragment()` without verifying if the displayed segment has shifted destroys the entire benefit of virtualization.
**Action:** When working with virtualization in similar un-memoized vanilla JS layers, cache start/end parameters to intercept layout loops early. The container `scrollTop` natively drives sub-item visual displacement without requiring code intervention until `startIndex` mutates.

## 2025-03-01 - [Pre-calculation for array sorting]
**Learning:** Found a specific performance bottleneck in `app.js` during category/search sorting. It called `getWatchProgressForSort` for each item dynamically in the `sort()` function, leading to O(N^2) complexity because `getWatchProgressForSort` loops over the whole dictionary (`Object.values(wp)`) for each item.
**Action:** When sorting large arrays of objects, specially those that require looking up external data structures with O(N) operations, pre-calculate that data into a `Map` *before* calling `.sort()` to bring the complexity down to O(N).


## 2025-03-01 - Avoid filter/spread in high-frequency interval functions
**Learning:** In Nidalplayer, `publishRemoteState` runs every 2s. Filtering large item arrays (`liveChannels`, `movies`, `series`) with multiple `.filter()` calls and spreading them repeatedly into new arrays (`[...arr1, ...arr2]`) leads to significant memory overhead and Garbage Collection pauses, which can cause UI freezes. Furthermore, running expensive regular expressions for ID cleanup (`replace(/^(?:series|movie|live)-/, '')`) per item per interval is highly inefficient.
**Action:** Replace multiple `.filter()` calls and spread operators with a single-pass `for` loop, eager limit checks (e.g. bounding size to 2000), and replace slow Regex evaluations with fast native string checks (`startsWith`, `slice`) in high-frequency functions.
