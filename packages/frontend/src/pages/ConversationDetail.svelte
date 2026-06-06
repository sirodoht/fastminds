<script>
import { onDestroy, onMount, tick } from "svelte";
import { api } from "../lib/api.js";
import { refreshNotificationUnreadCount, restoreSession, user } from "../lib/stores.js";
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

let feedbackLabels = $state([]);
let feedbackThumbs = $state(0);
let feedbackSubmitting = $state(false);
let feedbackError = $state("");
let feedbackSaveStatus = $state("");
let hasExistingFeedback = $state(false);
let feedbackCollapsed = $state(false);

let feedbackDebounceTimer = null;
let feedbackInitialLoad = true;

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

    // Fetch existing feedback if conversation is revealed
    if (conversation.revealed) {
      try {
        const feedbackData = await api(`/api/conversations/${params.id}/feedback`);
        if (feedbackData.feedback) {
          // Filter out labels that are no longer valid
          const validLabels = (feedbackData.feedback.labels || []).filter((l) =>
            availableLabels.includes(l)
          );
          feedbackLabels = validLabels;
          feedbackThumbs = feedbackData.feedback.thumbs ?? 0;
          hasExistingFeedback = true;
        } else {
          hasExistingFeedback = false;
        }
      } catch {
        // Ignore feedback fetch errors
      }
    }
    // After initial load, enable auto-save watcher
    feedbackInitialLoad = false;
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
  await refreshNotificationUnreadCount();
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

const availableLabels = [
  "Insightful", "Curious", "Kind", "Challenging",
  "AI", "Jerk", "Dogmatic", "Bad Faith", "Rambling",
  "Weird", "Contrarian",
];

function toggleLabel(label) {
  if (feedbackLabels.includes(label)) {
    feedbackLabels = feedbackLabels.filter((l) => l !== label);
  } else {
    feedbackLabels = [...feedbackLabels, label];
  }
}

async function saveFeedback() {
  if (feedbackLabels.length === 0) return;
  feedbackSubmitting = true;
  feedbackError = "";
  feedbackSaveStatus = "saving";

  try {
    await api(`/api/conversations/${params.id}/feedback`, {
      method: "POST",
      body: JSON.stringify({
        labels: feedbackLabels,
        thumbs: feedbackThumbs || undefined,
      }),
    });
    hasExistingFeedback = true;
    feedbackSaveStatus = "saved";
    setTimeout(() => {
      if (feedbackSaveStatus === "saved") feedbackSaveStatus = "";
    }, 2000);
  } catch (err) {
    feedbackError = err.message;
    feedbackSaveStatus = "error";
  } finally {
    feedbackSubmitting = false;
  }
}

$effect(() => {
  const labels = feedbackLabels;
  const thumbs = feedbackThumbs;

  if (feedbackInitialLoad) return;

  if (feedbackDebounceTimer) clearTimeout(feedbackDebounceTimer);
  feedbackSaveStatus = "";
  feedbackDebounceTimer = setTimeout(() => {
    saveFeedback();
  }, 500);

  return () => {
    if (feedbackDebounceTimer) clearTimeout(feedbackDebounceTimer);
  };
});
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
      <Link href="/posts/{conversation.postId}" class="btn-secondary" style="font-size:0.8rem;padding:4px 10px;white-space:nowrap">
        View post
      </Link>
    </div>

    {#if conversation.postBody}
      <div class="post-context">
        <div class="post-context-body">{conversation.postBody}</div>
      </div>
    {/if}

    {#if !conversation.revealed}
      <div class="blind-banner">
        <p>Identities are hidden until 10 messages have been exchanged.</p>
        <p>{conversation.messageCount} / 10 messages</p>
      </div>
    {/if}

    {#if conversation.revealed}
      <div class="feedback-panel">
        <button
          type="button"
          class="feedback-toggle"
          onclick={() => feedbackCollapsed = !feedbackCollapsed}
        >
          <span>Feedback</span>
          <svg class="feedback-toggle-arrow" class:collapsed={feedbackCollapsed} viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 15 12 9 18 15"></polyline>
          </svg>
        </button>

        {#if !feedbackCollapsed}
          <div class="feedback-labels">
            {#each availableLabels as label}
              <button
                type="button"
                class="feedback-label-btn"
                class:selected={feedbackLabels.includes(label)}
                onclick={() => toggleLabel(label)}
              >
                {label}
              </button>
            {/each}
          </div>

          <div class="feedback-thumbs">
            <span class="feedback-thumbs-label">Overall:</span>
            <button type="button" class="thumb-btn" class:active={feedbackThumbs === -2} onclick={() => feedbackThumbs = -2}>--</button>
            <button type="button" class="thumb-btn" class:active={feedbackThumbs === -1} onclick={() => feedbackThumbs = -1}>-</button>
            <button type="button" class="thumb-btn" class:active={feedbackThumbs === 0} onclick={() => feedbackThumbs = 0}>0</button>
            <button type="button" class="thumb-btn" class:active={feedbackThumbs === 1} onclick={() => feedbackThumbs = 1}>+</button>
            <button type="button" class="thumb-btn" class:active={feedbackThumbs === 2} onclick={() => feedbackThumbs = 2}>++</button>

            <span class="feedback-status">
              {#if feedbackSaveStatus === "saving"}
                <span class="status-saving">Saving…</span>
              {:else if feedbackSaveStatus === "saved"}
                <span class="status-saved">Saved</span>
              {:else if feedbackError}
                <span class="status-error">Failed</span>
              {/if}
            </span>
          </div>
        {/if}
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
  .post-context {
    padding: 12px 16px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
  }
  .post-context-body {
    font-size: 0.9rem;
    color: var(--text-primary);
    line-height: 1.5;
    white-space: pre-wrap;
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
  .feedback-panel {
    padding: 8px 16px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-secondary);
  }
  .feedback-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 8px 0;
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .feedback-toggle:hover {
    color: var(--text-primary);
  }
  .feedback-toggle-arrow {
    transition: transform 0.2s ease;
    transform: rotate(0deg);
  }
  .feedback-toggle-arrow.collapsed {
    transform: rotate(180deg);
  }
  .feedback-labels {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
    margin-bottom: 12px;
  }
  .feedback-label-btn {
    padding: 4px 10px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.15s;
  }
  .feedback-label-btn:hover {
    border-color: var(--accent);
  }
  .feedback-label-btn.selected {
    background: var(--accent);
    color: white;
    border-color: var(--accent);
  }
  .feedback-thumbs {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }
  .feedback-thumbs-label {
    font-size: 0.85rem;
    font-weight: 500;
    margin-right: 4px;
  }
  .thumb-btn {
    padding: 4px 10px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 0.85rem;
    cursor: pointer;
  }
  .thumb-btn.active {
    background: var(--accent);
    color: white;
    border-color: var(--accent);
  }
  .feedback-status {
    margin-left: auto;
    font-size: 0.75rem;
  }
  .status-saving {
    color: var(--text-muted);
  }
  .status-saved {
    color: #16a34a;
  }
  .status-error {
    color: #dc2626;
  }
</style>
