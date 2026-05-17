<script>
  import { onMount } from "svelte";
  import Link from "../router/Link.svelte";
  import { api } from "../lib/api.js";

  let { params } = $props();

  let post = $state(null);
  let loading = $state(true);
  let error = $state("");

  onMount(async () => {
    try {
      const data = await api(`/api/posts/${params.id}`);
      post = data.post;
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  });

  function toggleUpvote() {
    if (post.upvoted) {
      post.score--;
      post.upvoted = false;
    } else {
      if (post.downvoted) { post.score++; post.downvoted = false; }
      post.score++;
      post.upvoted = true;
    }
  }

  function toggleDownvote() {
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

{#if loading}
  <div class="panel">
    <div class="panel-body" style="color:var(--text-muted)">Loading post…</div>
  </div>
{:else if error}
  <div class="not-found">
    <h1>404</h1>
    <p>{error}</p>
    <Link href="/" class="btn-primary">Go to Feed</Link>
  </div>
{:else if post}
  <div class="panel post-detail">
    <article class="post">
      <div class="post-vote">
        <button aria-label="upvote" onclick={toggleUpvote} style={post.upvoted ? 'color: var(--upvote)' : ''}>
          <svg viewBox="0 0 15 15" fill="currentColor"><path d="M7.5 1L1 9h13L7.5 1z"/></svg>
        </button>
        <span class="score">{post.score}</span>
        <button aria-label="downvote" class="down" onclick={toggleDownvote} style={post.downvoted ? 'color: var(--downvote)' : ''}>
          <svg viewBox="0 0 15 15" fill="currentColor"><path d="M7.5 14L14 6H1l6.5 8z"/></svg>
        </button>
      </div>
      <div class="post-main">
        <div class="post-title">{post.title}</div>
        <div class="post-meta">
          <Link href="/profile/{post.author}">{post.author}</Link>
          <span class="separator">|</span>
          <span>{post.score} point{post.score !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </article>

    {#if post.body}
      <div class="post-body">{post.body}</div>
    {/if}
  </div>
{/if}
