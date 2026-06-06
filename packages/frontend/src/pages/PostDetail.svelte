<script>
  import { onMount } from "svelte";
  import Link from "../router/Link.svelte";
  import { api } from "../lib/api.js";

  let { params } = $props();

  let post = $state(null);
  let loading = $state(true);
  let error = $state("");

  onMount(async () => {
    try {
      const data = await api(`/api/posts/${params.id}`);
      post = data.post;
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  });


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
          <Link href="/profile/{post.author}">{post.author}</Link>
        </div>
      </div>
    </article>

    {#if post.body}
      <div class="post-body">{post.body}</div>
    {/if}
  </div>
{/if}
