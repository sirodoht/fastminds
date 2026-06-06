<script>
import { onDestroy, onMount } from "svelte";
import { api } from "../lib/api.js";
import { restoreSession, user } from "../lib/stores.js";
import Link from "../router/Link.svelte";

let { currentPath } = $props();

let conversations = $state([]);
let loading = $state(true);
let error = $state("");
let socket;

let activeId = $derived.by(() => {
  const match = currentPath.match(/^\/conversations\/([^/]+)$/);
  return match ? match[1] : null;
});

function connectSocket() {
  const token = localStorage.getItem("token");
  if (!token) return;

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  socket = new WebSocket(`${protocol}//${window.location.host}/ws/messages?token=${encodeURIComponent(token)}`);

  socket.addEventListener("message", (event) => {
    const payload = JSON.parse(event.data);
    if (payload.type !== "conversation:message:new") return;

    const msg = payload.message;

    // Refetch conversation list to update preview
    api("/api/conversations").then((data) => {
      conversations = data.conversations;
    }).catch(() => {});
  });
}

onMount(async () => {
  if (!$user && localStorage.getItem("token")) {
    await restoreSession();
  }

  if (!$user) {
    return;
  }

  try {
    const data = await api("/api/conversations");
    conversations = data.conversations;
    connectSocket();
  } catch (err) {
    error = err.message;
  } finally {
    loading = false;
  }
});

onDestroy(() => {
  socket?.close();
});
</script>

<div class="messages-sidebar">
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
          class="conversation-row {conversation.id === activeId ? 'active' : ''}"
        >
          <div class="row-title">{conversation.postTitle}</div>

          {#if conversation.lastBody}
            <div class="row-preview">{conversation.lastBody}</div>
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
  .conversation-row {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--border);
    text-decoration: none;
    color: inherit;
    transition: background 0.15s;
    cursor: pointer;
  }
  .conversation-row:hover,
  .conversation-row.active {
    background: var(--bg-secondary);
  }
  .row-title {
    font-weight: 600;
    font-size: 0.9rem;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .row-preview {
    font-size: 0.8rem;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
