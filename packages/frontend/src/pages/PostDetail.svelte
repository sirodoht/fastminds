<script>
import { onMount } from "svelte";
import { navigate } from "../router/index.js";
import Link from "../router/Link.svelte";
import { api } from "../lib/api.js";
import { user } from "../lib/stores.js";
import ReportModal from "../components/ReportModal.svelte";

let { params } = $props();

let post = $state(null);
let updates = $state([]);
let loading = $state(true);
let error = $state("");
let aiInsight = $state("");
let aiInsightLoading = $state(false);
let aiInsightError = $state("");
let aiInsightRefreshing = $state(false);
let aiInsightEditing = $state(false);
let aiInsightDraft = $state("");
let aiInsightSaving = $state(false);

let showComposer = $state(false);
let firstMessage = $state("");
let composerError = $state("");
let composerLoading = $state(false);
let reportOpen = $state(false);
let archiveLoading = $state(false);

async function fetchPost() {
  try {
    const data = await api(`/api/posts/${params.id}`);
    post = data.post;
  } catch (err) {
    error = err.message;
  }
}

async function toggleBookmark() {
  if (!post) return;
  if (!post.isBookmarked) {
    try {
      await api("/api/bookmarks", {
        method: "POST",
        body: JSON.stringify({ postId: post.id }),
      });
      post.isBookmarked = true;
    } catch (err) {
      alert(err.message || "Failed to bookmark");
    }
  } else {
    try {
      await api(`/api/bookmarks/${post.id}`, { method: "DELETE" });
      post.isBookmarked = false;
    } catch (err) {
      alert(err.message || "Failed to remove bookmark");
    }
  }
}

async function fetchUpdates() {
  try {
    const data = await api(`/api/posts/${params.id}/updates`);
    updates = data.updates;
  } catch {
    updates = [];
  }
}

async function fetchAiInsight() {
  aiInsight = "";
  aiInsightError = "";
  aiInsightLoading = true;

  try {
    const data = await api(`/api/posts/${params.id}/insight`);
    aiInsight = data.insight;
  } catch {
    aiInsightError = "AI insight unavailable.";
  } finally {
    aiInsightLoading = false;
  }
}

async function refreshAiInsight() {
  if (!post || aiInsightRefreshing) return;

  aiInsightError = "";
  aiInsightRefreshing = true;

  try {
    const data = await api(`/api/posts/${params.id}/insight/refresh`, {
      method: "POST",
    });
    aiInsight = data.insight;
  } catch (err) {
    aiInsightError = err.message || "AI insight unavailable.";
  } finally {
    aiInsightRefreshing = false;
  }
}

function startEditingAiInsight() {
  aiInsightDraft = aiInsight;
  aiInsightError = "";
  aiInsightEditing = true;
}

function cancelEditingAiInsight() {
  aiInsightDraft = "";
  aiInsightError = "";
  aiInsightEditing = false;
}

async function saveAiInsight() {
  if (!post || aiInsightSaving) return;

  if (!aiInsightDraft.trim()) {
    aiInsightError = "Insight is required.";
    return;
  }

  aiInsightError = "";
  aiInsightSaving = true;

  try {
    const data = await api(`/api/posts/${params.id}/insight`, {
      method: "PUT",
      body: JSON.stringify({ insight: aiInsightDraft.trim() }),
    });
    aiInsight = data.insight;
    aiInsightEditing = false;
    aiInsightDraft = "";
  } catch (err) {
    aiInsightError = err.message || "Failed to save insight.";
  } finally {
    aiInsightSaving = false;
  }
}

async function archivePost() {
  if (!post || archiveLoading) return;
  if (!confirm("Are you sure you want to archive this post? It will be hidden from the feed and no longer accept new conversations.")) return;
  archiveLoading = true;
  try {
    await api(`/api/posts/${post.id}/archive`, { method: "POST" });
    post.archived_at = new Date().toISOString();
  } catch (err) {
    alert(err.message || "Failed to archive post");
  } finally {
    archiveLoading = false;
  }
}

async function unarchivePost() {
  if (!post || archiveLoading) return;
  archiveLoading = true;
  try {
    await api(`/api/posts/${post.id}/unarchive`, { method: "POST" });
    post.archived_at = null;
  } catch (err) {
    alert(err.message || "Failed to unarchive post");
  } finally {
    archiveLoading = false;
  }
}

onMount(async () => {
  await fetchPost();
  await fetchUpdates();
  loading = false;
  if (post) {
    fetchAiInsight();
  }
});

