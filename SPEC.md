# Product Specification: Idea-First Intellectual Conversations

## Vision

Create a place where curious people can have deep one-to-one conversations about ideas.

The platform is designed around a simple principle:

> Discover ideas first. Discover people second.

Users do not follow people, search for people, or build audiences. They encounter ideas, start conversations, and only later discover who they are talking to.

---

# Core Principles

* Ideas before identities.
* Conversations before reputation.
* Rich reputation instead of scores.
* No popularity metrics.
* No follower graph.
* No algorithmic feed.
* Append-only content.
* The platform facilitates first conversations, not lifelong relationships.

---

# User Accounts

* Users register an account and choose a pseudonym.
* Multiple accounts are allowed.
* No onboarding questionnaire.
* Users immediately enter the feed.
* Posting is available immediately.

---

# Public Posts

Each post contains:

* Title (required)
* Body (optional)
* Links (optional)

Posts are:

* Public
* Permanent
* Searchable
* Immutable after publication

Posts display:

* Title
* Body
* Links
* Timestamp
* Archived badge (if archived)

Posts do not display:

* Author
* Reputation
* Conversation count
* Likes
* Upvotes
* Follower count

---

# Post Updates

Authors may append updates.

Updates:

* Cannot modify previous content.
* Are displayed beneath the original post.
* Form an append-only timeline.

Example:

Original Post

Update #1

Update #2

Update #3

Users who previously participated in conversations originating from a post receive notifications when updates are added.

---

# Feed

Available feed modes:

## Newest

Chronological ordering.

## Random

Randomly selected posts from the archive.

## Search

Search over post titles and bodies.

There are no:

* Trending feeds
* Recommendation feeds
* Popular feeds

---

# Conversation Initiation

Users may initiate conversations from posts.

Rules:

* Maximum 10 new conversations per day.
* First message should be substantial.
* First message is intended as a thoughtful response to the post.

---

# Blind Conversation Phase

When a conversation begins:

Hidden:

* Pseudonym
* Reputation
* Conversation history

Visible:

* Messages only

Users evaluate one another solely through conversation.

---

# Identity Reveal

After 10 exchanged messages total:

Reveal:

* Pseudonym
* Reputation profile
* Conversation statistics

Feedback becomes available.

Every new conversation starts blind, even between users who have previously spoken.

---

# Private Conversations

Conversations support:

* Text
* Images
* PDFs
* Documents
* Attachments

Conversations:

* Never expire
* Never close
* Are permanently private
* Cannot be published
* Cannot be edited
* Cannot be deleted

Users may leave the platform and continue elsewhere if desired.

The platform does not support:

* Friendships
* Following
* Direct user discovery

---

# Notifications

Users receive notifications for:

* New messages
* Post updates on posts they participated in

The platform does not show:

* Online status
* Last seen
* Presence indicators

---

# Reputation System

Reputation is earned exclusively through real conversations.

A user may leave feedback only if:

* Both participants exchanged messages.
* Reveal threshold was reached.

Feedback is anonymous.

Users never see who rated them.

---

# Reputation Profile

Profiles display:

* Total conversations
* Reputation labels
* Other conversation statistics

Profiles do not display:

* Single reputation score
* Karma
* Trust score
* Ranking

---

# Reputation Labels

Labels are:

* Fixed platform-defined labels
* Independent
* Non-symmetric

A user may simultaneously be:

* Insightful
* Dogmatic

or

* Kind
* Rambling

---

# Reputation Visibility

Reputation remains hidden until 10 conversations with feedback exists.

---

# Reputation Decay

Reputation decays over time.

Goal:

* Reflect current conversational experience.
* Avoid permanent reputation lock-in.

Exponential decay with a 1-year half-life.

Each label event loses half its weight every year:

* today: 1.00
* 1 year old: 0.50
* 2 years old: 0.25
* 3 years old: 0.125

Formula:

decayed_points = points × 0.5^(age_days / 365)

---

# Reputation Inputs

Feedback consists of:

## 10 Positive labels

* Insightful
* Curious
* Knowledgeable
* Creative
* Honest
* Kind
* Thoughtful
* Challenging
* Engaging
* Clear

## 10 Negative labels

* AI
* Annoying
* Jerk
* Dogmatic
* Bad Faith
* Boring
* Arrogant
* Rambling
* Unresponsive
* Attention-Seeking

## 15 Neutral labels

* Weird
* Contrarian
* Intense
* Eccentric
* Obsessive
* Academic
* Artistic
* Spiritual
* Technical
* Philosophical
* Playful
* Serious
* Abstract
* Practical
* Analytical

Users may assign labels independently.

Users may also assign:

* Thumbs up
* Thumbs down

Range:

* -2 to +2

---

# Conversation Statistics

Profiles may display:

* Conversations participated in
* DMs received
* Conversations started

Potentially:

* Average conversation length

No aggregate reputation score exists.

---

# Archiving

Posts become archived after receiving sufficient inbound responses.

Archived posts:

* Remain visible.
* Remain searchable.
* Cannot receive new conversations.

Current proposal:

* Archive after 100 inbound conversation requests.

---

# Bookmarks

Users may bookmark posts privately.

Bookmarks are:

* Personal
* Private
* Not social

---

# Moderation

Moderation and reputation are separate systems.

Reputation answers:

"What is it like to talk to this person?"

Moderation answers:

"Should this content or account remain on the platform?"

Users may report:

* Posts
* Messages
* Accounts

Moderation handles:

* Spam
* Bots
* Harassment
* Doxxing
* Illegal content
* Coordinated abuse

Moderation actions are not displayed publicly.

Report counts are never shown.

---

# Explicitly Unsupported Features

No follows.

No followers.

No friend system.

No direct user search.

No public conversation logs.

No public post history attached to users.

No popularity metrics.

No likes.

No upvotes.

No trending page.

No recommendation algorithm.

No public reputation score.

No online indicators.

No message deletion.

No message editing.

No post editing.

No monetary mechanics in v1.

---

# Product Summary

The platform is a marketplace for first intellectual conversations.

Users discover ideas.

Ideas create conversations.

Conversations reveal people.

Friendships, if they emerge, continue elsewhere.
