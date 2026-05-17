<script>
  import Link from "../router/Link.svelte";

  let { params } = $props();

  let posts = $state([
    {
      id: "1",
      title: "If time is relative, does 'now' exist everywhere simultaneously?",
      author: "alice",
      authorDisplay: "Alice",
      score: 42,
      comments: 8,
      time: "3 hours ago",
      upvoted: false,
      downvoted: false,
    },
    {
      id: "2",
      title: "P vs. NP — why should non-mathematicians care?",
      author: "bob",
      authorDisplay: "Bob",
      score: 31,
      comments: 15,
      time: "5 hours ago",
      upvoted: false,
      downvoted: false,
    },
    {
      id: "3",
      title: "The hard problem of consciousness: is it solvable?",
      author: "charlie",
      authorDisplay: "Charlie",
      score: 27,
      comments: 22,
      time: "7 hours ago",
      upvoted: false,
      downvoted: false,
    },
    {
      id: "4",
      title: "Gödel's incompleteness theorems explained simply",
      author: "alice",
      authorDisplay: "Alice",
      score: 19,
      comments: 6,
      time: "12 hours ago",
      upvoted: false,
      downvoted: false,
    },
    {
      id: "5",
      title: "If a tree falls in a forest and no one is around, does it make a sound?",
      author: "dave",
      authorDisplay: "Dave",
      score: 15,
      comments: 11,
      time: "1 day ago",
      upvoted: false,
      downvoted: false,
    },
  ]);

  function toggleUpvote(post) {
    if (post.upvoted) {
      post.score--;
      post.upvoted = false;
    } else {
      if (post.downvoted) { post.score++; post.downvoted = false; }
      post.score++;
      post.upvoted = true;
    }
  }

  function toggleDownvote(post) {
    if (post.downvoted) {
      post.score++;
      post.downvoted = false;
    } else {
      if (post.upvoted) { post.score--; post.upvoted = false; }
      post.score--;
      post.downvoted = true;
    }
  }
</script>

<div class="tab-bar">
  <button class="active">Hot</button>
  <button>New</button>
  <button>Top</button>
  <button>Rising</button>
</div>

{#each posts as post (post.id)}
  <article class="post">
    <div class="post-vote">
      <button aria-label="upvote" onclick={() => toggleUpvote(post)} style={post.upvoted ? 'color: var(--upvote)' : ''}>
        <svg viewBox="0 0 15 15" fill="currentColor"><path d="M7.5 1L1 9h13L7.5 1z"/></svg>
      </button>
      <span class="score">{post.score}</span>
      <button aria-label="downvote" class="down" onclick={() => toggleDownvote(post)} style={post.downvoted ? 'color: var(--downvote)' : ''}>
        <svg viewBox="0 0 15 15" fill="currentColor"><path d="M7.5 14L14 6H1l6.5 8z"/></svg>
      </button>
    </div>
    <div class="post-main">
      <div class="post-title">
        {post.title}
      </div>
      <div class="post-meta">
        submitted <span>{post.time}</span>
        <span class="separator">by</span>
        <Link href="/profile/{post.author}">{post.authorDisplay}</Link>
        <span class="separator">|</span>
        <span>{post.comments} comment{post.comments !== 1 ? 's' : ''}</span>
      </div>
    </div>
  </article>
{/each}
