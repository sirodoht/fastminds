<script>
import { onMount } from "svelte";
import { navigate } from "../router/index.js";
import Link from "../router/Link.svelte";
import { api } from "../lib/api.js";
import { user } from "../lib/stores.js";

let { params } = $props();

let post = $state(null);
let updates = $state([]);
let loading = $state(true);
let error = $state("");

let showComposer = $state(false);
let firstMessage = $state("");
let composerError = $state("");
let composerLoading = $state(false);

async function fetchPost() {
  try {
    const data = await api(`/api/posts/${params.id}`);
    post = data.post;
  } catch (err) {
    error = err.message;
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

onMount(async () => {
  await fetchPost();
  await fetchUpdates();
  loading = false;
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

let isOwnPost = $derived($user && post && $user.id === post.author_id);
let hasStartedConversation = $derived(post?.hasStartedConversation ?? false);
let canStartConversation = $derived($user && post && !post.archived_at && !isOwnPost && !hasStartedConversation);
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
        </div>
      </div>
    </article>

    {#if post.body}
      <div class="post-body">{post.body}</div>
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
              <button type="button" class="btn-secondary" onclick={() => { showComposer = false; firstMessage = ""; composerError = ""; }}>
                Cancel
              </button>
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
        <p class="text-muted">This is your post.</p>
      {:else}
        <p class="text-muted"><Link href="/login">Log in</Link> to reply.</p>
      {/if}
    </div>
  </div>
{/if}

<style>
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
</style>
