<script>
import { onDestroy, onMount, tick } from "svelte";
import { api } from "../lib/api.js";
import { restoreSession, user } from "../lib/stores.js";
import { navigate } from "../router/index.js";
import Link from "../router/Link.svelte";

let { params } = $props();

let conversation = $state(null);
let messages = $state([]);
let loading = $state(true);
let error = $state("");
let draft = $state("");
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

async function fetchConversation() {
  try {
    const data = await api(`/api/conversations/${params.id}`);
    conversation = data.conversation;
    messages = data.messages;
  } catch (err) {
    error = err.message;
  } finally {
    loading = false;
  }
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

    if (payload.type !== "conversation:message:new") return;

    const msg = payload.message;
    if (msg.conversationId !== params.id) return;

    // Append message with proper formatting
    messages = [...messages, {
      id: msg.id,
      body: msg.body,
      createdAt: msg.created_at,
      senderId: msg.senderId,
      senderUsername: null,
      isMine: msg.senderId === $user?.id,
    }];

    // If this message triggers reveal, or if already revealed, refetch to get usernames
    if (messages.length >= 10 || conversation?.revealed) {
      await fetchConversation();
    }

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

  await fetchConversation();
  connectSocket();

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
    type: "conversation:message:create",
    conversationId: params.id,
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
  {#if loading}
    <div class="panel-body" style="color:var(--text-muted)">Loading conversation…</div>
  {:else if error && !conversation}
    <div class="panel-body form-error">{error}</div>
  {:else if conversation}
    <div class="panel-header conversation-header">
      <div>
        <span class="post-title">{conversation.postTitle}</span>
      </div>
      <Link href="/posts/{conversation.postId}" class="btn-secondary" style="font-size:0.8rem;padding:4px 10px">
        View post
      </Link>
    </div>

    {#if !conversation.revealed}
      <div class="blind-banner">
        <p>Identities are hidden until 10 messages have been exchanged.</p>
        <p>{conversation.messageCount} / 10 messages</p>
      </div>
    {/if}

    <div class="message-thread" bind:this={threadElement}>
      {#each messages as message (message.id)}
        <div class="message-group" class:mine={message.isMine}>
          {#if conversation.revealed && message.senderUsername}
            <div class="message-author">{message.senderUsername}</div>
          {:else}
            <div class="message-author anonymous">{message.isMine ? "You" : "Other"}</div>
          {/if}
          <div class="message-bubble">
            <div class="message-body">{message.body}</div>
          </div>
        </div>
      {:else}
        <div class="empty-thread">No messages yet.</div>
      {/each}
    </div>

    <form class="message-composer" onsubmit={sendMessage}>
      <textarea
        bind:value={draft}
        onkeydown={handleComposerKeydown}
        placeholder="Write a message…"
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

<style>
  .conversation-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .post-title {
    font-weight: 600;
  }
  .blind-banner {
    padding: 8px 12px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
    text-align: center;
    font-size: 0.85rem;
    color: var(--text-muted);
  }
  .blind-banner p {
    margin: 0;
  }
  .message-thread {
    padding: 12px;
  }
  .message-group {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    margin-bottom: 8px;
    width: 100%;
  }
  .message-group.mine {
    align-items: flex-end;
  }
  .message-author {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-muted);
    margin-bottom: 2px;
    padding: 0 4px;
  }
  .message-author.anonymous {
    font-style: italic;
  }
  .message-bubble {
    max-width: 75%;
    padding: 8px 12px;
    border-radius: 12px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border);
  }
  .message-group.mine .message-bubble {
    background: var(--accent);
    color: white;
    border-color: var(--accent);
    margin-left: auto;
  }
  .message-body {
    white-space: pre-wrap;
    word-break: break-word;
  }
  .empty-thread {
    padding: 40px;
    text-align: center;
    color: var(--text-muted);
  }
  .message-composer {
    padding: 12px 16px;
    border-top: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .message-composer textarea {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    font: inherit;
    resize: vertical;
  }
  .message-composer-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .socket-status {
    font-size: 0.8rem;
    color: var(--text-muted);
  }
  .socket-status.connected {
    color: #22c55e;
  }
</style>
