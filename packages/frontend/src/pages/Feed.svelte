<script>
  import Link from "../router/Link.svelte";

  let { params } = $props();

  let posts = $state([]);

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
{:else}
  <div class="panel">
    <div class="panel-body" style="text-align:center;padding:40px;color:var(--text-muted)">
      No posts yet.
    </div>
  </div>
{/each}
