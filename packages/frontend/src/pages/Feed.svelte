<script>
  import { onMount } from "svelte";
  import Link from "../router/Link.svelte";
  import { api } from "../lib/api.js";
  import { user } from "../lib/stores.js";

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
      <div class="post-main">
        <div class="post-title">
          <Link href="/posts/{post.id}">{post.title}</Link>
        </div>
        <div class="post-meta">
          <span>{new Date(post.created_at).toLocaleString()}</span>
          {#if post.archived_at}
            <span class="archived-badge">Archived</span>
          {/if}
          {#if $user && post.author_id === $user.id}
            <span class="own-badge" title="Your post"></span>
          {/if}
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
