<script>
import { onMount } from "svelte";
import { api } from "../lib/api.js";
import { refreshNotificationUnreadCount, restoreSession, user } from "../lib/stores.js";
import { navigate } from "../router/index.js";
import Link from "../router/Link.svelte";

let conversations = $state([]);
let loading = $state(true);
let error = $state("");

onMount(async () => {
  if (!$user && localStorage.getItem("token")) {
    await restoreSession();
  }

  if (!$user) {
    navigate("/login");
    return;
  }

  try {
    const data = await api("/api/conversations");
    conversations = data.conversations;
    await refreshNotificationUnreadCount();
  } catch (err) {
    error = err.message;
  } finally {
    loading = false;
  }
});
</script>

<div class="panel">
  <div class="panel-header">Conversations</div>

  {#if loading}
    <div class="panel-body" style="color:var(--text-muted)">Loading conversations…</div>
  {:else if error}
    <div class="panel-body form-error">{error}</div>
  {:else if conversations.length === 0}
    <div class="panel-body" style="color:var(--text-muted)">
      No conversations yet.
    </div>
  {:else}
    <div class="conversation-list">
      {#each conversations as conversation (conversation.id)}
        <Link
          href="/conversations/{conversation.id}"
          class="conversation-row"
        >
          <div class="conversation-title">{conversation.postTitle}</div>
          {#if conversation.otherUsername}
            <div class="conversation-username">u/{conversation.otherUsername}</div>
          {/if}
          {#if conversation.lastBody}
            <div class="conversation-preview">{conversation.lastBody}</div>
          {/if}
        </Link>
      {/each}
    </div>
  {/if}
</div>

<style>
  .conversation-list {
    display: flex;
    flex-direction: column;
  }
  :global(.conversation-row) {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    text-decoration: none;
    color: inherit;
    transition: background 0.15s;
  }
  :global(.conversation-row:hover) {
    background: var(--bg-secondary);
  }
  .conversation-title {
    font-weight: 600;
    color: var(--text-primary);
  }
  .conversation-username {
    font-size: 0.8rem;
    color: var(--text-muted);
  }
  .conversation-preview {
    font-size: 0.85rem;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
