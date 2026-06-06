<script>
  import { onMount } from "svelte";
  import { api } from "../lib/api.js";
  import { navigate } from "../router/index.js";

  let { params } = $props();

  let conversation = $state(null);
  let messages = $state([]);
  let loading = $state(true);
  let error = $state("");

  async function fetchConversation() {
    try {
      const data = await api(`/api/admin/conversations/${params.id}`);
      conversation = data.conversation;
      messages = data.messages;
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  onMount(fetchConversation);
</script>

<div class="panel">
  <div class="panel-header">
    {#if conversation}
      <a class="back-link" href="/admin/conversations" onclick={(e) => { e.preventDefault(); navigate('/admin/conversations'); }}>← All Conversations</a>
    {:else}
      Conversation
    {/if}
  </div>

  {#if loading}
    <div class="panel-body" style="color:var(--text-muted)">Loading conversation…</div>
  {:else if error}
    <div class="panel-body form-error">{error}</div>
  {:else if conversation}
    <div class="admin-conv-info">
      <div class="admin-conv-users">
        <a href="/u/{conversation.initiatorUsername}" onclick={(e) => { e.preventDefault(); navigate(`/u/${conversation.initiatorUsername}`); }}>u/{conversation.initiatorUsername}</a>
        <span class="arrow">→</span>
        <a href="/u/{conversation.recipientUsername}" onclick={(e) => { e.preventDefault(); navigate(`/u/${conversation.recipientUsername}`); }}>u/{conversation.recipientUsername}</a>
        <span class="admin-conv-meta">{conversation.messageCount} messages</span>
      </div>
      <a class="admin-conv-post" href="/posts/{conversation.postId}" onclick={(e) => { e.preventDefault(); navigate(`/posts/${conversation.postId}`); }}>{conversation.postTitle}</a>
    </div>

    <div class="admin-messages">
      {#each messages as message (message.id)}
        <div class="admin-msg">
          <div class="admin-msg-header">
            <a href="/u/{message.senderId}" onclick={(e) => { e.preventDefault(); navigate(`/u/${message.senderId}`); }}>u/{message.senderUsername || message.senderId}</a>
            <span class="admin-msg-time">{new Date(message.createdAt).toLocaleString()}</span>
          </div>
          <div class="admin-msg-body">{message.body}</div>
        </div>
      {:else}
        <div style="padding:24px;text-align:center;color:var(--text-muted)">No messages.</div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .back-link {
    color: var(--text);
    text-decoration: none;
    font-weight: 600;
  }
  .back-link:hover {
    text-decoration: underline;
  }
  .admin-conv-info {
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-card);
    font-size: 0.8rem;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .admin-conv-users {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
  }
  .admin-conv-users a {
    color: var(--text-muted);
    text-decoration: none;
  }
  .admin-conv-users a:hover {
    text-decoration: underline;
    color: var(--text);
  }
  .arrow {
    color: var(--text-meta);
  }
  .admin-conv-meta {
    margin-left: auto;
    font-size: 0.75rem;
    background: var(--blue-light);
    color: var(--text);
    padding: 1px 5px;
    border-radius: 3px;
  }
  .admin-conv-post {
    font-weight: 600;
    color: var(--text);
    text-decoration: none;
  }
  .admin-conv-post:hover {
    text-decoration: underline;
  }
  .admin-messages {
    display: flex;
    flex-direction: column;
  }
  .admin-msg {
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
    font-size: 0.8rem;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .admin-msg:last-child {
    border-bottom: none;
  }
  .admin-msg-header {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .admin-msg-header a {
    color: var(--text-muted);
    text-decoration: none;
    font-weight: 600;
  }
  .admin-msg-header a:hover {
    text-decoration: underline;
    color: var(--text);
  }
  .admin-msg-time {
    color: var(--text-meta);
    font-size: 0.75rem;
    margin-left: auto;
  }
  .admin-msg-body {
    color: var(--text);
    white-space: pre-wrap;
    word-break: break-word;
  }
</style>
