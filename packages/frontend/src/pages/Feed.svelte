<script>
  import { onMount } from "svelte";
  import Link from "../router/Link.svelte";
  import { api } from "../lib/api.js";

  let { params } = $props();

  let posts = $state([]);
  let page = $state(1);
  let total = $state(0);
  let limit = $state(20);
  let loading = $state(true);

  async function fetchPosts(p) {
    loading = true;
    try {
      const data = await api(`/api/posts?page=${p}`);
      posts = data.posts;
      page = data.page;
      total = data.total;
      limit = data.limit;
    } catch {
      posts = [];
    } finally {
      loading = false;
    }
  }

  onMount(async () => {
    await fetchPosts(1);
  });

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

  let hasNext = $derived(page * limit < total);
  let hasPrev = $derived(page > 1);
</script>

{#if loading}
  <div class="panel">
    <div class="panel-body" style="text-align:center;padding:40px;color:var(--text-muted)">
      Loading posts…
    </div>
  </div>
{:else}
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
          <Link href="/posts/{post.id}">{post.title}</Link>
        </div>
        <div class="post-meta">
          <Link href="/profile/{post.author}">{post.author}</Link>
          <span class="separator">|</span>
          <span>{post.score} point{post.score !== 1 ? 's' : ''}</span>
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

  {#if total > limit}
    <div class="pagination">
      <button disabled={!hasPrev} onclick={() => fetchPosts(page - 1)}>Previous</button>
      <span class="page-info">Page {page} of {Math.ceil(total / limit)}</span>
      <button disabled={!hasNext} onclick={() => fetchPosts(page + 1)}>Next</button>
    </div>
  {/if}
{/if}
