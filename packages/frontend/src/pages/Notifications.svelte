<script>
  import { api } from "../lib/api.js";
  import { user } from "../lib/stores.js";

  let emailNewConversation = $state(false);
  let emailNewMessage = $state(false);
  let emailNewPost = $state(false);
  let loading = $state(true);
  let savingConversation = $state(false);
  let savingMessage = $state(false);
  let savingPost = $state(false);
  let error = $state("");
  let success = $state("");

  async function loadPreferences() {
    try {
      const data = await api("/api/users/me/notifications");
      emailNewConversation = data.emailNewConversation;
      emailNewMessage = data.emailNewMessage;
      emailNewPost = data.emailNewPost;
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  async function toggleNewConversation() {
    error = "";
    success = "";
    savingConversation = true;
    try {
      const data = await api("/api/users/me/notifications", {
        method: "PUT",
        body: JSON.stringify({ emailNewConversation: !emailNewConversation }),
      });
      emailNewConversation = data.emailNewConversation;
      user.update((u) => (u ? { ...u, emailNewConversation: data.emailNewConversation } : u));
      success = "Preferences saved.";
    } catch (err) {
      error = err.message;
    } finally {
      savingConversation = false;
    }
  }

  async function toggleNewMessage() {
    error = "";
    success = "";
    savingMessage = true;
    try {
      const data = await api("/api/users/me/notifications", {
        method: "PUT",
        body: JSON.stringify({ emailNewMessage: !emailNewMessage }),
      });
      emailNewMessage = data.emailNewMessage;
      user.update((u) => (u ? { ...u, emailNewMessage: data.emailNewMessage } : u));
      success = "Preferences saved.";
    } catch (err) {
      error = err.message;
    } finally {
      savingMessage = false;
    }
  }

  async function toggleNewPost() {
    error = "";
    success = "";
    savingPost = true;
    try {
      const data = await api("/api/users/me/notifications", {
        method: "PUT",
        body: JSON.stringify({ emailNewPost: !emailNewPost }),
      });
      emailNewPost = data.emailNewPost;
      user.update((u) => (u ? { ...u, emailNewPost: data.emailNewPost } : u));
      success = "Preferences saved.";
    } catch (err) {
      error = err.message;
    } finally {
      savingPost = false;
    }
  }

  loadPreferences();
</script>

<div class="form-card">
  <h1>Notifications</h1>

  {#if loading}
    <p style="color: #555;">Loading…</p>
  {:else}
    <div class="form-group" style="display: flex; align-items: center; gap: 0.75rem; margin-top: 1.5rem;">
      <input
        id="email-new-conversation"
        type="checkbox"
        checked={emailNewConversation}
        onchange={toggleNewConversation}
        disabled={savingConversation}
        style="width: 1.2rem; height: 1.2rem; cursor: pointer;"
      />
      <label for="email-new-conversation" style="margin: 0; cursor: pointer; font-weight: 500;">
        New conversation started on my post
      </label>
    </div>

    <p style="margin-top: 0.5rem; font-size: 0.9rem; color: #555;">
      When enabled, we will send you an email when someone starts a new conversation on one of your posts.
    </p>

    <div class="form-group" style="display: flex; align-items: center; gap: 0.75rem; margin-top: 1.5rem;">
      <input
        id="email-new-message"
        type="checkbox"
        checked={emailNewMessage}
        onchange={toggleNewMessage}
        disabled={savingMessage}
        style="width: 1.2rem; height: 1.2rem; cursor: pointer;"
      />
      <label for="email-new-message" style="margin: 0; cursor: pointer; font-weight: 500;">
        New message in a conversation
      </label>
    </div>

    <p style="margin-top: 0.5rem; font-size: 0.9rem; color: #555;">
      When enabled, we will send you an email when someone sends a new message in a conversation you are part of.
    </p>

    <div class="form-group" style="display: flex; align-items: center; gap: 0.75rem; margin-top: 1.5rem;">
      <input
        id="email-new-post"
        type="checkbox"
        checked={emailNewPost}
        onchange={toggleNewPost}
        disabled={savingPost}
        style="width: 1.2rem; height: 1.2rem; cursor: pointer;"
      />
      <label for="email-new-post" style="margin: 0; cursor: pointer; font-weight: 500;">
        New post on fastminds
      </label>
    </div>

    <p style="margin-top: 0.5rem; font-size: 0.9rem; color: #555;">
      When enabled, we will send you an email whenever anyone posts a new question or idea.
    </p>

    {#if error}
      <p class="form-error" style="margin-top: 1rem;">{error}</p>
    {/if}

    {#if success}
      <p class="form-success" style="margin-top: 1rem;">{success}</p>
    {/if}
  {/if}
</div>

<style>
  .form-success {
    color: #16a34a;
    font-size: 0.9rem;
    margin-bottom: 0.75rem;
  }
</style>
