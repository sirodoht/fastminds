<script>
  import { navigate } from "../router/index.js";

  let { params } = $props();

  let title = $state("");
  let body = $state("");
  let error = $state("");
  let loading = $state(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) { error = "Title is required."; return; }
    error = "";
    loading = true;
    // TODO: POST /api/posts
    await new Promise(r => setTimeout(r, 500));
    loading = false;
    navigate("/");
  }
</script>

<div class="form-card" style="max-width:600px">
  <h1>Submit a new post</h1>

  <form onsubmit={handleSubmit}>
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