async function startConversation(e) {
  e.preventDefault();
  composerError = "";

  if (!firstMessage.trim()) {
    composerError = "Please write a thoughtful response.";
    return;
  }

  if (firstMessage.trim().length < 20) {
    composerError = "First message should be substantial (at least 20 characters).";
    return;
  }

  composerLoading = true;
  try {
    const data = await api(`/api/conversations/from-post/${params.id}`, {
      method: "POST",
      body: JSON.stringify({ body: firstMessage.trim() }),
    });
    navigate(`/conversations/${data.conversation.id}`);
  } catch (err) {
    composerError = err.message;
  } finally {
    composerLoading = false;
  }
}

let isOwnPost = $derived($user && post && post.isMine);
let hasStartedConversation = $derived(post?.hasStartedConversation ?? false);
let canStartConversation = $derived($user && post && !post.archived_at && !isOwnPost && !hasStartedConversation && $user.emailVerified);
</script>

{#if loading}
  <div class="panel">
    <div class="panel-body" style="color:var(--text-muted)">Loading post…</div>
  </div>
{:else if error}
  <div class="not-found">
    <h1>404</h1>
    <p>{error}</p>
    <Link href="/" class="btn-primary">Go to Feed</Link>
  </div>
{:else if post}
  <div class="panel post-detail">
    <article class="post">
      <div class="post-main">
        <div class="post-title">{post.title}</div>
        <div class="post-meta">
          <span>{new Date(post.created_at).toLocaleString()}</span>
          {#if post.archived_at}
            <span class="archived-badge">Archived</span>
          {/if}
          {#if $user}
            <button
              class="bookmark-btn-inline"
              class:active={post.isBookmarked}
              title={post.isBookmarked ? "Remove bookmark" : "Bookmark"}
              onclick={toggleBookmark}
            >
              {post.isBookmarked ? "★" : "☆"}
            </button>
            {#if !isOwnPost}
              <button
                class="report-btn-inline"
                title="Report post"
                onclick={() => reportOpen = true}
              >
                ⚑
              </button>
            {/if}
          {/if}
        </div>
      </div>
    </article>

    {#if post.body}
      <div class="post-body">{post.body}</div>
    {/if}

    {#if aiInsightLoading || aiInsight || aiInsightError}
      <section class="ai-insight" aria-live="polite">
        <div class="ai-insight-header">
          <div class="ai-insight-label">Moderators' comments</div>
          {#if $user?.isAdmin}
            <div class="ai-insight-admin-actions">
              {#if aiInsight && !aiInsightEditing}
                <button
                  class="ai-insight-action"
                  type="button"
                  onclick={startEditingAiInsight}
                  disabled={aiInsightRefreshing || aiInsightLoading}
                >
                  Edit
                </button>
              {/if}
              <button
                class="ai-insight-action"
                type="button"
                onclick={refreshAiInsight}
                disabled={aiInsightRefreshing || aiInsightLoading || aiInsightEditing}
              >
                {aiInsightRefreshing ? "Refreshing…" : "Refresh"}
              </button>
            </div>
          {/if}
        </div>
        {#if aiInsightLoading}
          <div class="ai-insight-body muted">Generating insight…</div>
        {:else if aiInsightEditing}
          <div class="ai-insight-editor">
            <textarea
              bind:value={aiInsightDraft}
              rows="5"
              maxlength="1000"
              aria-label="Edit ways in"
            ></textarea>
            {#if aiInsightError}
              <div class="ai-insight-body muted">{aiInsightError}</div>
            {/if}
            <div class="ai-insight-editor-actions">
              <button
                class="btn-secondary"
                type="button"
                onclick={cancelEditingAiInsight}
                disabled={aiInsightSaving}
              >
                Cancel
              </button>
              <button
                class="btn-primary"
                type="button"
                onclick={saveAiInsight}
                disabled={aiInsightSaving}
              >
                {aiInsightSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        {:else if aiInsight}
          <div class="ai-insight-body">{aiInsight}</div>
        {:else if aiInsightError}
          <div class="ai-insight-body muted">{aiInsightError}</div>
        {/if}
      </section>
    {/if}

    {#if updates.length > 0}
      <div class="post-updates">
        {#each updates as update (update.id)}
          <div class="post-update">
            <div class="update-label">Update</div>
            <div class="post-body">{update.body}</div>
          </div>
        {/each}
      </div>
    {/if}

    <div class="post-actions">
      {#if canStartConversation}
        {#if !showComposer}
          <button class="btn-primary" onclick={() => showComposer = true}>
            Start a conversation
          </button>
        {:else}
          <form class="conversation-composer" onsubmit={startConversation}>
            <textarea
              bind:value={firstMessage}
              placeholder="Write a thoughtful response to this post…"
              rows="4"
            ></textarea>
            {#if composerError}
              <p class="form-error">{composerError}</p>
            {/if}
            <div class="composer-actions">
              <button type="submit" class="btn-primary" disabled={composerLoading}>
                {composerLoading ? "Starting…" : "Start conversation"}
              </button>
            </div>
          </form>
        {/if}
      {:else if post.archived_at}
        <p class="text-muted">This post is archived and no longer accepts new conversations.</p>
      {:else if hasStartedConversation}
        <p class="text-muted">
          You already started a <Link href="/conversations/{post.conversationId}">conversation</Link> on this post.
        </p>
      {:else if isOwnPost}
        {#if post.archived_at}
          <p class="text-muted">This post is archived and hidden from the feed.</p>
          <button class="btn-secondary" onclick={unarchivePost} disabled={archiveLoading}>
            {archiveLoading ? "Unarchiving…" : "Unarchive"}
          </button>
        {:else}
          <button class="btn-secondary" onclick={archivePost} disabled={archiveLoading}>
            {archiveLoading ? "Archiving…" : "Archive"}
          </button>
        {/if}
      {:else if $user && !$user.emailVerified}
        <p class="text-muted">Please verify your email to start a conversation.</p>
      {:else}
        <p class="text-muted"><Link href="/login">Log in</Link> to reply.</p>
      {/if}
    </div>
  </div>
{/if}

<ReportModal bind:open={reportOpen} targetType="post" targetId={params.id} />

<style>
  .ai-insight {
    padding: 14px 16px 16px;
    border-top: 1px solid var(--border);
    background: #fbfbfb;
  }
  .ai-insight-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 5px;
  }
  .ai-insight-label {
    color: var(--text-meta);
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .ai-insight-admin-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .ai-insight-action {
    padding: 2px 8px;
    border: 1px solid var(--border);
    border-radius: 3px;
    background: var(--white);
    color: var(--text-muted);
    cursor: pointer;
    font-size: 0.75rem;
    font-weight: 600;
  }
  .ai-insight-action:hover:not(:disabled) {
    border-color: #aaa;
    background: var(--bg);
  }
  .ai-insight-action:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .ai-insight-body {
    color: var(--text);
    font-size: 0.88rem;
    line-height: 1.6;
    white-space: pre-wrap;
  }
  .ai-insight-body.muted {
    color: var(--text-muted);
  }
  .ai-insight-editor {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .ai-insight-editor textarea {
    width: 100%;
    padding: 9px 10px;
    border: 1px solid var(--border);
    border-radius: 3px;
    background: var(--white);
    color: var(--text);
    font: inherit;
    resize: vertical;
  }
  .ai-insight-editor-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
  .post-updates {
    margin-top: 16px;
    padding: 16px;
    border-top: 1px solid var(--border);
  }
  .post-update + .post-update {
    margin-top: 12px;
  }
  .update-label {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    margin-bottom: 4px;
  }
  .post-actions {
    padding: 20px 16px;
    border-top: 1px solid var(--border);
  }
  .conversation-composer {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .conversation-composer textarea {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--border);
    background: var(--bg-secondary);
    color: var(--text-primary);
    font: inherit;
    resize: vertical;
  }
  .composer-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }
  .text-muted {
    color: var(--text-muted);
    font-size: 0.9rem;
  }
  .bookmark-btn-inline {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1rem;
    color: var(--text-meta);
    padding: 0 4px;
    margin-left: 6px;
    line-height: 1;
    vertical-align: middle;
    transition: color 0.15s;
  }
  .bookmark-btn-inline:hover {
    color: var(--orange);
  }
  .bookmark-btn-inline.active {
    color: var(--orange);
  }
  .bookmark-btn-inline.active:hover {
    color: var(--text-meta);
  }
  .report-btn-inline {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 0.9rem;
    color: var(--text-meta);
    padding: 0 4px;
    margin-left: 6px;
    line-height: 1;
    vertical-align: middle;
    transition: color 0.15s;
  }
  .report-btn-inline:hover {
    color: var(--orange);
  }
</style>
