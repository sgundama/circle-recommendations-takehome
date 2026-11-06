# One main Recommendation per Primary Topic

Twelve of the 22 Topics have two or three Circles. We list at most one main Recommendation per
non-null Primary Topic and attach the other Eligible Circles on that Topic to it as Alternatives.
This is a simple diversity rule. It is easy to explain to a Member and it directly addresses the
planted duplicate scenario (user 15, Circles #10, #11, #12).

Treat each Circle without a Primary Topic independently. A missing Primary Topic does not
establish a shared subject, identity, or region, so these Circles are never collapsed and have
no Alternatives.

## Considered Options

- **Two per Primary Topic.** Tried and rejected. With the draft weights it returned two of the
  three near-identical negotiation Circles back to back for user 15, with identical scores:

  | User | One per Topic (top 3) | Two per Topic (top 3) |
  | --- | --- | --- |
  | 7 | #6, #1, #31 | #6, #1, #5 |
  | 15 | #13, #11, #23 | #13, #11, **#10** |

  The gain for user 7 (#5 Women Who Lead in the main list instead of as an Alternative under
  #1 The Elevation Circle) was a test expectation we wrote ourselves, not an assignment
  requirement. #1 is also an active, open leadership Circle. The duplicate scenario is explicit.
- **Text similarity.** Deferred. Not evaluated; a topic limit fits the assignment's time budget.

## Selection and Alternatives

1. Rank Eligible Circles. Build the main list by taking each Circle whose non-null Primary
   Topic has not yet been used, until the requested limit is reached. Circles without a
   Primary Topic are always taken.
2. After the main list is final, attach to each main Recommendation the remaining Eligible
   Circles on its Primary Topic, in rank order, at most two.
3. A Circle never appears in both the main list and an Alternative list.

## Consequences

- A Member with a single Interest sees one headline Circle for it, not three.
- Sharing a Primary Topic does not prove two Circles are duplicates. Format and join policy may
  be a real choice; the Alternatives keep that choice visible.
- One Interest can match Tags across several Primary Topics. The limit applies per Primary
  Topic, not per Interest.
- If Circles later gain richer metadata (for example embeddings), this rule is the first thing
  to revisit.
