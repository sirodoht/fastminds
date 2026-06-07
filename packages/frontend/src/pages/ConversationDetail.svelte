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
let textareaElement = $state();
let reconnectTimer = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 30000;

let feedbackLabels = $state([]);
let feedbackThumbs = $state(0);
let feedbackSubmitting = $state(false);
let feedbackError = $state("");
let feedbackSaveStatus = $state("");
let hasExistingFeedback = $state(false);
let feedbackCollapsed = $state(true);

let feedbackDebounceTimer = null;
let feedbackInitialLoad = true;

let replyingTo = $state(null);

function startReply(message) {
  replyingTo = { id: message.id, body: message.body, senderUsername: message.senderUsername, isMine: message.isMine };
}

function cancelReply() {
  replyingTo = null;
}

$effect(() => {
  if (replyingTo && textareaElement) {
    textareaElement.focus();
  }
});

function getReplyPreview(replyToId) {
  const msg = messages.find((m) => m.id === replyToId);
  if (!msg) return null;
  return {
    body: msg.body,
    senderUsername: msg.senderUsername,
    isMine: msg.isMine,
  };
}

// Swipe gesture state
let swipeState = $state({ active: false, currentX: 0, startX: 0, targetId: null });
const SWIPE_THRESHOLD = 60;

function onBubbleTouchStart(e, messageId) {
  const touch = e.touches[0];
  swipeState = {
    active: true,
    startX: touch.clientX,
    currentX: 0,
    targetId: messageId,
  };
}

function onBubbleTouchMove(e) {
  if (!swipeState.active) return;
  const touch = e.touches[0];
  const deltaX = touch.clientX - swipeState.startX;
  // Only allow rightward swipe
  if (deltaX > 0) {
    swipeState = { ...swipeState, currentX: Math.min(deltaX, 100) };
  }
}

function onBubbleTouchEnd(e, message) {
  if (!swipeState.active) return;
  const didSwipe = swipeState.currentX >= SWIPE_THRESHOLD;
  swipeState = { active: false, currentX: 0, startX: 0, targetId: null };
  if (didSwipe) {
    startReply(message);
  }
}

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

  if (socket) {
    try { socket.close(); } catch {}
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  socket = new WebSocket(`${protocol}//${window.location.host}/ws/messages?token=${encodeURIComponent(token)}`);

  socket.addEventListener("open", () => {
    connected = true;
    reconnectAttempts = 0;
  });

  socket.addEventListener("error", () => {
    try { socket.close(); } catch {}
  });

  socket.addEventListener("close", () => {
    connected = false;
    if (reconnectTimer) return;
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
    reconnectAttempts++;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connectSocket();
    }, delay);
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
      replyTo: msg.replyTo || null,
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
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  try { socket?.close(); } catch {}
});

