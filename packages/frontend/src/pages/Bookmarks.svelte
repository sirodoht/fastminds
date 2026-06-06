<script>
  import { onMount } from "svelte";
  import Link from "../router/Link.svelte";
  import { api } from "../lib/api.js";

  let bookmarks = $state([]);
  let loading = $state(true);

  async function fetchBookmarks() {
    loading = true;
    try {
      const data = await api("/api/bookmarks");
      bookmarks = data.bookmarks;
    } catch {
      bookmarks = [];
    } finally {
      loading = false;
    }
  }

  onMount(async () => {
    await fetchBookmarks();
  });

  async function removeBookmark(postId) {
    try {
      await api(`/api/bookmarks/${postId}`, { method: "DELETE" });
      bookmarks = bookmarks.filter((b) => b.id !== postId);
    } catch (err) {
      alert(err.message || "Failed to remove bookmark");
    }
  }
</script>

{#if loading}
  <div class="panel">
    <div class="panel-body" style="text-align:center;padding:40px;color:var(--text-muted)">
      Loading bookmarks…
    </div>
  </div>
{:else}
  {#each bookmarks as post (post.id)}
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
        </div>
      </div>
      <div class="post-actions-col">
        <button
          class="bookmark-btn active"
          title="Remove bookmark"
          onclick={() => removeBookmark(post.id)}
        >
          ★
        </button>
      </div>
    </article>
  {:else}
    <div class="panel">
      <div class="panel-body" style="text-align:center;padding:40px;color:var(--text-muted)">
        No bookmarks yet.
      </div>
    </div>
  {/each}
{/if}

<style>
  .post {
    display: flex;
    align-items: center;
  }
  .post-main {
    flex: 1;
    min-width: 0;
  }
  .post-actions-col {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 12px;
    border-left: 1px solid var(--border);
    min-height: 60px;
  }
  .bookmark-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.2rem;
    color: var(--text-meta);
    padding: 4px 8px;
    line-height: 1;
    transition: color 0.15s;
  }
  .bookmark-btn:hover {
    color: var(--orange);
  }
  .bookmark-btn.active {
    color: var(--orange);
  }
  .bookmark-btn.active:hover {
    color: var(--text-meta);
  }
</style>
