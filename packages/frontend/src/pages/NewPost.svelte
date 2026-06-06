<script>
  import { onMount } from "svelte";
  import { navigate } from "../router/index.js";
  import { api } from "../lib/api.js";
  import { user } from "../lib/stores.js";

  let { params } = $props();

  onMount(() => {
    if (!$user) navigate("/login");
    if ($user && !$user.emailVerified) navigate("/");
  });

  let title = $state("");
  let body = $state("");
  let error = $state("");
  let loading = $state(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) { error = "Title is required."; return; }
    error = "";
    loading = true;
    try {
      await api("/api/posts", {
        method: "POST",
        body: JSON.stringify({ title: title.trim(), body: body.trim() }),
      });
      navigate("/");
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }
</script>

<div class="form-card" style="max-width:600px;margin:0 auto">
  <h1>Submit a new post</h1>

  <form on:submit={handleSubmit}>
    <div class="form-group">
      <label for="title">Title</label>
      <input
        id="title"
        type="text"
        bind:value={title}
        placeholder="A question, argument, paradox, or idea…"
        required
      />
    </div>

    <div class="form-group">
      <label for="body">Text (optional)</label>
      <textarea
        id="body"
        bind:value={body}
        placeholder="Share your thoughts…"
      ></textarea>
    </div>

    {#if error}
      <p class="form-error">{error}</p>
    {/if}

    <button type="submit" class="btn-primary" disabled={loading}>
      {loading ? "Submitting…" : "Submit"}
    </button>
  </form>
</div>
