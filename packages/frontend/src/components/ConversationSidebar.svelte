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

  let activeUsername = $derived.by(() => {
    const match = currentPath.match(/^\/messages\/([^/]+)$/);
    return match ? match[1] : null;
  });

  function connectSocket() {
    const token = localStorage.getItem("token");
    if (!token) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    socket = new WebSocket(`${protocol}//${window.location.host}/ws/messages?token=${encodeURIComponent(token)}`);

    socket.addEventListener("message", (event) => {
      const payload = JSON.parse(event.data);
      if (payload.type !== "message:new") return;

      const message = payload.message;
      const otherUsername =
        message.sender === $user.username
          ? message.recipient
          : message.sender;

      conversations = [
        {
          id: message.id,
          body: message.body,
          created_at: message.created_at,
          other_username: otherUsername,
        },
        ...conversations.filter((conversation) => conversation.other_username !== otherUsername),
      ];
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
      const data = await api("/api/messages/conversations");
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
      No private messages yet.
    </div>
  {:else}
    <div class="conversation-list">
      {#each conversations as conversation (conversation.id)}
        <Link
          href="/messages/{conversation.other_username}"
          class="conversation-row {conversation.other_username === activeUsername ? 'active' : ''}"
        >
          <strong>{conversation.other_username}</strong>
          <span>{conversation.body}</span>
        </Link>
      {/each}
    </div>
  {/if}
</div>
