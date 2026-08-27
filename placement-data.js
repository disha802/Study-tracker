/* ============================================================
   placement-data.js — the DSA + SQL roadmap
   Topic: { key, name, tier, why, signals[], pitfalls[], problems[] }
     tier     1 = core (non-negotiable), 2 = depth, 3 = edge
     why / signals / pitfalls support `backticks` for inline code
   Problem: ["Title","E"]        -> links to leetcode.com/problems/<slug-of-title>
            ["Title","M","slug"] -> links to that explicit slug
            ["Title","C",""]     -> concept drill, no link
     difficulty: E easy · M medium · H hard · C concept
   ============================================================ */

var DSA_TOPICS = [

/* ---------------- TIER 1 · CORE ---------------- */
{
  key:"arrays-hashing", name:"Arrays & Hashing", tier:1,
  why:"The tax you pay on every other pattern. A hash map turns an `O(n^2)` scan into `O(n)` by trading memory for lookups, and most interviews open with a disguised version of exactly that trade.",
  signals:[
    "The question says `find a pair / count occurrences / has it been seen before`",
    "A brute force needs two nested loops over the same array",
    "You need to group things by some derived key (sorted string, digit count, remainder)"
  ],
  pitfalls:[
    "Using an array index as the key when values can be negative or huge — use a map",
    "Mutating the map while iterating it",
    "Forgetting that `Set` gives you membership but not counts"
  ],
  problems:[
    ["Contains Duplicate","E"],
    ["Valid Anagram","E"],
    ["Two Sum","E"],
    ["Group Anagrams","M"],
    ["Top K Frequent Elements","M"],
    ["Product of Array Except Self","M"],
    ["Longest Consecutive Sequence","M"]
  ]
},
{
  key:"two-pointers", name:"Two Pointers", tier:1,
  why:"When the array is sorted (or can be), two indices moving toward each other replace a nested loop. The whole skill is proving that moving a pointer can never skip the answer.",
  signals:[
    "The input is sorted, or sorting it does not destroy the question",
    "You are asked for a pair / triplet summing to a target",
    "You compare something at the two ends of a range"
  ],
  pitfalls:[
    "Off-by-one on `while (l < r)` vs `while (l <= r)`",
    "Forgetting to skip duplicates, so the answer set repeats",
    "Sorting when the question needs original indices"
  ],
  problems:[
    ["Valid Palindrome","E"],
    ["Two Sum II - Input Array Is Sorted","M"],
    ["3Sum","M"],
    ["Container With Most Water","M"],
    ["Sort Colors","M"],
    ["Trapping Rain Water","H"]
  ]
},
{
  key:"sliding-window", name:"Sliding Window", tier:1,
  why:"A window that grows on the right and shrinks on the left answers every `longest / shortest / count of substrings satisfying X` question in one pass instead of enumerating all substrings.",
  signals:[
    "The words `contiguous`, `substring`, or `subarray` appear",
    "You want the longest or shortest range meeting a condition",
    "A brute force would enumerate every start and end"
  ],
  pitfalls:[
    "Shrinking with `if` when the invariant needs a `while`",
    "Updating the answer at the wrong moment — before restoring the invariant",
    "Forgetting to remove zero-count keys, which breaks a `map.size` check"
  ],
  problems:[
    ["Best Time to Buy and Sell Stock","E"],
    ["Longest Substring Without Repeating Characters","M"],
    ["Longest Repeating Character Replacement","M"],
    ["Permutation in String","M"],
    ["Minimum Window Substring","H"],
    ["Sliding Window Maximum","H"]
  ]
},
{
  key:"binary-search", name:"Binary Search", tier:1,
  why:"Not just for sorted arrays — the real pattern is searching a monotonic answer space. If `feasible(x)` is false then true as x grows, you can binary search on the answer itself.",
  signals:[
    "Sorted input, or a rotated sorted array",
    "`minimum / maximum value such that a condition holds`",
    "The constraints allow `O(n log n)` but not `O(n^2)`"
  ],
  pitfalls:[
    "Infinite loops from `mid` never advancing — pick your `l = mid + 1` / `r = mid` convention and keep it",
    "Overflow in `(l + r) / 2` in languages with fixed ints — use `l + (r - l) / 2`",
    "Returning `mid` when the question wants the boundary index"
  ],
  problems:[
    ["Binary Search","E"],
    ["Search a 2D Matrix","M"],
    ["Koko Eating Bananas","M"],
    ["Find Minimum in Rotated Sorted Array","M"],
    ["Search in Rotated Sorted Array","M"],
    ["Median of Two Sorted Arrays","H"]
  ]
},
{
  key:"stack", name:"Stack & Monotonic Stack", tier:1,
  why:"A stack remembers what is still unresolved. The monotonic variant answers `next greater / previous smaller` for every element in `O(n)` total, which is the trick behind a surprising number of hard problems.",
  signals:[
    "Matching or nesting — brackets, tags, directories",
    "`next greater element`, `days until warmer`, histogram areas",
    "You need to undo or backtrack the most recent thing"
  ],
  pitfalls:[
    "Popping an empty stack — guard every pop",
    "Storing values when you actually need indices (or vice versa)",
    "Forgetting to drain the stack after the main loop"
  ],
  problems:[
    ["Valid Parentheses","E"],
    ["Min Stack","M"],
    ["Evaluate Reverse Polish Notation","M"],
    ["Daily Temperatures","M"],
    ["Car Fleet","M"],
    ["Largest Rectangle in Histogram","H"]
  ]
},
{
  key:"linked-list", name:"Linked List", tier:1,
  why:"Pointer surgery under pressure. Interviewers like it because it is pure mechanics — you either keep the references straight or you lose the list.",
  signals:[
    "Reverse, merge, reorder, or detect a cycle",
    "`without using extra space` on a list",
    "Fast and slow pointers to find a midpoint"
  ],
  pitfalls:[
    "Losing the rest of the list by reassigning `next` before saving it",
    "Not using a dummy head, then special-casing the first node everywhere",
    "Off-by-one when the fast pointer runs off the end"
  ],
  problems:[
    ["Reverse Linked List","E"],
    ["Merge Two Sorted Lists","E"],
    ["Linked List Cycle","E"],
    ["Remove Nth Node From End of List","M"],
    ["Reorder List","M"],
    ["LRU Cache","M"],
    ["Merge k Sorted Lists","H"]
  ]
},
{
  key:"trees", name:"Binary Trees", tier:1,
  why:"Recursion with a shape. Almost every tree question is `do something to the left subtree, do something to the right subtree, combine` — the difficulty is choosing what to return upward.",
  signals:[
    "Anything with nodes, depth, paths, or levels",
    "`level order` means BFS with a queue",
    "You need information from children before deciding the parent"
  ],
  pitfalls:[
    "Forgetting the null base case",
    "Confusing height (down) with depth (from root)",
    "Returning the answer instead of the value the recursion needs — often you need both, via a global"
  ],
  problems:[
    ["Invert Binary Tree","E"],
    ["Maximum Depth of Binary Tree","E"],
    ["Same Tree","E"],
    ["Binary Tree Level Order Traversal","M"],
    ["Construct Binary Tree from Preorder and Inorder Traversal","M"],
    ["Binary Tree Maximum Path Sum","H"],
    ["Serialize and Deserialize Binary Tree","H"]
  ]
},
{
  key:"bst", name:"Binary Search Tree", tier:1,
  why:"A BST is a sorted array that supports insertion. The single most useful fact: an in-order traversal of a BST is sorted, which turns many questions into one-liners.",
  signals:[
    "The words `binary search tree` — the ordering is a gift, use it",
    "`kth smallest`, `range sum`, `validate`",
    "You can prune half the tree at each node"
  ],
  pitfalls:[
    "Validating with only the parent, not an inherited `(min, max)` range",
    "Assuming balance — a degenerate BST is a linked list",
    "Duplicates: decide which side they go on and be consistent"
  ],
  problems:[
    ["Search in a Binary Search Tree","E"],
    ["Lowest Common Ancestor of a Binary Search Tree","M"],
    ["Kth Smallest Element in a BST","M"],
    ["Validate Binary Search Tree","M"],
    ["Delete Node in a BST","M"]
  ]
},
{
  key:"graphs", name:"Graphs: BFS & DFS", tier:1,
  why:"Grids are graphs. Once you see a matrix as nodes with four edges, flood fill, shortest hop counts and island counting all collapse into one traversal template.",
  signals:[
    "A grid of land and water, rooms, rotting fruit",
    "`shortest path` with unweighted edges means BFS",
    "Connectivity, reachability, or counting components"
  ],
  pitfalls:[
    "Marking visited when popping instead of when pushing — the queue fills with duplicates",
    "Forgetting bounds checks on the four neighbours",
    "Recursive DFS blowing the stack on a large grid — go iterative"
  ],
  problems:[
    ["Number of Islands","M"],
    ["Clone Graph","M"],
    ["Max Area of Island","M"],
    ["Pacific Atlantic Water Flow","M"],
    ["Rotting Oranges","M"],
    ["Word Ladder","H"]
  ]
},
{
  key:"dp-1d", name:"1-D Dynamic Programming", tier:1,
  why:"Where most candidates stall. The job is to name the state in one sentence — `dp[i] = the best answer considering the first i items` — and then the recurrence usually writes itself.",
  signals:[
    "`in how many ways`, `minimum cost to`, `can you reach`",
    "Greedy gives a counterexample but the problem still feels sequential",
    "The answer at `i` depends on a constant number of earlier answers"
  ],
  pitfalls:[
    "Not writing the state definition down before coding",
    "Wrong base case — check `n = 0` and `n = 1` by hand",
    "Iterating the coin/knapsack loops in the wrong order and allowing reuse"
  ],
  problems:[
    ["Climbing Stairs","E"],
    ["Min Cost Climbing Stairs","E"],
    ["House Robber","M"],
    ["House Robber II","M"],
    ["Coin Change","M"],
    ["Longest Increasing Subsequence","M"],
    ["Word Break","M"]
  ]
},

/* ---------------- TIER 2 · DEPTH ---------------- */
{
  key:"heap", name:"Heap / Priority Queue", tier:2,
  why:"When you need the best element repeatedly but not a full sort. `Top k` in `O(n log k)` with a heap of size k is the canonical answer, and the streaming median is its showpiece.",
  signals:[
    "`kth largest`, `top k`, `merge k sorted`",
    "A running median or a schedule by priority",
    "You repeatedly take the min or max and then insert something new"
  ],
  pitfalls:[
    "Using a max-heap when a min-heap of size k is what bounds the memory",
    "Forgetting most standard libraries give you a min-heap — negate for max",
    "Heapifying inside the loop instead of once up front"
  ],
  problems:[
    ["Kth Largest Element in an Array","M"],
    ["K Closest Points to Origin","M"],
    ["Task Scheduler","M"],
    ["Design Twitter","M"],
    ["Find Median from Data Stream","H"]
  ]
},
{
  key:"intervals", name:"Intervals", tier:2,
  why:"Sort by start, then sweep. Nearly every interval question is that one line plus a decision about what to do on overlap — merge it, drop it, or count it.",
  signals:[
    "Meetings, bookings, ranges, `[start, end]` pairs",
    "`can a person attend all meetings`, `minimum rooms`",
    "Overlap, merge, or insert into a sorted set of ranges"
  ],
  pitfalls:[
    "Sorting by end when the question needs start (or the reverse — for greedy scheduling you want end)",
    "Treating touching intervals `[1,2] [2,3]` as overlapping when the problem says they are not",
    "Mutating the input list while iterating it"
  ],
  problems:[
    ["Insert Interval","M"],
    ["Merge Intervals","M"],
    ["Non-overlapping Intervals","M"],
    ["Meeting Rooms","E"],
    ["Meeting Rooms II","M"]
  ]
},
{
  key:"backtracking", name:"Backtracking", tier:2,
  why:"Enumerate every candidate, abandon a branch the moment it cannot work. The template never changes: choose, recurse, un-choose.",
  signals:[
    "`all subsets`, `all permutations`, `all combinations`",
    "A board or grid you fill one cell at a time",
    "The output is a list of lists, not a single number"
  ],
  pitfalls:[
    "Pushing a reference to the working array instead of a copy",
    "Forgetting to un-choose, so state leaks across branches",
    "Not sorting first when you need to skip duplicate branches"
  ],
  problems:[
    ["Subsets","M"],
    ["Combination Sum","M"],
    ["Permutations","M"],
    ["Subsets II","M"],
    ["Word Search","M"],
    ["N-Queens","H"]
  ]
},
{
  key:"greedy", name:"Greedy", tier:2,
  why:"Cheap when it works and wrong when it does not. The interview value is being able to say why the local choice is safe — an exchange argument — rather than just asserting it.",
  signals:[
    "You can prove taking the best option now never blocks a better future",
    "Scheduling by earliest finish time, or jumping as far as possible",
    "A DP solution exists but the constraints beg for `O(n)`"
  ],
  pitfalls:[
    "Assuming greedy works without testing a counterexample",
    "Sorting by the wrong key — try both and see which survives",
    "Missing the running-maximum trick and re-scanning instead"
  ],
  problems:[
    ["Maximum Subarray","M"],
    ["Jump Game","M"],
    ["Jump Game II","M"],
    ["Gas Station","M"],
    ["Partition Labels","M"],
    ["Hand of Straights","M"]
  ]
},
{
  key:"dp-2d", name:"2-D Dynamic Programming", tier:2,
  why:"Two sequences, or one sequence with a budget. The grid `dp[i][j]` compares prefixes, and the classic string-distance problems all live here.",
  signals:[
    "Two strings compared character by character",
    "A grid you traverse with restricted moves",
    "A knapsack with both an item index and a remaining capacity"
  ],
  pitfalls:[
    "Getting the row/column meaning backwards halfway through",
    "Skipping the zero-th row and column, which encode the empty prefix",
    "Optimising to one row before the two-row version is correct"
  ],
  problems:[
    ["Unique Paths","M"],
    ["Longest Common Subsequence","M"],
    ["Coin Change II","M"],
    ["Target Sum","M"],
    ["Edit Distance","M"],
    ["Longest Palindromic Substring","M"]
  ]
},
{
  key:"tries", name:"Trie (Prefix Tree)", tier:2,
  why:"A tree keyed by characters. It turns `does any word start with this prefix` from a scan of the dictionary into a walk of length `O(len)`.",
  signals:[
    "Autocomplete, prefix search, spell check",
    "Many queries against a fixed word list",
    "A grid word search where you prune impossible prefixes"
  ],
  pitfalls:[
    "Forgetting the `isEnd` flag, so prefixes count as words",
    "Building a fresh trie per query instead of once",
    "Assuming 26 lowercase letters when the input has digits or unicode"
  ],
  problems:[
    ["Implement Trie (Prefix Tree)","M"],
    ["Design Add and Search Words Data Structure","M"],
    ["Word Search II","H"]
  ]
},
{
  key:"topological", name:"Topological Sort", tier:2,
  why:"Ordering under dependencies, and the standard way to detect a cycle in a directed graph. Kahn's algorithm doubles as the cycle check: if you cannot emit every node, there is a cycle.",
  signals:[
    "Prerequisites, build order, task dependencies",
    "`is it possible to finish all courses`",
    "A directed graph where order matters"
  ],
  pitfalls:[
    "Building the edge direction backwards",
    "Not handling disconnected components",
    "Forgetting that a cycle means no valid ordering exists at all"
  ],
  problems:[
    ["Course Schedule","M"],
    ["Course Schedule II","M"],
    ["Alien Dictionary","H"]
  ]
},
{
  key:"union-find", name:"Union-Find (DSU)", tier:2,
  why:"Connectivity that answers in near-constant time. With path compression and union by rank you get effectively `O(1)` merges, which makes it the right tool when edges arrive over time.",
  signals:[
    "`are these two in the same group`, merging sets",
    "Counting connected components as edges are added",
    "Detecting the edge that creates a cycle"
  ],
  pitfalls:[
    "Skipping path compression, which degrades to `O(n)` per find",
    "Comparing raw ids instead of roots",
    "Decrementing the component count on a union that was already merged"
  ],
  problems:[
    ["Number of Connected Components in an Undirected Graph","M"],
    ["Redundant Connection","M"],
    ["Graph Valid Tree","M"],
    ["Accounts Merge","M"]
  ]
},
{
  key:"shortest-path", name:"Shortest Path (Dijkstra)", tier:2,
  why:"BFS handles unweighted graphs; the moment edges have different costs you need a priority queue. Knowing when plain BFS is *not* enough is half the marks.",
  signals:[
    "Weighted edges — time, cost, distance",
    "`cheapest`, `fastest`, `minimum effort` on a graph or grid",
    "A hop limit, which pushes you toward Bellman-Ford"
  ],
  pitfalls:[
    "Using Dijkstra with negative weights, where it is simply wrong",
    "Not skipping stale queue entries with a larger distance",
    "Marking visited on push rather than on pop"
  ],
  problems:[
    ["Network Delay Time","M"],
    ["Path with Maximum Probability","M"],
    ["Cheapest Flights Within K Stops","M"],
    ["Swim in Rising Water","H"]
  ]
},

/* ---------------- TIER 3 · EDGE ---------------- */
{
  key:"bit-manipulation", name:"Bit Manipulation", tier:3,
  why:"Occasional but cheap to learn. `x & (x-1)` clears the lowest set bit and XOR cancels pairs — two facts that solve most of what gets asked.",
  signals:[
    "`without using extra space` on a range of integers",
    "Every element appears twice except one",
    "Powers of two, masks, or subset enumeration"
  ],
  pitfalls:[
    "Signed shift `>>` versus unsigned `>>>` on negatives",
    "Assuming 32 bits in a language with arbitrary-precision ints",
    "Operator precedence — `&` binds looser than `==`, so parenthesise"
  ],
  problems:[
    ["Single Number","E"],
    ["Number of 1 Bits","E"],
    ["Counting Bits","E"],
    ["Reverse Bits","E"],
    ["Missing Number","E"],
    ["Sum of Two Integers","M"]
  ]
},
{
  key:"math-geometry", name:"Math & Geometry", tier:3,
  why:"Mostly about in-place index gymnastics rather than real mathematics. Rotating a matrix by transposing then reflecting is the kind of trick worth memorising outright.",
  signals:[
    "Rotate, transpose, spiral, or reflect a matrix",
    "Digit manipulation, GCD, primes",
    "`do it in place with O(1) extra space`"
  ],
  pitfalls:[
    "Overflow when reversing an integer",
    "Reusing a row you have already overwritten",
    "Fencepost errors on the spiral boundaries"
  ],
  problems:[
    ["Rotate Image","M"],
    ["Spiral Matrix","M"],
    ["Set Matrix Zeroes","M"],
    ["Happy Number","E"],
    ["Plus One","E"],
    ["Pow(x, n)","M","powx-n"]
  ]
},
{
  key:"matrix", name:"Matrix Traversal", tier:3,
  why:"Grid problems that are not quite graph problems — prefix sums over 2-D, diagonal walks, and in-place marking to avoid an extra visited array.",
  signals:[
    "Repeated rectangle sum queries",
    "Diagonal or anti-diagonal grouping",
    "You are told not to allocate a second grid"
  ],
  pitfalls:[
    "Mixing up `[row][col]` and `[x][y]`",
    "Inclusive/exclusive confusion in a 2-D prefix sum",
    "Using a sentinel value that can legitimately appear in the data"
  ],
  problems:[
    ["Range Sum Query 2D - Immutable","M"],
    ["Diagonal Traverse","M"],
    ["Game of Life","M"],
    ["Valid Sudoku","M"]
  ]
},
{
  key:"segment-tree", name:"Segment Tree / Fenwick", tier:3,
  why:"Rarely asked in a placement round, but it is the clean answer when a problem mixes point updates with range queries. Knowing it exists is usually enough.",
  signals:[
    "Range sum or range min with updates interleaved",
    "A prefix-sum solution that breaks because the array mutates",
    "Counting inversions or smaller-to-the-right"
  ],
  pitfalls:[
    "One-indexing a Fenwick tree and then reading it zero-indexed",
    "Forgetting to push lazy updates down before querying",
    "Building the tree inside the query loop"
  ],
  problems:[
    ["Range Sum Query - Mutable","M"],
    ["Count of Smaller Numbers After Self","H"]
  ]
},
{
  key:"strings-advanced", name:"Advanced Strings", tier:3,
  why:"Pattern matching beyond the naive scan. KMP is the named algorithm you may be asked to explain even if you never need to write it from memory.",
  signals:[
    "Substring search with a length that rules out `O(nm)`",
    "Repeated patterns or the shortest repeating unit",
    "Rolling hashes and rotation checks"
  ],
  pitfalls:[
    "Building the LPS/failure array off by one",
    "Ignoring hash collisions in Rabin-Karp",
    "Reaching for KMP when the built-in search is allowed"
  ],
  problems:[
    ["Find the Index of the First Occurrence in a String","E"],
    ["Repeated Substring Pattern","E"],
    ["Palindromic Substrings","M"],
    ["Shortest Palindrome","H"]
  ]
}

];