function sendMessage(e) {
  e.preventDefault();

  const body = draft.trim();
  if (!body || !socket || socket.readyState !== WebSocket.OPEN) return;

  const payload = {
    type: "conversation:message:create",
    conversationId: params.id,
    body,
  };
  if (replyingTo) {
    payload.replyTo = replyingTo.id;
  }

  socket.send(JSON.stringify(payload));

  draft = "";
  replyingTo = null;
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

    {#if !conversation.revealed}
      <div class="blind-banner">
        <p>Identities are hidden until 10 messages have been exchanged.</p>
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
        {@const isSwiping = swipeState.active && swipeState.targetId === message.id}
        <div class="message-group" class:mine={message.isMine}>
          {#if conversation.revealed && message.senderUsername}
            <div class="message-author">{message.senderUsername}</div>
          {:else}
            <div class="message-author anonymous">{message.isMine ? "You" : "Other"}</div>
          {/if}
          <div
            class="message-bubble"
            class:swiping={isSwiping}
            style={isSwiping ? `transform: translateX(${message.isMine ? -swipeState.currentX : swipeState.currentX}px)` : ""}
            title="Double-click to reply"
            ontouchstart={(e) => onBubbleTouchStart(e, message.id)}
            ontouchmove={onBubbleTouchMove}
            ontouchend={(e) => onBubbleTouchEnd(e, message)}
            ondblclick={() => startReply(message)}
            role="button"
            tabindex="0"
          >
            {#if message.replyTo}
              {@const preview = getReplyPreview(message.replyTo)}
              {#if preview}
                <div class="message-reply-preview">
                  <div class="message-reply-bar"></div>
                  <div class="message-reply-content">
                    <span class="message-reply-author">{preview.isMine ? "You" : (preview.senderUsername || "Other")}</span>
                    <span class="message-reply-body">{preview.body}</span>
                  </div>
                </div>
              {/if}
            {/if}
            <div class="message-body">{message.body}</div>
            {#if isSwiping}
              <div class="swipe-reply-indicator" class:mine={message.isMine}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="9 17 4 12 9 7"></polyline>
                  <path d="M20 18v-2a4 4 0 0 0-4-4H4"></path>
                </svg>
              </div>
            {/if}
          </div>
        </div>
      {:else}
        <div class="empty-thread">No messages yet.</div>
      {/each}
    </div>

    <form class="message-composer" onsubmit={sendMessage}>
      {#if replyingTo}
        <div class="composer-reply-preview">
          <div class="composer-reply-bar"></div>
          <div class="composer-reply-content">
            <span class="composer-reply-label">Replying to {replyingTo.isMine ? "yourself" : (replyingTo.senderUsername || "Other")}</span>
            <span class="composer-reply-body">{replyingTo.body}</span>
          </div>
          <button type="button" class="composer-reply-cancel" onclick={cancelReply} aria-label="Cancel reply">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      {/if}
      <textarea
        bind:this={textareaElement}
        bind:value={draft}
        onkeydown={handleComposerKeydown}
        placeholder="Write a message…"
        rows="2"
      ></textarea>
      <div class="message-composer-footer">
        {#if !connected}
          <span class="socket-status">Connecting…</span>
        {:else}
          <span class="composer-hint">Press enter to send</span>
        {/if}
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
    font-weight: 400;
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
  .message-reply-preview {
    display: flex;
    gap: 6px;
    margin-bottom: 6px;
    opacity: 0.8;
    font-size: 0.8rem;
  }
  .message-reply-bar {
    width: 3px;
    background: var(--accent);
    border-radius: 2px;
    flex-shrink: 0;
  }
  .message-reply-content {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .message-reply-author {
    font-weight: 600;
    font-size: 0.75rem;
    color: var(--text-muted);
    margin-bottom: 1px;
  }
  .message-reply-body {
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.3;
  }
  .message-group.mine .message-reply-bar {
    background: rgba(255,255,255,0.85);
  }
  .message-group.mine .message-reply-author,
  .message-group.mine .message-reply-body {
    color: rgba(255,255,255,0.9);
  }
  .message-bubble.swiping {
    transition: none;
    position: relative;
  }
  .message-bubble:not(.swiping) {
    transition: transform 0.2s ease-out;
  }
  .swipe-reply-indicator {
    position: absolute;
    left: -36px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--accent);
    opacity: 0.8;
  }
  .swipe-reply-indicator.mine {
    left: auto;
    right: -36px;
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
    border-radius: 3px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    font: inherit;
    resize: vertical;
  }
  .message-composer-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }
  .socket-status {
    font-size: 0.8rem;
    color: var(--text-muted);
  }
  .composer-hint {
    font-size: 0.75rem;
    color: var(--text-meta);
    font-style: italic;
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
  .composer-reply-preview {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 6px;
    margin-bottom: 4px;
  }
  .composer-reply-bar {
    width: 3px;
    align-self: stretch;
    background: var(--accent);
    border-radius: 2px;
    flex-shrink: 0;
  }
  .composer-reply-content {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
  }
  .composer-reply-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-muted);
  }
  .composer-reply-body {
    font-size: 0.8rem;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.3;
  }
  .composer-reply-cancel {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
  }
  .composer-reply-cancel:hover {
    background: var(--border);
  }
</style>
