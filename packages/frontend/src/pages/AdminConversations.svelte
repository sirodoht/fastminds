<script>
  import { onMount } from "svelte";
  import Link from "../router/Link.svelte";
  import { api } from "../lib/api.js";
  import { navigate } from "../router/index.js";

  let conversations = $state([]);
  let loading = $state(true);
  let error = $state("");
  let page = $state(1);
  let total = $state(0);
  let limit = $state(20);

  async function fetchConversations() {
    loading = true;
    error = "";
    try {
      const data = await api(`/api/admin/conversations?page=${page}`);
      conversations = data.conversations;
      total = data.total;
      limit = data.limit;
      page = data.page;
    } catch (err) {
      error = err.message || "Failed to load conversations.";
    } finally {
      loading = false;
    }
  }

  onMount(fetchConversations);

  let hasNext = $derived(page * limit < total);
  let hasPrev = $derived(page > 1);
</script>

{#if loading}
  <div class="panel">
    <div class="panel-body" style="text-align:center;padding:40px;color:var(--text-muted)">
      Loading conversations…
    </div>
  </div>
{:else if error}
  <div class="panel">
    <div class="panel-body" style="color:var(--orange)">{error}</div>
  </div>
{:else}
  <div class="panel">
    <div class="panel-header" style="display:flex;justify-content:space-between;align-items:center">
      <span>All Conversations</span>
      <span style="font-size:0.8rem;font-weight:400">{total} total</span>
    </div>
    <div class="panel-body" style="padding:0">
      {#if conversations.length === 0}
        <div style="padding:24px;text-align:center;color:var(--text-muted)">
          No conversations yet.
        </div>
      {:else}
        <div class="admin-list">
          {#each conversations as conversation (conversation.id)}
            <div class="admin-row">
              <div class="admin-row-main">
                <div class="admin-users">
                  <a href="/u/{conversation.initiatorUsername}" onclick={(e) => { e.preventDefault(); navigate(`/u/${conversation.initiatorUsername}`); }}>u/{conversation.initiatorUsername}</a>
                  <span class="arrow">→</span>
                  <a href="/u/{conversation.recipientUsername}" onclick={(e) => { e.preventDefault(); navigate(`/u/${conversation.recipientUsername}`); }}>u/{conversation.recipientUsername}</a>
                </div>
                <div class="admin-content">
                  <a class="admin-title" href="/admin/conversations/{conversation.id}" onclick={(e) => { e.preventDefault(); navigate(`/admin/conversations/${conversation.id}`); }}>{conversation.postTitle}</a>
                  {#if conversation.lastBody}
                    <span class="admin-preview">{conversation.lastBody}</span>
                  {/if}
                </div>
              </div>
              <div class="admin-meta">
                <span class="admin-count">{conversation.messageCount} messages</span>
                <span class="admin-date">{new Date(conversation.createdAt).toLocaleDateString()}</span>
                {#if conversation.lastCreatedAt}
                  <span class="admin-date">last {new Date(conversation.lastCreatedAt).toLocaleDateString()}</span>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}

      {#if total > limit}
        <div class="pagination" style="border-top:1px solid var(--border);margin-top:0;border-radius:0">
          <button disabled={!hasPrev} onclick={() => { page--; fetchConversations(); }}>Previous</button>
          <span class="page-info">Page {page} of {Math.ceil(total / limit)}</span>
          <button disabled={!hasNext} onclick={() => { page++; fetchConversations(); }}>Next</button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .admin-list {
    display: flex;
    flex-direction: column;
  }
  .admin-row {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
    font-size: 0.8rem;
  }
  .admin-row:last-child {
    border-bottom: none;
  }
  .admin-row-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .admin-users {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--text-muted);
    flex-wrap: wrap;
  }
  .admin-users a {
    color: var(--text-muted);
    text-decoration: none;
  }
  .admin-users a:hover {
    text-decoration: underline;
    color: var(--text);
  }
  .arrow {
    color: var(--text-meta);
  }
  .admin-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .admin-title {
    font-weight: 600;
    color: var(--text);
    text-decoration: none;
  }
  .admin-title:hover {
    text-decoration: underline;
  }
  .admin-preview {
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .admin-meta {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
    flex-shrink: 0;
    white-space: nowrap;
  }
  .admin-count {
    font-size: 0.75rem;
    background: var(--blue-light);
    color: var(--text);
    padding: 1px 5px;
    border-radius: 3px;
  }
  .admin-date {
    font-size: 0.75rem;
    color: var(--text-meta);
  }
</style>
