<script>
  import { onDestroy, onMount, tick } from "svelte";
  import { api } from "../lib/api.js";
  import { restoreSession, user } from "../lib/stores.js";
  import { navigate } from "../router/index.js";
  import Link from "../router/Link.svelte";

  let { params } = $props();

  let recipient = $derived(params.username);
  let thread = $state([]);
  let draft = $state("");
  let loading = $state(true);
  let error = $state("");
  let connected = $state(false);
  let socket;
  let threadElement = $state();

  async function scrollToBottom(behavior = "smooth") {
    await tick();
    threadElement?.scrollTo({
      top: threadElement.scrollHeight,
      behavior,
    });
  }

  function connectSocket() {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    socket = new WebSocket(`${protocol}//${window.location.host}/ws/messages?token=${encodeURIComponent(token)}`);

    socket.addEventListener("open", () => {
      connected = true;
    });

    socket.addEventListener("close", () => {
      connected = false;
    });

    socket.addEventListener("message", async (event) => {
      const payload = JSON.parse(event.data);

      if (payload.type === "error") {
        error = payload.error;
        return;
      }

      if (payload.type !== "message:new") return;

      const message = payload.message;
      const isCurrentThread =
        [message.sender, message.recipient].includes(recipient) &&
        [message.sender, message.recipient].includes($user.username);

      if (!isCurrentThread) return;

      thread = [...thread, message];
      await scrollToBottom();
    });
  }

  onMount(async () => {
    if (!$user && localStorage.getItem("token")) {
      await restoreSession();
    }

    if (!$user) {
      navigate("/login");
      return;
    }

    try {
      const data = await api(`/api/messages/${recipient}`);
      thread = data.messages;
      connectSocket();
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }

    if (!error) {
      await scrollToBottom("auto");
    }
  });

  onDestroy(() => {
    socket?.close();
  });

  function sendMessage(e) {
    e.preventDefault();

    const body = draft.trim();
    if (!body || !socket || socket.readyState !== WebSocket.OPEN) return;

    socket.send(JSON.stringify({
      type: "message:create",
      recipientUsername: recipient,
      body,
    }));
    draft = "";
    error = "";
  }

  function handleComposerKeydown(e) {
    if (e.key !== "Enter" || e.shiftKey) return;

    e.preventDefault();
    sendMessage(e);
  }
</script>

<div class="panel conversation-panel">
  <div class="panel-header conversation-header">
    <span>Conversation with {recipient}</span>
  </div>

  {#if loading}
    <div class="panel-body" style="color:var(--text-muted)">Loading conversation…</div>
  {:else if error && thread.length === 0}
    <div class="panel-body form-error">{error}</div>
  {:else}
    <div class="message-thread" bind:this={threadElement}>
      {#each thread as message (message.id)}
        <div class:mine={message.sender === $user.username} class="message-bubble">
          <div class="message-author">{message.sender}</div>
          <div class="message-body">{message.body}</div>
        </div>
      {:else}
        <div class="empty-thread">No messages yet. Start the conversation.</div>
      {/each}
    </div>

    <form class="message-composer" onsubmit={sendMessage}>
      <textarea
        bind:value={draft}
        onkeydown={handleComposerKeydown}
        placeholder="Write a private message…"
        rows="3"
      ></textarea>
      <div class="message-composer-footer">
        <span class="socket-status" class:connected={connected}>
          {connected ? "Live" : "Connecting…"}
        </span>
        <button type="submit" class="btn-primary" disabled={!draft.trim() || !connected}>
          Send
        </button>
      </div>
      {#if error}
        <p class="form-error">{error}</p>
      {/if}
    </form>
  {/if}
</div>
