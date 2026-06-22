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

  let question = $state("");
  let whyAsking = $state("I'm asking this because ...");
  let responseHopingFor = $state("It would be surprising to hear ...");
  let goodConversation = $state("");
  let error = $state("");
  let loading = $state(false);
  let previewing = $state(false);

  let postBodyPreview = $derived([
    whyAsking.trim(),
    responseHopingFor.trim(),
    goodConversation.trim(),
  ].filter(Boolean).join("\n\n"));
  let previewParagraphs = $derived(postBodyPreview.split(/\n{2,}/).filter(Boolean));

  function validateComposer() {
    if (!question.trim()) return "Question is required.";
    return "";
  }

  function handlePreview(e) {
    e.preventDefault();
    const validationError = validateComposer();
    if (validationError) {
      error = validationError;
      return;
    }
    error = "";
    previewing = true;
  }

  async function handleSubmit() {
    loading = true;
    try {
      await api("/api/posts", {
        method: "POST",
        body: JSON.stringify({
          question: question.trim(),
          whyAsking: whyAsking.trim(),
          responseHopingFor: responseHopingFor.trim(),
          goodConversation: goodConversation.trim(),
        }),
      });
      navigate("/");
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }
</script>

<div class="form-card new-post-card">
  <h1>Start with a better question</h1>

  {#if previewing}
    <div class="post-preview">
      <div class="preview-label">Preview</div>
      <div class="preview-title">{question.trim()}</div>
      {#if postBodyPreview}
        <div class="preview-body">
          {#each previewParagraphs as paragraph}
            <p>{paragraph}</p>
          {/each}
        </div>
      {/if}
    </div>

    {#if error}
      <p class="form-error">{error}</p>
    {/if}

    <div class="preview-actions">
      <button type="button" class="btn-secondary" onclick={() => previewing = false} disabled={loading}>
        Back to edit
      </button>
      <button type="button" class="btn-primary" onclick={handleSubmit} disabled={loading}>
        {loading ? "Posting…" : "Post"}
      </button>
    </div>
  {:else}
    <form onsubmit={handlePreview}>
      <div class="form-group">
        <label for="question">Question</label>
        <input
          id="question"
          type="text"
          bind:value={question}
          placeholder="What question would you want to discuss one-to-one?"
          required
          maxlength={112}
        />
      </div>

      <div class="form-group">
        <label for="why-asking">What makes this question interesting to ask right now?</label>
        <textarea
          id="why-asking"
          bind:value={whyAsking}
        ></textarea>
      </div>

      <div class="form-group">
        <label for="response-hoping-for">What would be surprising or grounding to hear?</label>
        <textarea
          id="response-hoping-for"
          bind:value={responseHopingFor}
        ></textarea>
      </div>

      <div class="form-group">
        <label for="good-conversation">What would make this a good conversation?</label>
        <textarea
          id="good-conversation"
          bind:value={goodConversation}
        ></textarea>
      </div>

      {#if error}
        <p class="form-error">{error}</p>
      {/if}

      <p class="composer-note">
        Only the question is required. The other fields are optional, but they can help people engage with your question and start a better conversation. Anything you write in the text areas will appear in the post body; the field questions themselves will not be shown.
      </p>

      <button type="submit" class="btn-primary">Preview</button>
    </form>
  {/if}
</div>

<style>
  .new-post-card {
    max-width: 720px;
    margin: 0 auto;
  }

  .composer-note {
    margin: 4px 0 16px;
    color: var(--text-muted);
    font-size: 0.84rem;
    line-height: 1.5;
  }

  .post-preview {
    padding: 14px 0 18px;
  }

  .preview-label {
    margin-bottom: 10px;
    color: var(--text-meta);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .preview-title {
    margin-bottom: 12px;
    color: var(--text);
    font-size: 1.08rem;
    font-weight: 600;
    line-height: 1.35;
  }

  .preview-body {
    color: var(--text);
    font-size: 0.9rem;
    line-height: 1.6;
  }

  .preview-body p {
    margin: 0;
  }

  .preview-body p + p {
    margin-top: 20px;
  }

  .preview-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }
</style>