var SQL_TOPICS = [

/* ---------------- TIER 1 · CORE ---------------- */
{
  key:"sql-select", name:"SELECT, WHERE & Ordering", tier:1,
  why:"The floor. Filtering, sorting and limiting correctly — and knowing the logical order of evaluation, `FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT` — prevents most beginner mistakes.",
  signals:[
    "Straight row filtering with no grouping",
    "`top N` by some column",
    "Pattern matching with `LIKE` or `IN`"
  ],
  pitfalls:[
    "Using a `SELECT` alias inside `WHERE` — it does not exist yet, only in `ORDER BY`",
    "`LIMIT` without `ORDER BY`, which returns an arbitrary row",
    "Assuming string comparison is case-insensitive — it depends on the collation"
  ],
  problems:[
    ["Big Countries","E"],
    ["Find Customer Referee","E"],
    ["Article Views I","E"],
    ["Recyclable and Low Fat Products","E"],
    ["Not Boring Movies","E"]
  ]
},
{
  key:"sql-joins", name:"Joins", tier:1,
  why:"The single most examined SQL topic. If you can explain why a `LEFT JOIN` plus `IS NULL` finds unmatched rows, you can answer most of what gets asked.",
  signals:[
    "Data spread over two or more tables",
    "`customers who never ordered` — the anti-join shape",
    "You need columns from one table and a condition from another"
  ],
  pitfalls:[
    "Putting a condition on the right table in `WHERE` instead of `ON`, which silently turns a `LEFT JOIN` into an inner one",
    "Row multiplication from a one-to-many join inflating your `SUM`",
    "Forgetting `DISTINCT` after a fan-out join"
  ],
  problems:[
    ["Combine Two Tables","E"],
    ["Customers Who Never Order","E"],
    ["Employees Earning More Than Their Managers","E"],
    ["Sales Person","E"],
    ["Students and Examinations","E"],
    ["Employee Bonus","E"]
  ]
},
{
  key:"sql-aggregation", name:"Aggregation & GROUP BY", tier:1,
  why:"Collapsing rows into summaries, and the `WHERE` versus `HAVING` distinction that interviewers reliably probe: `WHERE` filters rows before grouping, `HAVING` filters groups after.",
  signals:[
    "`count per`, `average by`, `total for each`",
    "A threshold applied to a group, not a row",
    "The output has one row per category"
  ],
  pitfalls:[
    "Selecting a column that is neither grouped nor aggregated",
    "`COUNT(*)` versus `COUNT(col)` — the second skips NULLs",
    "Integer division silently truncating an average"
  ],
  problems:[
    ["Classes More Than 5 Students","E"],
    ["Group Sold Products By The Date","E"],
    ["Number of Unique Subjects Taught by Each Teacher","E"],
    ["Average Selling Price","E"],
    ["Queries Quality and Percentage","E"],
    ["Count Salary Categories","M"]
  ]
},
{
  key:"sql-subqueries", name:"Subqueries & CTEs", tier:1,
  why:"Naming an intermediate result. A `WITH` clause turns an unreadable nest into a readable pipeline, and interviewers notice which one you reach for.",
  signals:[
    "You need an aggregate compared against individual rows",
    "The same derived table is used twice",
    "A correlated condition — `for each row, look up something`"
  ],
  pitfalls:[
    "A correlated subquery in `SELECT` running once per row when a join would do",
    "`IN` with a subquery that returns NULL, which makes `NOT IN` return nothing",
    "Forgetting that a derived table needs an alias"
  ],
  problems:[
    ["Second Highest Salary","M"],
    ["Department Highest Salary","M"],
    ["Biggest Single Number","E"],
    ["Customer Placing the Largest Number of Orders","M"],
    ["Managers with at Least 5 Direct Reports","M"]
  ]
},
{
  key:"sql-window", name:"Window Functions", tier:1,
  why:"The dividing line between basic and strong SQL. `ROW_NUMBER`, `RANK` and `DENSE_RANK` over a partition solve top-N-per-group in a way that subqueries cannot do cleanly.",
  signals:[
    "`top N per group`, `nth highest per department`",
    "Running totals or moving averages",
    "Comparing a row to the previous one — `LAG` / `LEAD`"
  ],
  pitfalls:[
    "Confusing `RANK` (gaps after ties) with `DENSE_RANK` (no gaps) and `ROW_NUMBER` (arbitrary tie-break)",
    "Filtering on a window function in `WHERE` — it is computed after, so wrap it in a CTE",
    "Forgetting `PARTITION BY`, so the window spans the whole table"
  ],
  problems:[
    ["Rank Scores","M"],
    ["Department Top Three Salaries","H"],
    ["Nth Highest Salary","M"],
    ["Consecutive Numbers","M"],
    ["Restaurant Growth","M"]
  ]
},
{
  key:"sql-null", name:"NULL Handling", tier:1,
  why:"NULL is not a value, it is the absence of one, and it poisons comparisons. A large share of `my query returns nothing` bugs are a NULL misunderstanding.",
  signals:[
    "Optional foreign keys or nullable columns",
    "`NOT IN` against a subquery",
    "Defaults needed for missing data"
  ],
  pitfalls:[
    "`= NULL` instead of `IS NULL`",
    "`NOT IN (subquery containing NULL)` returning the empty set",
    "`COUNT(col)` quietly ignoring NULLs when you expected `COUNT(*)`"
  ],
  problems:[
    ["Find Customer Referee","E"],
    ["Tree Node","M"],
    ["Triangle Judgement","E"],
    ["Product Sales Analysis I","E"]
  ]
},
{
  key:"sql-dedupe", name:"Duplicates & Deletion", tier:1,
  why:"Real tables have duplicates. Removing them without dropping the original demands either a `ROW_NUMBER` filter or a self-join on the id, both of which are standard interview fare.",
  signals:[
    "`find duplicate emails`, `delete all but one`",
    "A natural key that is not enforced unique",
    "`DISTINCT` is not enough because you must keep the earliest row"
  ],
  pitfalls:[
    "Deleting every copy instead of keeping one",
    "In MySQL, referencing the table you are deleting from in the subquery — wrap it in a derived table",
    "`DISTINCT` applying to all selected columns, not just the one you meant"
  ],
  problems:[
    ["Duplicate Emails","E"],
    ["Delete Duplicate Emails","E"],
    ["Rising Temperature","E"]
  ]
},

/* ---------------- TIER 2 · DEPTH ---------------- */
{
  key:"sql-set-ops", name:"Set Operations", tier:2,
  why:"Stacking result sets rather than widening them. The `UNION` versus `UNION ALL` distinction is a cheap question with a real performance answer.",
  signals:[
    "Combining two similarly shaped queries",
    "You need rows present in one query but not another",
    "Reporting where several categories are counted the same way"
  ],
  pitfalls:[
    "`UNION` deduplicating (and paying for a sort) when `UNION ALL` was intended",
    "Mismatched column counts or incompatible types",
    "Applying `ORDER BY` to only the last branch"
  ],
  problems:[
    ["Employees With Missing Information","E"],
    ["Combine Two Tables","E"],
    ["Sellers With No Sales","E"]
  ]
},
{
  key:"sql-string-date", name:"String & Date Functions", tier:2,
  why:"Dialect-specific and easy to fumble under pressure. Grouping by month or truncating a timestamp appears in almost every analytics-flavoured question.",
  signals:[
    "`per month`, `per year`, date ranges",
    "Cleaning names, trimming, changing case",
    "Extracting part of a string or a date"
  ],
  pitfalls:[
    "Wrapping an indexed date column in a function, which kills the index",
    "Off-by-one on `BETWEEN` with timestamps — the end date excludes same-day times",
    "Assuming MySQL syntax on Postgres, or the reverse"
  ],
  problems:[
    ["Fix Names in a Table","E"],
    ["Patients With a Condition","E"],
    ["Monthly Transactions I","M"],
    ["List the Products Ordered in a Period","E"],
    ["User Activity for the Past 30 Days I","E"]
  ]
},
{
  key:"sql-case", name:"CASE & Conditional Aggregation", tier:2,
  why:"Pivoting without a pivot keyword. `SUM(CASE WHEN ... THEN 1 ELSE 0 END)` turns rows into columns and answers a whole class of reporting questions.",
  signals:[
    "Counting several categories side by side in one row",
    "Bucketing a numeric column into bands",
    "Conditional totals in a single pass"
  ],
  pitfalls:[
    "Omitting `ELSE`, which yields NULL and skews an average",
    "Ordering `CASE` branches so an earlier one swallows a later one",
    "Using `COUNT(CASE ...)` where `SUM` was meant — `COUNT` counts the zeros too"
  ],
  problems:[
    ["Not Boring Movies","E"],
    ["Swap Salary","E"],
    ["Calculate Special Bonus","E"],
    ["Percentage of Users Attended a Contest","E"],
    ["Confirmation Rate","M"]
  ]
},
{
  key:"sql-selfjoin", name:"Self Joins & Hierarchies", tier:2,
  why:"A table joined to itself models managers, referrals and consecutive rows. Comfort with two aliases over one table is a small skill with a lot of leverage.",
  signals:[
    "Employee and manager in the same table",
    "Comparing a row with the one before or after it",
    "Friend or follower relationships"
  ],
  pitfalls:[
    "Forgetting to exclude the self-match `a.id <> b.id`",
    "Producing each pair twice — add `a.id < b.id`",
    "Reaching for a self-join when `LAG` would be clearer"
  ],
  problems:[
    ["Employees Earning More Than Their Managers","E"],
    ["Rising Temperature","E"],
    ["The Number of Employees Which Report to Each Employee","E"],
    ["Friend Requests II: Who Has the Most Friends","M"],
    ["Primary Department for Each Employee","E"]
  ]
},
{
  key:"sql-dml", name:"DML & Constraints", tier:2,
  why:"Writing data, not just reading it. `UPDATE` with a join, upserts, and what a foreign key actually enforces on delete are standard follow-up questions.",
  signals:[
    "`update the salary of everyone in department X`",
    "Insert-or-update behaviour",
    "Cascading deletes and referential integrity"
  ],
  pitfalls:[
    "`UPDATE` or `DELETE` without a `WHERE` — the classic career-limiting move",
    "Assuming `ON DELETE CASCADE` exists when it was never declared",
    "Forgetting that a unique constraint permits multiple NULLs in most engines"
  ],
  problems:[
    ["Swap Salary","E"],
    ["Delete Duplicate Emails","E"],
    ["Explain `ON DELETE CASCADE` vs `SET NULL` vs `RESTRICT`","C",""],
    ["Write an upsert three ways: MySQL, Postgres, standard MERGE","C",""]
  ]
},
{
  key:"sql-views-index", name:"Views & Indexes", tier:2,
  why:"The performance conversation. Being able to say when an index helps, when it hurts writes, and why a leading wildcard defeats it separates rehearsed answers from understanding.",
  signals:[
    "`how would you speed this query up`",
    "A slow query on a large table",
    "Reusable, restricted access to a subset of columns"
  ],
  pitfalls:[
    "Believing an index always helps — it costs on every insert and update",
    "`LIKE '%term'` cannot use a B-tree index; `LIKE 'term%'` can",
    "Confusing a plain view (a stored query) with a materialised view (stored rows)"
  ],
  problems:[
    ["Explain a composite index and the leftmost-prefix rule","C",""],
    ["When does the planner ignore an index and choose a full scan?","C",""],
    ["Read an `EXPLAIN` plan and name the join strategy","C",""]
  ]
},

/* ---------------- TIER 3 · DBMS VIVA ---------------- */
{
  key:"dbms-normalization", name:"Normalization", tier:3,
  why:"Pure viva material. You will be asked to define 1NF through BCNF and, more usefully, when you would deliberately denormalise.",
  signals:[
    "`what normal form is this table in`",
    "Update, insert or delete anomalies described in words",
    "A schema-design question on a whiteboard"
  ],
  pitfalls:[
    "Reciting definitions without being able to decompose an example table",
    "Confusing 3NF with BCNF — the difference is a determinant that is not a candidate key",
    "Claiming normalisation is always correct; reporting workloads often want the opposite"
  ],
  problems:[
    ["Define 1NF, 2NF, 3NF and BCNF with one example table each","C",""],
    ["Decompose a table with a partial dependency into 2NF","C",""],
    ["Give a case where denormalising is the right call","C",""]
  ]
},
{
  key:"dbms-transactions", name:"Transactions & ACID", tier:3,
  why:"The most predictable viva question in the set. Know each ACID letter with a one-line example, and be able to name the isolation levels in order.",
  signals:[
    "`what happens if the power fails mid-transfer`",
    "Isolation levels and the anomalies they permit",
    "Commit, rollback, savepoints"
  ],
  pitfalls:[
    "Mixing up dirty read, non-repeatable read and phantom read",
    "Forgetting that the default level differs by engine — `REPEATABLE READ` in MySQL, `READ COMMITTED` in Postgres",
    "Explaining durability without mentioning the write-ahead log"
  ],
  problems:[
    ["Explain each ACID property with a bank-transfer example","C",""],
    ["Map the four isolation levels to the anomalies each allows","C",""],
    ["What does a write-ahead log actually guarantee?","C",""]
  ]
},
{
  key:"dbms-concurrency", name:"Concurrency & Locking", tier:3,
  why:"Follows directly from transactions. Deadlock — its four conditions and how a database resolves one — is the question that most often ends this section.",
  signals:[
    "Two transactions blocking each other",
    "Optimistic versus pessimistic locking",
    "`how does the database prevent lost updates`"
  ],
  pitfalls:[
    "Confusing a shared lock with an exclusive one",
    "Not knowing that databases detect deadlocks and kill a victim rather than hanging",
    "Describing two-phase locking as two-phase commit — different things entirely"
  ],
  problems:[
    ["State the four Coffman conditions for deadlock","C",""],
    ["Explain two-phase locking and why it guarantees serialisability","C",""],
    ["Compare optimistic and pessimistic concurrency control","C",""]
  ]
},
{
  key:"dbms-er", name:"ER Modelling & Keys", tier:3,
  why:"Schema design on paper. Being fluent in candidate versus primary versus foreign key, and translating a cardinality into tables, is quick to prepare and often assessed.",
  signals:[
    "`design the schema for a library / cab service`",
    "Cardinality and participation constraints",
    "Weak entities and composite keys"
  ],
  pitfalls:[
    "Modelling many-to-many without a junction table",
    "Confusing a candidate key with a super key",
    "Forgetting that a weak entity needs its owner's key as part of its own"
  ],
  problems:[
    ["Design an ER diagram for a library system, then map it to tables","C",""],
    ["Distinguish super key, candidate key, primary key and foreign key","C",""],
    ["Convert a many-to-many relationship into relational tables","C",""]
  ]
},
{
  key:"dbms-storage", name:"Indexing Internals & Storage", tier:3,
  why:"The deepest the viva usually goes. Why B+ trees rather than binary trees, and what clustered actually means, are the two answers worth having ready.",
  signals:[
    "`how is an index stored on disk`",
    "Clustered versus non-clustered",
    "Hash index versus B+ tree"
  ],
  pitfalls:[
    "Saying B-tree when the engine uses a B+ tree — only leaves hold data, and they are linked",
    "Thinking a table can have several clustered indexes",
    "Claiming a hash index supports range queries"
  ],
  problems:[
    ["Why B+ trees rather than binary search trees for disk indexes?","C",""],
    ["Contrast clustered and non-clustered indexes","C",""],
    ["When is a hash index the better choice?","C",""]
  ]
}

];
