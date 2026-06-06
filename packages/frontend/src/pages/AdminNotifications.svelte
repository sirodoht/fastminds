<script>
  import { api } from "../lib/api.js";
  import { user } from "../lib/stores.js";

  let selectedTemplate = $state("");
  let toEmail = $state("");
  let loading = $state(false);
  let error = $state("");
  let success = $state("");

  // Variables for each template
  let conversationUrl = $state("");
  let postTitle = $state("");
  let postBody = $state("");
  let postUrl = $state("");
  let postAuthor = $state("");

  const templates = [
    { value: "", label: "Select a template…" },
    { value: "new_conversation", label: "New conversation on my post" },
    { value: "new_message", label: "New message in a conversation" },
    { value: "new_post", label: "New post on fastminds" },
  ];

  $effect(() => {
    if ($user?.email && !toEmail) {
      toEmail = $user.email;
    }
  });

  function getDefaultUrl() {
    const base = window.location.origin;
    if (selectedTemplate === "new_conversation" || selectedTemplate === "new_message") {
      return `${base}/conversations/123`;
    }
    if (selectedTemplate === "new_post") {
      return `${base}/posts/123`;
    }
    return "";
  }

  async function sendTestEmail(e) {
    e.preventDefault();
    error = "";
    success = "";
    loading = true;

    try {
      const variables = {};
      if (selectedTemplate === "new_conversation" || selectedTemplate === "new_message") {
        variables.conversationUrl = conversationUrl || getDefaultUrl();
      } else if (selectedTemplate === "new_post") {
        variables.postTitle = postTitle || "Example post";
        variables.postBody = postBody || "This is an example post body for testing.";
        variables.postUrl = postUrl || getDefaultUrl();
        variables.author = postAuthor || "testuser";
      }

      await api("/api/admin/test-email", {
        method: "POST",
        body: JSON.stringify({
          template: selectedTemplate,
          to: toEmail,
          variables,
        }),
      });

      success = `Test email sent to ${toEmail}.`;
    } catch (err) {
      error = err.message || "Failed to send test email.";
    } finally {
      loading = false;
    }
  }
</script>

<div class="panel">
  <div class="panel-header">Test Notification Emails</div>
  <div class="panel-body">
    <p style="margin-bottom: 1rem; color: var(--text-muted); font-size: 0.9rem;">
      Send test notification emails to preview how they look to users. This is useful for checking email rendering and content.
    </p>

    <form onsubmit={sendTestEmail}>
      <div class="form-group">
        <label for="template">Template</label>
        <select id="template" bind:value={selectedTemplate}>
          {#each templates as t}
            <option value={t.value}>{t.label}</option>
          {/each}
        </select>
      </div>

      <div class="form-group">
        <label for="to-email">Recipient email</label>
        <input id="to-email" type="email" bind:value={toEmail} placeholder="admin@example.com" required />
      </div>

      {#if selectedTemplate === "new_conversation" || selectedTemplate === "new_message"}
        <div class="form-group">
          <label for="conversation-url">Conversation URL</label>
          <input id="conversation-url" type="url" bind:value={conversationUrl} placeholder={getDefaultUrl()} />
        </div>
      {/if}

      {#if selectedTemplate === "new_post"}
        <div class="form-group">
          <label for="post-title">Post title</label>
          <input id="post-title" type="text" bind:value={postTitle} placeholder="Example post" />
        </div>
        <div class="form-group">
          <label for="post-body">Post body</label>
          <textarea id="post-body" bind:value={postBody} rows="3" placeholder="This is an example post body for testing."></textarea>
        </div>
        <div class="form-group">
          <label for="post-url">Post URL</label>
          <input id="post-url" type="url" bind:value={postUrl} placeholder={getDefaultUrl()} />
        </div>
        <div class="form-group">
          <label for="post-author">Author</label>
          <input id="post-author" type="text" bind:value={postAuthor} placeholder="testuser" />
        </div>
      {/if}

      {#if error}
        <p class="form-error">{error}</p>
      {/if}
      {#if success}
        <p class="form-success">{success}</p>
      {/if}

      <button type="submit" class="btn-primary" disabled={loading || !selectedTemplate}>
        {loading ? "Sending…" : "Send test email"}
      </button>
    </form>
  </div>
</div>

<style>
  .form-success {
    color: #16a34a;
    font-size: 0.9rem;
    margin-bottom: 0.75rem;
  }
</style>
