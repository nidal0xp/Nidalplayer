## 2024-09-28 - Virtual Scroller Over-Rendering
**Learning:** `VirtualScroller` instances are repainting elements on *every* scroll pixel adjustment, ignoring whether new data enters the viewport. For a large array, repeatedly generating `document.createDocumentFragment()` without verifying if the displayed segment has shifted destroys the entire benefit of virtualization.
**Action:** When working with virtualization in similar un-memoized vanilla JS layers, cache start/end parameters to intercept layout loops early. The container `scrollTop` natively drives sub-item visual displacement without requiring code intervention until `startIndex` mutates.

## 2025-03-01 - [Pre-calculation for array sorting]
**Learning:** Found a specific performance bottleneck in `app.js` during category/search sorting. It called `getWatchProgressForSort` for each item dynamically in the `sort()` function, leading to O(N^2) complexity because `getWatchProgressForSort` loops over the whole dictionary (`Object.values(wp)`) for each item.
**Action:** When sorting large arrays of objects, specially those that require looking up external data structures with O(N) operations, pre-calculate that data into a `Map` *before* calling `.sort()` to bring the complexity down to O(N).

## 2025-03-01 - Avoid Multiple Array Manipulations in High-Frequency Loops
**Learning:** In Nidalplayer, `publishRemoteState` runs very frequently (every 2s). Filtering, spreading, slicing, and finally mapping large data sets (like `liveChannels`, `movies`, `series`) creates extreme memory churn and CPU overhead by continuously allocating objects that are immediately thrown away. Furthermore, repeated regular expressions for simple prefix stripping in loops cause performance drops.
**Action:** Replace multiple `.filter()` passes, array spread operators, and RegEx in hot paths with a single-pass loop using eager bounding checks (`if (res.length < 2000)`). Use fast native string methods (`.startsWith()`, `.slice()`) and crucially defer any `.map()` transformations until *after* the array limit is enforced.
